import { computeMetrics } from "@microsoft/vally";
import { fileURLToPath } from "url";
import { getAzureFixtureManifestPath, getEarlyTerminateCondition, getRequiredSkillsCondition, getSkillName, getSystemPrompt, getTakeScreenshotCondition } from "./tag-helpers.ts";
import { listPlugins, type Plugin, type SkillRef } from "../utils/skill-loader.ts";
import { normalizeTestName } from "./utils.ts";
import * as path from "node:path";
import type { AgentMetadata, AgentRunConfig } from "../utils/agent-runner.ts";
import type { Executor, ExecutorOptions, ExecutorRegistry, Stimulus, Trajectory } from "@microsoft/vally";
import { deleteResourceGroup, type FixtureManifest, type PostTestScriptConfig, readManifest, type ProvisionScriptOutput } from "../azure-fixtures/fixture-common.ts";
import { provisionManifest, type ProvisionManifestOutput, runPostTestScript } from "../azure-fixtures/provision-fixture.ts";
import { useAgentRunner, } from "../utils/copilot-sdk-runner.ts";
import { convertToTrajectoryEvents, createMarkdownReport, getAzureScopePrompt } from "../utils/agent-runner.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The model to use for the agent run.
 */
const modelOverride = process.env.MODEL_OVERRIDE?.trim() || undefined;

export class CopilotSdkAgentRunner implements Executor {
  name = "copilot-sdk-agent-runner";
  supportsMultiTurn = true;
  supportsPreparedWorkspace = true;

  async execute(stimulus: Stimulus, options: ExecutorOptions): Promise<Trajectory> {
    const startedAt = new Date();
    const tags = stimulus.tags;
    const skillName = getSkillName(tags);
    const normalizedTestName = normalizeTestName(skillName, stimulus.name);
    const agentRunner = useAgentRunner({ testName: normalizedTestName });

    // When custom executor is executed, vally has initialized the test workspace for us.
    const workDir = options.workDir;

    // Set the model to use
    const model = modelOverride ?? options.model ?? "claude-sonnet-5";

    const { shouldEarlyTerminate } = getEarlyTerminateCondition(tags);
    const systemPrompt = getSystemPrompt(tags);
    const { takeScreenshot } = getTakeScreenshotCondition(tags);
    const requiredSkills = getRequiredSkillsCondition(tags);
    const timeout = options.timeout;

    // Detect the owning plugin of the required skills and construct SkillRef objects for downstream processing
    const plugins = listPlugins();
    const requiredSkillRefs: SkillRef[] = [];
    const plugin: Plugin | undefined = plugins.find(plugin => plugin.skills.some(skillRef => skillRef.name === skillName));
    (requiredSkills ?? [skillName]).forEach(s => {
      const owningPlugin = plugins.find(plugin => plugin.skills.some(skillRef => skillRef.name === s));
      if (owningPlugin) {
        requiredSkillRefs.push({
          pluginDirname: owningPlugin.dirname,
          name: s
        });
      }
    });

    let prompt: string;
    if (stimulus.turns) {
      prompt = stimulus.turns[0];
    } else {
      prompt = stimulus.prompt;
    }
    let followUps: string[] | undefined;
    if (stimulus.turns) {
      followUps = stimulus.turns.slice(1);
    }

    const runConfig: AgentRunConfig = {
      workspace: workDir,
      env: {
        UV_CACHE_DIR: path.join(workDir, ".uv-cache"),
      },
      model: model,
      prompt: prompt,
      shouldEarlyTerminate: shouldEarlyTerminate,
      followUp: followUps,
      systemPrompt: systemPrompt,
      timeout: timeout,
      takeScreenshot: takeScreenshot,
      requiredSkills: requiredSkillRefs.length > 0 ? requiredSkillRefs : undefined,
      // Exact-skill hill climbing loads only evaluated skills so results are attributable to the target, not sibling plugin skills.
      includeSkills: process.env.VALLY_RUNNER_EXACT_SKILL === "true"
        ? requiredSkillRefs
        : undefined,
      maxTurns: stimulus.constraints?.max_turns,
      // Always make our agent runner preserve workspace.
      // vally will delete the test workspace by default.
      preserveWorkspace: true
    };

    let fixtureResourceGroups: string[] = [];
    let postTestScriptConfig: PostTestScriptConfig | undefined;
    let persistFixture: boolean = false;
    let provisionOutput: ProvisionManifestOutput | undefined;
    let manifest: FixtureManifest | undefined;
    let absoluteManifestPath: string | undefined;
    const relativeManifestPath = getAzureFixtureManifestPath(tags);
    try {
      // Provision azure fixture if it's defined
      if (!plugin?.dirname) {
        // <repo-root>/evals/<plugin-dir>/<skill-name>/<relative-manifest-path>
        throw new Error(`Unable to resolve plugin for skill ${skillName}`);
      }
      if (relativeManifestPath) {
        const fixtureBaseDir = path.resolve(__dirname, `../../evals/${plugin.dirname}/${skillName}`);
        absoluteManifestPath = path.resolve(fixtureBaseDir, relativeManifestPath);
        const rel = path.relative(fixtureBaseDir, absoluteManifestPath);
        if (rel.startsWith("..") || path.isAbsolute(rel)) {
          throw new Error(`azureFixture must resolve under ${fixtureBaseDir}: ${relativeManifestPath}`);
        }
        manifest = readManifest(absoluteManifestPath);

        provisionOutput = provisionManifest(absoluteManifestPath, manifest);
        const parsedProvisionOutput: ProvisionScriptOutput = JSON.parse(provisionOutput.output);
        const azureScopePrompt = getAzureScopePrompt(parsedProvisionOutput);
        runConfig.prompt += `\n${azureScopePrompt}`;
        fixtureResourceGroups = parsedProvisionOutput.resourceGroups;
        postTestScriptConfig = manifest.postTestScript;
        persistFixture = !!manifest.persist;
      }

      const agentMetadata: AgentMetadata = await agentRunner.run(runConfig);
      const completedAt = new Date();
      const events = convertToTrajectoryEvents(agentMetadata);
      const metrics = computeMetrics(events);

      const agentOutput = events
        .filter(e => e.type === "assistant_message")
        .map(e => e.data.content)
        .join("\n");

      const sessionId = agentMetadata.events
        .filter(e => e.type === "session.start")
        .at(0)?.id;

      await createMarkdownReport(normalizedTestName, runConfig, agentMetadata);
      await agentRunner.cleanup();

      if (postTestScriptConfig) {
        runPostTestScript(provisionOutput!.context, manifest!, path.dirname(absoluteManifestPath!));
      }

      // Vally will run the graders and produce results.jsonl.
      // After the all suites complete, we can process the results.json; file and recover our testResults.json file for dashboard consumption. 

      return {
        id: crypto.randomUUID(),
        stimulus,
        events,
        output: agentOutput,
        workDir: options.workDir,
        metadata: {
          startedAt,
          completedAt,
          model: model,
          executor: this.name,
          skillsLoaded: agentMetadata.skillsLoaded.map(ref => ref.name),
          sessionID: sessionId ?? "unknown",
        },
        metrics: {
          ...metrics,
          wallTimeMs: completedAt.getTime() - startedAt.getTime(),
        },
      };
    } finally {
      // Delete the fixtures provisioned for this test run
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

  async shutdown(): Promise<void> {
    // no-op
  }
}

export function registerExecutors(registry: ExecutorRegistry): void {
  registry.register(new CopilotSdkAgentRunner());
}
