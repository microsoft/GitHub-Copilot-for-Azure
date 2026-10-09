import type {
  ExecutorOptions,
  Stimulus,
  Trajectory,
} from "@microsoft/vally";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
  AgentMetadata,
  AgentRunConfig,
  IAgentRunner,
} from "../../utils/agent-runner.ts";

const mocks = vi.hoisted(() => ({
  convertToTrajectoryEvents: vi.fn(),
  createMarkdownReport: vi.fn(),
  deleteResourceGroup: vi.fn(),
  getAzureFixtureManifestPath: vi.fn(),
  getAzureScopePrompt: vi.fn(),
  getEarlyTerminateCondition: vi.fn(),
  getRequiredSkillsCondition: vi.fn(),
  getSkillName: vi.fn(),
  getSystemPrompt: vi.fn(),
  getTakeScreenshotCondition: vi.fn(),
  listPlugins: vi.fn(),
  provisionManifest: vi.fn(),
  readManifest: vi.fn(),
  runPostTestScript: vi.fn(),
}));

vi.mock("../../utils/agent-runner.ts", () => ({
  convertToTrajectoryEvents: mocks.convertToTrajectoryEvents,
  createMarkdownReport: mocks.createMarkdownReport,
  getAzureScopePrompt: mocks.getAzureScopePrompt,
}));

vi.mock("../../utils/skill-loader.ts", () => ({
  listPlugins: mocks.listPlugins,
}));

vi.mock("../../azure-fixtures/fixture-common.ts", () => ({
  deleteResourceGroup: mocks.deleteResourceGroup,
  readManifest: mocks.readManifest,
}));

vi.mock("../../azure-fixtures/provision-fixture.ts", () => ({
  provisionManifest: mocks.provisionManifest,
  runPostTestScript: mocks.runPostTestScript,
}));

vi.mock("../tag-helpers.ts", () => ({
  getAzureFixtureManifestPath: mocks.getAzureFixtureManifestPath,
  getEarlyTerminateCondition: mocks.getEarlyTerminateCondition,
  getRequiredSkillsCondition: mocks.getRequiredSkillsCondition,
  getSkillName: mocks.getSkillName,
  getSystemPrompt: mocks.getSystemPrompt,
  getTakeScreenshotCondition: mocks.getTakeScreenshotCondition,
}));

import { SdkAgentExecutor } from "../sdk-agent-executor.ts";

const convertedEvents: Trajectory["events"] = [
  {
    type: "assistant_message",
    data: {
      content: "Agent response",
    },
  },
];

const agentMetadata: AgentMetadata = {
  events: [],
  testComments: [],
  turnCount: 1,
  toolCounts: {},
  skillFiles: {},
  skillsLoaded: [
    {
      pluginDirname: "test-plugin",
      name: "target-skill",
    },
  ],
};

const defaultStimulus: Stimulus = {
  name: "executor test",
  prompt: "Initial prompt",
  tags: {
    skill: "target-skill",
  },
};

const defaultOptions: ExecutorOptions = {
  timeout: 30_000,
  workDir: "/tmp/sdk-agent-executor-test",
  model: "test-model",
};

class FakeAgentRunner implements IAgentRunner {
  readonly run = vi.fn<(config: AgentRunConfig) => Promise<AgentMetadata>>();
  readonly cleanup = vi.fn<() => Promise<void>>();

  constructor() {
    this.run.mockResolvedValue(agentMetadata);
    this.cleanup.mockResolvedValue();
  }
}

class TestSdkAgentExecutor extends SdkAgentExecutor {
  constructor(runner: IAgentRunner) {
    super({
      name: "test-sdk-agent-runner",
      createRunner: () => runner,
    });
  }

  async shutdown(): Promise<void> {
    // no-op
  }
}

describe("SdkAgentExecutor", () => {
  let runner: FakeAgentRunner;
  let executor: TestSdkAgentExecutor;
  let originalExactSkill: string | undefined;

  beforeEach(() => {
    originalExactSkill = process.env.VALLY_RUNNER_EXACT_SKILL;
    delete process.env.VALLY_RUNNER_EXACT_SKILL;

    vi.clearAllMocks();
    mocks.convertToTrajectoryEvents.mockReturnValue(convertedEvents);
    mocks.createMarkdownReport.mockResolvedValue(undefined);
    mocks.getAzureFixtureManifestPath.mockReturnValue(undefined);
    mocks.getAzureScopePrompt.mockReturnValue("Azure scope");
    mocks.getEarlyTerminateCondition.mockReturnValue({});
    mocks.getRequiredSkillsCondition.mockReturnValue(undefined);
    mocks.getSkillName.mockReturnValue("target-skill");
    mocks.getSystemPrompt.mockReturnValue(undefined);
    mocks.getTakeScreenshotCondition.mockReturnValue({});
    mocks.listPlugins.mockReturnValue([
      {
        dirname: "test-plugin",
        skills: [
          {
            pluginDirname: "test-plugin",
            name: "target-skill",
          },
          {
            pluginDirname: "test-plugin",
            name: "dependency-skill",
          },
        ],
      },
    ]);

    runner = new FakeAgentRunner();
    executor = new TestSdkAgentExecutor(runner);
  });

  afterEach(() => {
    if (originalExactSkill === undefined) {
      delete process.env.VALLY_RUNNER_EXACT_SKILL;
    } else {
      process.env.VALLY_RUNNER_EXACT_SKILL = originalExactSkill;
    }
  });

  test("builds the run configuration and trajectory for multiple turns", async () => {
    mocks.getRequiredSkillsCondition.mockReturnValue(["dependency-skill"]);
    const stimulus: Stimulus = {
      ...defaultStimulus,
      turns: ["First turn", "Second turn", "Third turn"],
      constraints: {
        max_turns: 7,
      },
    };

    const trajectory = await executor.execute(stimulus, defaultOptions);

    expect(runner.run).toHaveBeenCalledWith({
      workspace: defaultOptions.workDir,
      env: {
        UV_CACHE_DIR: `${defaultOptions.workDir}/.uv-cache`,
      },
      model: defaultOptions.model,
      prompt: "First turn",
      shouldEarlyTerminate: undefined,
      followUp: ["Second turn", "Third turn"],
      systemPrompt: undefined,
      timeout: defaultOptions.timeout,
      takeScreenshot: undefined,
      requiredSkills: [
        {
          pluginDirname: "test-plugin",
          name: "dependency-skill",
        },
      ],
      includeSkills: undefined,
      maxTurns: 7,
      preserveWorkspace: true,
    });
    expect(mocks.createMarkdownReport).toHaveBeenCalledWith(
      "target-skill_executor_test",
      expect.objectContaining({
        prompt: "First turn",
      }),
      agentMetadata,
    );
    expect(runner.cleanup).toHaveBeenCalledOnce();
    expect(trajectory).toMatchObject({
      stimulus,
      events: convertedEvents,
      output: "Agent response",
      workDir: defaultOptions.workDir,
      metadata: {
        model: defaultOptions.model,
        executor: "test-sdk-agent-runner",
        skillsLoaded: ["target-skill"],
        sessionID: "unknown",
      },
    });
  });

  test("uses stimulus.prompt and exact-skill mode when turns are absent", async () => {
    process.env.VALLY_RUNNER_EXACT_SKILL = "true";

    await executor.execute(defaultStimulus, defaultOptions);

    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: defaultStimulus.prompt,
        followUp: undefined,
        requiredSkills: [
          {
            pluginDirname: "test-plugin",
            name: "target-skill",
          },
        ],
        includeSkills: [
          {
            pluginDirname: "test-plugin",
            name: "target-skill",
          },
        ],
      }),
    );
  });

  test("cleans up the runner when execution fails", async () => {
    const executionError = new Error("run failed");
    runner.run.mockRejectedValue(executionError);

    await expect(executor.execute(defaultStimulus, defaultOptions))
      .rejects.toBe(executionError);
    expect(runner.cleanup).toHaveBeenCalledOnce();
  });

  test("cleans up the runner when trajectory conversion fails", async () => {
    const conversionError = new Error("conversion failed");
    mocks.convertToTrajectoryEvents.mockImplementation(() => {
      throw conversionError;
    });

    await expect(executor.execute(defaultStimulus, defaultOptions))
      .rejects.toBe(conversionError);
    expect(runner.cleanup).toHaveBeenCalledOnce();
  });

  test("cleans up the runner when report creation fails", async () => {
    const reportError = new Error("report failed");
    mocks.createMarkdownReport.mockRejectedValue(reportError);

    await expect(executor.execute(defaultStimulus, defaultOptions))
      .rejects.toBe(reportError);
    expect(runner.cleanup).toHaveBeenCalledOnce();
  });

  test("preserves execution and cleanup errors when both fail", async () => {
    const executionError = new Error("run failed");
    const cleanupError = new Error("cleanup failed");
    runner.run.mockRejectedValue(executionError);
    runner.cleanup.mockRejectedValue(cleanupError);

    const result = executor.execute(defaultStimulus, defaultOptions);

    await expect(result).rejects.toMatchObject({
      errors: [executionError, cleanupError],
      cause: executionError,
    });
  });

  test("rejects fixture paths that escape the skill fixture directory", async () => {
    mocks.getAzureFixtureManifestPath.mockReturnValue("../../outside.json");

    await expect(executor.execute(defaultStimulus, defaultOptions))
      .rejects.toThrow("azureFixture must resolve under");
    expect(mocks.readManifest).not.toHaveBeenCalled();
    expect(runner.run).not.toHaveBeenCalled();
  });

  test("provisions and cleans up a non-persisted fixture", async () => {
    const manifest = {
      bicepConfigs: [],
      postTestScript: {
        path: "verify.ts",
      },
    };
    const context = {
      runId: "run-id",
      suffix: "suffix",
      subscriptionId: "subscription-id",
      tenantId: "tenant-id",
      resourceGroupNames: {
        test: "test-rg",
      },
      testPrincipalId: "principal-id",
    };
    mocks.getAzureFixtureManifestPath.mockReturnValue("fixture.json");
    mocks.readManifest.mockReturnValue(manifest);
    mocks.provisionManifest.mockReturnValue({
      context,
      output: JSON.stringify({
        resourceGroups: ["test-rg", "dependency-rg"],
      }),
    });

    await executor.execute(defaultStimulus, defaultOptions);

    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: `${defaultStimulus.prompt}\nAzure scope`,
      }),
    );
    expect(mocks.runPostTestScript).toHaveBeenCalledWith(
      context,
      manifest,
      expect.stringMatching(/target-skill$/u),
    );
    expect(mocks.deleteResourceGroup.mock.calls).toEqual([
      ["test-rg"],
      ["dependency-rg"],
    ]);
  });

  test("does not delete persisted fixture resource groups", async () => {
    mocks.getAzureFixtureManifestPath.mockReturnValue("fixture.json");
    mocks.readManifest.mockReturnValue({
      bicepConfigs: [],
      persist: true,
    });
    mocks.provisionManifest.mockReturnValue({
      context: {},
      output: JSON.stringify({
        resourceGroups: ["persisted-rg"],
      }),
    });

    await executor.execute(defaultStimulus, defaultOptions);

    expect(mocks.deleteResourceGroup).not.toHaveBeenCalled();
  });
});
