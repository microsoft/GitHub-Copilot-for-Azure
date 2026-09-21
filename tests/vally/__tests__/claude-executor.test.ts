import type { ExecutorOptions, Stimulus, Trajectory } from "@microsoft/vally";
import { computeMetrics } from "@microsoft/vally";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ClaudeIntegrationExecutor, loadClaudeExecutor } from "../claude-executor.ts";
import { listPlugins } from "../../utils/skill-loader.ts";
import { executorArgs, parseCliOptions } from "../../run-vally-test.ts";

describe("ClaudeIntegrationExecutor", () => {
  let root: string;
  let stimulus: Stimulus;
  let options: ExecutorOptions;
  let trajectory: Trajectory;
  const execute = vi.fn<(stimulus: Stimulus, options: ExecutorOptions) => Promise<Trajectory>>();
  const shutdown = vi.fn<() => Promise<void>>();
  const construct = vi.fn();
  class FakeClaude {
    name = "claude-cli";
    execute = execute;
    shutdown = shutdown;
    constructor(config: { claudePath?: string; extraArgs?: string[] }) {
      construct(config);
    }
  }
  const adapter = new ClaudeIntegrationExecutor(FakeClaude);

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "claude-executor-test-"));
    const output = path.join(root, "output");
    await mkdir(path.join(output, "hooks"), { recursive: true });
    for (const name of ["azure-ai", "azure-other"]) {
      const dir = path.join(output, "azure-skills", "skills", name);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: test skill\n---\nInstructions.`);
    }
    vi.stubEnv("VALLY_PLUGIN_OUTPUT_ROOT", output);
    vi.stubEnv("VALLY_RUNNER_EXACT_SKILL", "true");
    vi.stubEnv("VALLY_RUNNER_DISABLE_AZURE_MCP", "false");
    vi.stubEnv("NO_SKILLS", "false");
    vi.stubEnv("MODEL_OVERRIDE", "");
    vi.stubEnv("CLAUDE_CLI_PATH", "");
    stimulus = { name: "routing", prompt: "Help with search", tags: { skill: "azure-ai" } };
    options = { workDir: path.join(root, "workspace"), timeout: 1000 };
    await mkdir(options.workDir);
    await writeFile(path.join(options.workDir, "fixture.txt"), "preserved");
    trajectory = {
      id: "trial",
      stimulus,
      workDir: options.workDir,
      output: "done",
      events: [{
        type: "tool_call",
        data: { toolCallId: "skill-1", toolName: "skill", arguments: { skill: "azure-ai" } },
      }],
      metadata: {
        startedAt: new Date(), completedAt: new Date(), model: "sonnet",
        executor: "claude-cli", skillsLoaded: [], sessionID: "session",
      },
      metrics: { ...computeMetrics([]), wallTimeMs: 123 },
    };
    execute.mockResolvedValue(trajectory);
    shutdown.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  test("stages exact workspace skills, preserves fixtures, and emits grader-compatible activations", async () => {
    const result = await adapter.execute(stimulus, options);
    expect(await readFile(path.join(options.workDir, ".claude", "skills", "azure-ai", "SKILL.md"), "utf8")).toContain("Instructions.");
    await expect(readFile(path.join(options.workDir, ".claude", "skills", "azure-other", "SKILL.md"))).rejects.toThrow();
    expect(await readFile(path.join(options.workDir, "fixture.txt"), "utf8")).toBe("preserved");
    expect(listPlugins().map(plugin => plugin.dirname)).toEqual(["azure-skills"]);
    expect(result.metadata.skillsLoaded).toEqual(["azure-ai"]);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: "skill_activation", data: expect.objectContaining({ name: "azure-ai" }),
    }));
    expect(result.metrics.wallTimeMs).toBe(123);
    expect(shutdown).toHaveBeenCalledOnce();
  });

  test("forwards multi-turn, timeout, environment and custom MCP servers", async () => {
    stimulus.turns = ["First turn", "Second turn"];
    options.model = "opus";
    options.env = { TEST_VAR: "value" };
    const custom = { type: "stdio", command: "node", args: ["server.js"] } as const;
    options.mcpServers = { custom: { ...custom, args: [...custom.args] } };
    await adapter.execute(stimulus, options);
    expect(execute).toHaveBeenCalledWith(stimulus, expect.objectContaining({
      timeout: 1000, model: "opus",
      env: expect.objectContaining({ TEST_VAR: "value" }),
      mcpServers: {
        azure: { type: "stdio", command: "npx", args: ["-y", "@azure/mcp", "server", "start"] },
        custom,
      },
    }));
  });

  test("honors model, CLI path, no-skills and disable-Azure-MCP overrides", async () => {
    vi.stubEnv("MODEL_OVERRIDE", "opus");
    vi.stubEnv("CLAUDE_CLI_PATH", path.join(root, "claude.exe"));
    vi.stubEnv("NO_SKILLS", "true");
    vi.stubEnv("VALLY_RUNNER_DISABLE_AZURE_MCP", "true");
    const result = await adapter.execute(stimulus, options);
    expect(result.metadata.skillsLoaded).toEqual([]);
    expect(execute).toHaveBeenCalledWith(stimulus, expect.objectContaining({ model: "opus", mcpServers: {} }));
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ claudePath: path.join(root, "claude.exe") }));
  });

  test.each(["append", "replace"])("maps %s system prompts and max turns", async mode => {
    stimulus.tags = { skill: "azure-ai", systemPrompt: JSON.stringify({ mode, content: "Be concise." }) };
    stimulus.constraints = { max_turns: 4 };
    await adapter.execute(stimulus, options);
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({
      extraArgs: [mode === "replace" ? "--system-prompt" : "--append-system-prompt", "Be concise.", "--max-turns", "4"],
    }));
  });

  test("warns explicitly when early termination is unavailable", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    stimulus.tags = { skill: "azure-ai", earlyTerminate: "[]" };
    await adapter.execute(stimulus, options);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("until completion or timeout"));
  });

  test.each<Record<string, string>>([
    { skill: "missing" },
    { skill: "azure-ai", takeScreenshot: "[]" },
    { skill: "azure-ai", systemPrompt: "{}" },
    { skill: "azure-ai", systemPrompt: "{\"mode\":\"custom\",\"content\":\"test\"}" },
    { skill: "azure-ai", systemPrompt: "{\"content\":\"test\",\"sections\":{}}" },
  ])("fails explicitly on unsupported tags or missing skills: %j", async tags => {
    stimulus.tags = tags;
    await expect(adapter.execute(stimulus, options)).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });

  test("does not overwrite skills supplied by fixtures", async () => {
    const dir = path.join(options.workDir, ".claude", "skills", "azure-ai");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "SKILL.md"), "fixture skill");
    await expect(adapter.execute(stimulus, options)).rejects.toThrow();
    expect(await readFile(path.join(dir, "SKILL.md"), "utf8")).toBe("fixture skill");
  });

  test("propagates execution failures and shuts down", async () => {
    execute.mockRejectedValueOnce(new Error("Claude failed"));
    await expect(adapter.execute(stimulus, options)).rejects.toThrow("Claude failed");
    expect(shutdown).toHaveBeenCalledOnce();
  });

  test("reports a missing upstream module with setup instructions", async () => {
    vi.stubEnv("VALLY_CLAUDE_EXECUTOR_MODULE", path.join(root, "missing.js"));
    await expect(loadClaudeExecutor()).rejects.toThrow("VALLY_CLAUDE_EXECUTOR_MODULE");
  });
});

describe("Vally executor selection", () => {
  afterEach(() => vi.unstubAllEnvs());

  test.each(["--executor", "--agent"])("parses %s and preserves other Vally arguments", flag => {
    const options = parseCliOptions([flag, "claude-cli", "--skill", "azure-ai", "--runs", "1"]);
    expect(options.executor).toBe("claude-cli");
    expect(options.skill).toBe("azure-ai");
    expect(options.forwardedArgs).toEqual(["--runs", "1"]);
    expect(executorArgs(options)).toContain(path.resolve(import.meta.dirname, "..", "claude-executor.ts"));
  });

  test("supports equals syntax and a default Claude model", () => {
    vi.stubEnv("MODEL_OVERRIDE", "");
    const args = executorArgs(parseCliOptions(["--executor=claude-cli"]));
    expect(args.slice(-4)).toEqual(["--executor", "claude-cli", "--model", "sonnet"]);
    expect(args[1]).toMatch(/results-claude$/);
  });

  test("does not replace an explicit Claude model", () => {
    expect(executorArgs(parseCliOptions(["--executor=claude-cli", "--model=opus"]))).not.toContain("--model");
  });

  test("preserves the default Copilot executor and output directory", () => {
    const args = executorArgs(parseCliOptions(["--skill", "azure-ai"]));
    expect(args).toContain(path.resolve(import.meta.dirname, "..", "vally-executor.ts"));
    expect(args).not.toContain("--executor");
    expect(args).not.toContain("--model");
    expect(args[1]).toMatch(/results$/);
  });

  test.each([
    { args: ["--executor"] },
    { args: ["--agent="] },
    { args: ["--executor", "--runs"] },
  ])("rejects a missing executor: $args", ({ args }) => {
    expect(() => parseCliOptions(args)).toThrow("Missing value");
  });
});
