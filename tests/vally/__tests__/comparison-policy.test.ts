import type { ExecutorOptions, Stimulus } from "@microsoft/vally";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { comparisonCopilotMcpServers, comparisonMcpServers, comparisonSkills, comparisonStimulus, getCommonSystemPrompt } from "../comparison-policy.ts";
import { IntegrationTestAgentRunner } from "../vally-executor.ts";

const runner = vi.hoisted(() => ({
  run: vi.fn(), cleanup: vi.fn(), report: vi.fn(),
}));
vi.mock("../../utils/agent-runner.ts", () => ({
  useAgentRunner: () => ({ run: runner.run, cleanup: runner.cleanup }),
  createMarkdownReport: runner.report,
}));

describe("fair comparison policy", () => {
  let root: string;
  let stimulus: Stimulus;
  let options: ExecutorOptions;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "comparison-policy-test-"));
    for (const name of ["azure-ai", "azure-other"]) {
      const dir = path.join(root, "azure-skills", "skills", name);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: Test\n---\nContent`);
    }
    vi.stubEnv("VALLY_PLUGIN_OUTPUT_ROOT", root);
    vi.stubEnv("VALLY_FAIR_COMPARISON", "true");
    vi.stubEnv("NO_SKILLS", "false");
    vi.stubEnv("MODEL_OVERRIDE", "");
    stimulus = { name: "routing", prompt: "Search", tags: { skill: "azure-ai", earlyTerminate: "[]" } };
    options = { workDir: root, model: "claude-sonnet-5", timeout: 1000 };
    runner.run.mockResolvedValue({
      events: [], testComments: [], turnCount: 0, toolCounts: {}, skillFiles: {},
      skillsLoaded: [{ pluginDirname: "azure-skills", name: "azure-ai" }],
    });
    runner.cleanup.mockResolvedValue(undefined);
    runner.report.mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  test("disables early termination without mutating the eval", () => {
    expect(comparisonStimulus(stimulus, options).tags).not.toHaveProperty("earlyTerminate");
    expect(stimulus.tags?.earlyTerminate).toBe("[]");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("both clients"));
  });

  test("selects the exact deduplicated sorted required skills", async () => {
    stimulus.tags = { requiredSkills: ["azure-other", "azure-ai", "azure-ai"] };
    expect((await comparisonSkills(stimulus)).map(ref => ref.name)).toEqual(["azure-ai", "azure-other"]);
  });

  test("rejects missing and ambiguous skills", async () => {
    stimulus.tags = { skill: "missing" };
    await expect(comparisonSkills(stimulus)).rejects.toThrow("Expected one built skill");
    const duplicate = path.join(root, "duplicate", "skills", "azure-ai");
    await mkdir(duplicate, { recursive: true });
    await writeFile(path.join(duplicate, "SKILL.md"), "---\nname: azure-ai\n---\n");
    stimulus.tags = { skill: "azure-ai" };
    await expect(comparisonSkills(stimulus)).rejects.toThrow("found 2");
  });

  test("rejects exact skill sets exceeding the Copilot budget", async () => {
    await writeFile(path.join(root, "azure-skills", "skills", "azure-ai", "SKILL.md"),
      `---\nname: azure-ai\ndescription: ${"x".repeat(21000)}\n---\n`);
    await expect(comparisonSkills(stimulus)).rejects.toThrow("budget");
  });

  test.each<Partial<ExecutorOptions>>([
    { model: undefined }, { timeout: 0 }, { timeout: Number.NaN },
    { reasoningEffort: "high" }, { maxAgentDurationMs: 500 }, { executorConfig: {} },
  ])("rejects nonportable executor settings: %j", override => {
    expect(() => comparisonStimulus(stimulus, { ...options, ...override })).toThrow();
  });

  test.each<Partial<Stimulus>>([
    { tags: { takeScreenshot: "[]" } },
    { tags: { systemPrompt: "{\"mode\":\"custom\",\"content\":\"test\"}" } },
    { constraints: { max_turns: 5 } },
    { supported_executors: ["claude-cli"] },
  ])("rejects nonportable stimulus settings: %j", override => {
    expect(() => comparisonStimulus({ ...stimulus, ...override }, options)).toThrow();
  });

  test("maps the common system prompt and only explicitly declared MCP servers", () => {
    stimulus.tags = { systemPrompt: "{\"content\":\"Be concise\"}" };
    expect(getCommonSystemPrompt(stimulus)).toEqual({ mode: "append", content: "Be concise" });
    expect(comparisonMcpServers(options)).toEqual({});
    options.mcpServers = {
      local: { type: "stdio", command: "node", args: ["server.js"], env: { MODE: "test" } },
      remote: { type: "http", url: "http://localhost:5000", headers: { "X-Test": "true" } },
    };
    expect(comparisonCopilotMcpServers(options)).toEqual({
      local: { ...options.mcpServers.local, tools: ["*"] },
      remote: { ...options.mcpServers.remote, tools: ["*"] },
    });
    options.mcpServers.local = { type: "stdio", command: "node", cwd: root };
    expect(() => comparisonMcpServers(options)).toThrow("timeout/cwd");
  });

  test("wires the Copilot adapter to exact skills, env, MCP and comparison conversation", async () => {
    options.env = { REGION: "test", UV_CACHE_DIR: "override" };
    options.mcpServers = { test: { type: "stdio", command: "node" } };
    stimulus.turns = ["first", "second"];
    const executor = new IntegrationTestAgentRunner();
    const trajectory = await executor.execute(stimulus, options);
    expect(executor.supportsPreparedWorkspace).toBe(false);
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({
      comparisonMode: true,
      env: options.env,
      mcpServers: { test: { type: "stdio", command: "node", tools: ["*"] } },
      includeSkills: [{ pluginDirname: "azure-skills", name: "azure-ai" }],
      shouldEarlyTerminate: undefined, takeScreenshot: undefined, timeout: 1000,
      prompt: "first", followUp: ["second"],
    }));
    expect(trajectory.stimulus.tags).not.toHaveProperty("earlyTerminate");
    expect(runner.cleanup).toHaveBeenCalledOnce();
  });

  test("cleans up on Copilot execution failure", async () => {
    runner.run.mockRejectedValueOnce(new Error("Agent timeout"));
    await expect(new IntegrationTestAgentRunner().execute(stimulus, options)).rejects.toThrow("Agent timeout");
    expect(runner.cleanup).toHaveBeenCalledOnce();
    expect(runner.report).not.toHaveBeenCalled();
  });

  test("preserves normal Copilot early termination and default MCP behavior", async () => {
    vi.stubEnv("VALLY_FAIR_COMPARISON", "false");
    const executor = new IntegrationTestAgentRunner();
    await executor.execute(stimulus, options);
    expect(executor.supportsPreparedWorkspace).toBe(true);
    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({ shouldEarlyTerminate: expect.any(Function) }));
    expect(runner.run.mock.calls[0][0]).not.toHaveProperty("comparisonMode");
    expect(runner.run.mock.calls[0][0]).not.toHaveProperty("mcpServers");
  });
});
