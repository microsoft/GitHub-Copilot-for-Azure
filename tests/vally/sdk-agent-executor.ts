import {
  computeMetrics,
  type Executor,
  type ExecutorOptions,
  type Stimulus,
  type Trajectory,
} from "@microsoft/vally";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deleteResourceGroup,
  type FixtureManifest,
  type PostTestScriptConfig,
  type ProvisionScriptOutput,
  readManifest,
} from "../azure-fixtures/fixture-common.ts";
import {
  provisionManifest,
  type ProvisionManifestOutput,
  runPostTestScript,
} from "../azure-fixtures/provision-fixture.ts";
import {
  convertToTrajectoryEvents,
  createMarkdownReport,
  getAzureScopePrompt,
  type AgentMetadata,
  type AgentRunConfig,
  type AgentRunnerConfig,
  type IAgentRunner,
} from "../utils/agent-runner.ts";
import { listPlugins, type Plugin, type SkillRef } from "../utils/skill-loader.ts";
import {
  getAzureFixtureManifestPath,
  getEarlyTerminateCondition,
  getRequiredSkillsCondition,
  getSkillName,
  getSystemPrompt,
  getTakeScreenshotCondition,
} from "./tag-helpers.ts";
import { normalizeTestName } from "./utils.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelOverride = process.env.MODEL_OVERRIDE?.trim() || undefined;

export type SdkAgentExecutorConfig = {
  name: string;
  createRunner: (config: AgentRunnerConfig) => IAgentRunner;
};

export abstract class SdkAgentExecutor implements Executor {
  readonly name: string;
  readonly supportsMultiTurn = true;
  readonly supportsPreparedWorkspace = true;

  private config: SdkAgentExecutorConfig;

  protected constructor(config: SdkAgentExecutorConfig) {
    this.config = config;
    this.name = config.name;
  }

  async execute(stimulus: Stimulus, options: ExecutorOptions): Promise<Trajectory> {
    const startedAt = new Date();
    const tags = stimulus.tags;
    const skillName = getSkillName(tags);
    const normalizedTestName = normalizeTestName(skillName, stimulus.name);
    const agentRunner = this.config.createRunner({ testName: normalizedTestName });
    const workDir = options.workDir;
    const model = modelOverride ?? options.model ?? "claude-sonnet-5";
    const { shouldEarlyTerminate } = getEarlyTerminateCondition(tags);
    const systemPrompt = getSystemPrompt(tags);
    const { takeScreenshot } = getTakeScreenshotCondition(tags);
    const requiredSkills = getRequiredSkillsCondition(tags);
    const plugins = listPlugins();
    const plugin: Plugin | undefined = plugins.find(candidate =>
      candidate.skills.some(skillRef => skillRef.name === skillName));
    const requiredSkillRefs: SkillRef[] = [];

    for (const requiredSkill of requiredSkills ?? [skillName]) {
      const owningPlugin = plugins.find(candidate =>
        candidate.skills.some(skillRef => skillRef.name === requiredSkill));
      if (owningPlugin) {
        requiredSkillRefs.push({
          pluginDirname: owningPlugin.dirname,
          name: requiredSkill,
        });
      }
    }

    const prompt = stimulus.turns ? stimulus.turns[0] : stimulus.prompt;
    const followUps = stimulus.turns ? stimulus.turns.slice(1) : undefined;
    const runConfig: AgentRunConfig = {
      workspace: workDir,
      env: {
        UV_CACHE_DIR: path.join(workDir, ".uv-cache"),
      },
      model,
      prompt,
      shouldEarlyTerminate,
      followUp: followUps,
      systemPrompt,
      timeout: options.timeout,
      takeScreenshot,
      requiredSkills: requiredSkillRefs.length > 0 ? requiredSkillRefs : undefined,
      includeSkills: process.env.VALLY_RUNNER_EXACT_SKILL === "true"
        ? requiredSkillRefs
        : undefined,
      maxTurns: stimulus.constraints?.max_turns,
      preserveWorkspace: true,
    };

    let fixtureResourceGroups: string[] = [];
    let postTestScriptConfig: PostTestScriptConfig | undefined;
    let persistFixture = false;
    let provisionOutput: ProvisionManifestOutput | undefined;
    let manifest: FixtureManifest | undefined;
    let absoluteManifestPath: string | undefined;
    const relativeManifestPath = getAzureFixtureManifestPath(tags);

    try {
      if (!plugin?.dirname) {
        throw new Error(`Unable to resolve plugin for skill ${skillName}`);
      }

      if (relativeManifestPath) {
        const fixtureBaseDir = path.resolve(
          __dirname,
          `../../evals/${plugin.dirname}/${skillName}`,
        );
        absoluteManifestPath = path.resolve(fixtureBaseDir, relativeManifestPath);
        const relativePath = path.relative(fixtureBaseDir, absoluteManifestPath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
          throw new Error(
            `azureFixture must resolve under ${fixtureBaseDir}: ${relativeManifestPath}`,
          );
        }

        manifest = readManifest(absoluteManifestPath);
        provisionOutput = provisionManifest(absoluteManifestPath, manifest);
        const parsedProvisionOutput: ProvisionScriptOutput = JSON.parse(
          provisionOutput.output,
        );
        runConfig.prompt += `\n${getAzureScopePrompt(parsedProvisionOutput)}`;
        fixtureResourceGroups = parsedProvisionOutput.resourceGroups;
        postTestScriptConfig = manifest.postTestScript;
        persistFixture = !!manifest.persist;
      }

      let trajectory: Trajectory | undefined;
      let executionError: unknown;
      try {
        const agentMetadata: AgentMetadata = await agentRunner.run(runConfig);
        const completedAt = new Date();
        const events = convertToTrajectoryEvents(agentMetadata);
        const metrics = computeMetrics(events);
        const agentOutput = events
          .filter(event => event.type === "assistant_message")
          .map(event => event.data.content)
          .join("\n");
        const sessionId = agentMetadata.events
          .find(event => event.type === "session.start")?.id;

        await createMarkdownReport(normalizedTestName, runConfig, agentMetadata);

        trajectory = {
          id: crypto.randomUUID(),
          stimulus,
          events,
          output: agentOutput,
          workDir,
          metadata: {
            startedAt,
            completedAt,
            model,
            executor: this.name,
            skillsLoaded: agentMetadata.skillsLoaded.map(ref => ref.name),
            sessionID: sessionId ?? "unknown",
          },
          metrics: {
            ...metrics,
            wallTimeMs: completedAt.getTime() - startedAt.getTime(),
          },
        };
      } catch (error) {
        executionError = error;
      }

      let cleanupError: unknown;
      try {
        await agentRunner.cleanup();
      } catch (error) {
        cleanupError = error;
      }

      if (executionError !== undefined && cleanupError !== undefined) {
        throw new AggregateError(
          [executionError, cleanupError],
          "Agent execution and cleanup both failed.",
          { cause: executionError },
        );
      }
      if (executionError !== undefined) {
        throw executionError;
      }
      if (cleanupError !== undefined) {
        throw cleanupError;
      }

      if (postTestScriptConfig) {
        runPostTestScript(
          provisionOutput!.context,
          manifest!,
          path.dirname(absoluteManifestPath!),
        );
      }

      return trajectory!;
    } finally {
      if (!persistFixture) {
        for (const resourceGroupName of fixtureResourceGroups) {
          try {
            deleteResourceGroup(resourceGroupName);
          } catch {
            // Suppress cleanup failures so they do not mask test results.
          }
        }
      }
    }
  }

  abstract shutdown(): Promise<void>;
}
