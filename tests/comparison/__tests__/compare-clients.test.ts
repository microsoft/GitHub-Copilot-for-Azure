import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { compareClients, findComparisonResult, parseComparisonArgs, type ComparisonOptions } from "../compare-clients.ts";

describe("paired client comparison", () => {
  let root: string;
  let options: ComparisonOptions;
  const run = vi.fn<(args: string[], env: NodeJS.ProcessEnv) => Promise<number>>();

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "paired-comparison-test-"));
    const pluginRoot = path.join(root, "output");
    const skill = path.join(pluginRoot, "azure-skills", "skills", "azure-ai");
    await mkdir(skill, { recursive: true });
    await writeFile(path.join(skill, "SKILL.md"), "---\nname: azure-ai\ndescription: Test skill\n---\nFrozen content");
    vi.stubEnv("VALLY_PLUGIN_OUTPUT_ROOT", pluginRoot);
    vi.stubEnv("NO_SKILLS", "false");
    vi.stubEnv("MODEL_OVERRIDE", "");
    const evalSpec = path.join(root, "custom.eval.yaml");
    await writeFile(evalSpec, [
      "name: paired", "tags:", "  skill: azure-ai", "stimuli:",
      "  - name: first", "    prompt: hello", "    rubric:", "      - Answers the question",
    ].join("\n"));
    options = {
      evalSpec, copilotModel: "claude-sonnet-5", claudeModel: "claude-sonnet-5",
      judgeModel: "gpt-5.5", runs: 2, timeout: "1m", outputDir: path.join(root, "results"),
      skipJudge: false, failOnRegression: false,
    };
    run.mockImplementation(async args => {
      if (args[0] === "eval") {
        const outputDir = args[args.indexOf("--output-dir") + 1];
        const dir = path.join(outputDir, "run-1");
        await mkdir(dir, { recursive: true });
        const row = JSON.stringify({ status: "completed", trajectory: { stimulus: { name: "first" } } });
        await writeFile(path.join(dir, "results.jsonl"), `${row}\n${row}\n`);
      }
      return 0;
    });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  test("runs both clients under one policy, snapshots skills and compares exact artifact paths", async () => {
    options.failOnRegression = true;
    const output = await compareClients(options, run);
    expect(run).toHaveBeenCalledTimes(3);
    const evals = run.mock.calls.filter(([args]) => args[0] === "eval");
    expect(evals.map(([args]) => args[args.indexOf("--executor") + 1]).sort())
      .toEqual(["claude-cli", "integration-test-agent-runner"]);
    for (const [args, env] of evals) {
      expect(args).toEqual(expect.arrayContaining([
        "--eval-spec", options.evalSpec, "--workers", "1", "--max-retries", "0",
        "--timeout", "1m", "--runs", "2", "--judge-model", options.judgeModel,
      ]));
      expect(env.VALLY_FAIR_COMPARISON).toBe("true");
      expect(env.VALLY_RUNNER_EXACT_SKILL).toBe("true");
      expect(env.VALLY_PLUGIN_OUTPUT_ROOT).toBe(path.join(output, "plugins"));
    }
    expect(await readFile(path.join(output, "plugins", "azure-skills", "skills", "azure-ai", "SKILL.md"), "utf8"))
      .toContain("Frozen content");
    expect(run.mock.calls[2][0]).toEqual([
      "compare", "--baseline", path.join(output, "copilot", "run-1", "results.jsonl"),
      "--treatment", path.join(output, "claude", "run-1", "results.jsonl"),
      "--judge-model", options.judgeModel, "--output", path.join(output, "comparison.jsonl"), "--fail-on-regression",
    ]);
    const manifest = JSON.parse(await readFile(path.join(output, "comparison-run.json"), "utf8"));
    expect(manifest.status).toBe("completed");
    expect(manifest.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.order.sort()).toEqual(["claude", "copilot"]);
    expect(manifest).not.toHaveProperty("env");
  });

  test("can collect trajectories without invoking the comparison judge", async () => {
    options.skipJudge = true;
    const output = await compareClients(options, run);
    expect(run).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await readFile(path.join(output, "comparison-run.json"), "utf8")).status).toBe("collected");
  });

  test("requires rubric before launching a paid comparison", async () => {
    await writeFile(options.evalSpec, "name: paired\ntags:\n  skill: azure-ai\nstimuli:\n  - name: first\n    prompt: hello\n");
    await expect(compareClients(options, run)).rejects.toThrow("rubric");
    expect(run).not.toHaveBeenCalled();
  });

  test("stops on eval errors and records a failed manifest", async () => {
    run.mockResolvedValueOnce(2);
    await expect(compareClients(options, run)).rejects.toThrow("evaluation failed");
    expect(run).toHaveBeenCalledOnce();
    const [dir] = await readdir(options.outputDir);
    expect(JSON.parse(await readFile(path.join(options.outputDir, dir, "comparison-run.json"), "utf8")).status).toBe("failed");
  });

  test("does not accept missing or filtered-out trials", async () => {
    run.mockImplementationOnce(async args => {
      const dir = path.join(args[args.indexOf("--output-dir") + 1], "run-1");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "results.jsonl"), "{}\n");
      return 0;
    });
    await expect(compareClients(options, run)).rejects.toThrow("Incomplete or mismatched trials");
    expect(run).toHaveBeenCalledOnce();
  });

  test("detects fixture edits between clients and does not judge incomparable runs", async () => {
    const fixture = path.join(root, "input.txt");
    await writeFile(fixture, "original");
    await writeFile(options.evalSpec, [
      "name: paired", "agent_environment:", "  files:", "    - src: input.txt", "      dest: input.txt",
      "tags:", "  skill: azure-ai", "stimuli:", "  - name: first", "    prompt: hello",
      "    rubric:", "      - Answers the question",
    ].join("\n"));
    const normalRun = run.getMockImplementation()!;
    run.mockImplementationOnce(async (args, env) => {
      await normalRun(args, env);
      await writeFile(fixture, "changed");
      return 0;
    });
    await expect(compareClients(options, run)).rejects.toThrow("inputs changed");
    expect(run).toHaveBeenCalledOnce();
  });

  test("propagates a comparison failure or regression", async () => {
    const normalRun = run.getMockImplementation()!;
    run.mockImplementation((args, env) => args[0] === "compare" ? Promise.resolve(1) : normalRun(args, env));
    await expect(compareClients(options, run)).rejects.toThrow("Comparison failed or regressed");
  });

  test("does not guess a latest run when multiple directories exist", async () => {
    await mkdir(path.join(root, "ambiguous", "one"), { recursive: true });
    await mkdir(path.join(root, "ambiguous", "two"));
    await expect(findComparisonResult(path.join(root, "ambiguous"))).rejects.toThrow("exactly one");
  });

  test("collects and pairs the real Vally CLI's JSONL format without model calls", async () => {
    options.skipJudge = true;
    await writeFile(options.evalSpec, (await readFile(options.evalSpec, "utf8"))
      + "\n    graders:\n      - type: output-matches\n        config:\n          pattern: hello\n");
    const cli = createRequire(import.meta.url).resolve("@microsoft/vally-cli/dist/index.js");
    const output = await compareClients(options, async (args, env) => {
      const mockArgs = [...args];
      mockArgs[mockArgs.indexOf("--executor") + 1] = "mock";
      mockArgs.splice(mockArgs.indexOf("--executor-plugin"), 2);
      return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cli, ...mockArgs], {
          cwd: root, env: { ...env, VALLY_TELEMETRY_OPTOUT: "1" }, stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";
        child.stdout.on("data", chunk => { output += String(chunk); });
        child.stderr.on("data", chunk => { output += String(chunk); });
        child.on("error", reject);
        child.on("close", code => code === 0 ? resolve(0) : reject(new Error(output)));
      });
    });
    const manifest = JSON.parse(await readFile(path.join(output, "comparison-run.json"), "utf8"));
    expect(manifest.status).toBe("collected");
    expect(await readFile(manifest.results.copilot, "utf8")).toContain("\"mock\"");
    expect(await readFile(manifest.results.claude, "utf8")).toContain("\"mock\"");
  });
});

describe("comparison arguments", () => {
  const args = [
    "--eval-spec", "eval.yaml", "--copilot-model", "claude-sonnet-5",
    "--claude-model", "claude-sonnet-5", "--judge-model", "gpt-5.5",
  ];
  test("requires explicit models and supplies shared run defaults", () => {
    expect(parseComparisonArgs(args)).toMatchObject({ runs: 5, timeout: "10m", skipJudge: false });
    expect(() => parseComparisonArgs([])).toThrow("--eval-spec");
    expect(parseComparisonArgs(["--help"])).toBeUndefined();
  });
  test.each([
    ["--runs", "0"], ["--runs", "1.5"], ["--timeout", "0s"],
    ["--claude-model", "sonnet"], ["--copilot-model", "a,b"],
    ["--judge-model", "latest"], ["--skip-judge", "--fail-on-regression"],
    ["--workers", "2"],
  ])("rejects ambiguous settings %s %s", (...extra) => {
    expect(() => parseComparisonArgs([...args, ...extra])).toThrow();
  });
});
