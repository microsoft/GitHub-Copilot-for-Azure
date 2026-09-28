import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { compareClients, parseComparisonArgs, type ComparisonOptions } from "../compare-clients.ts";
import { azureRequest, createGroup, deleteGroup, object, text, type RequestJson } from "./azure.ts";

const testsDir = path.resolve(import.meta.dirname, "../..");
const evalSpec = path.join(import.meta.dirname, "hello-world.eval.yaml");
const exec = promisify(execFile);
type RunCommand = (args: string[], env: NodeJS.ProcessEnv) => Promise<number>;
type Trial = {
  client: string; group: string; status: string; evidenceDir: string;
  cleanup?: string; outcome?: unknown; error?: string;
};

export function parseLiveArgs(args: string[]): { comparison: ComparisonOptions; location: string } | undefined {
  const { values } = parseArgs({
    args, options: {
      execute: { type: "boolean", default: false }, help: { type: "boolean", short: "h" },
      "copilot-model": { type: "string" }, "claude-model": { type: "string" }, "judge-model": { type: "string" },
      location: { type: "string", default: "northcentralus" }, timeout: { type: "string", default: "30m" },
      "output-dir": { type: "string", default: path.join(testsDir, "results-comparison") },
    },
  });
  if (values.help) return undefined;
  if (!values.execute) throw new Error("Pass --execute to authorize paid model calls and two temporary Azure deployments with cleanup.");
  if (!/^[a-z0-9]+$/.test(values.location)) throw new Error("Invalid Azure location.");
  const comparison = parseComparisonArgs([
    "--eval-spec", evalSpec, "--copilot-model", values["copilot-model"] ?? "",
    "--claude-model", values["claude-model"] ?? "", "--judge-model", values["judge-model"] ?? "",
    "--runs", "1", "--timeout", values.timeout, "--output-dir", values["output-dir"],
  ]);
  if (!comparison) throw new Error("Missing comparison options.");
  return { comparison, location: values.location };
}

async function defaultSubscription(): Promise<string> {
  // Fixed command: no caller-controlled shell text or token output.
  const result = process.platform === "win32"
    ? await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "az account show --output json --only-show-errors; exit $LASTEXITCODE"], { timeout: 60_000 })
    : await exec("az", ["account", "show", "--output", "json", "--only-show-errors"], { timeout: 60_000 });
  const account = object(JSON.parse(result.stdout), "default Azure account");
  if (account.state !== "Enabled") throw new Error("The default Azure subscription is not enabled.");
  return text(account.id, "default subscription ID");
}

async function runVally(args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const cli = createRequire(import.meta.url).resolve("@microsoft/vally-cli/dist/index.js");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: testsDir, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", code => resolve(code ?? 1));
  });
}

export async function runLive(
  options: ComparisonOptions, location: string,
  dependencies: {
    subscription?: () => Promise<string>; request?: RequestJson; run?: RunCommand;
    compare?: typeof compareClients;
    pause?: (ms: number) => Promise<void>;
  } = {},
): Promise<string> {
  if (options.runs !== 1) throw new Error("Live runner permits exactly one trial per client; rerun for additional isolated trials.");
  const subscription = await (dependencies.subscription ?? defaultSubscription)();
  const request = dependencies.request ?? azureRequest(subscription);
  const run = dependencies.run ?? runVally;
  const compare = dependencies.compare ?? compareClients;
  const owner = randomBytes(6).toString("hex");
  await mkdir(options.outputDir, { recursive: true });
  const directory = await mkdtemp(path.join(options.outputDir, "foundry-live-"));
  const trials: Trial[] = [];
  const manifest = { subscription, location, owner, prompt: "Create and deploy a Microsoft Foundry hosted agent that returns a friendly hello-world greeting",
    status: "running", trials, comparisonDir: "", error: "" };
  const save = () => writeFile(path.join(directory, "live-run.json"), JSON.stringify(manifest, null, 2));
  await save();
  console.log(`Live Foundry artifacts: ${directory}`);
  console.log(`Using default subscription ${subscription}; region ${location}; one isolated group per client, with cleanup.`);
  try {
    manifest.comparisonDir = await compare({ ...options, outputDir: directory }, async (args, env) => {
      if (args[0] !== "eval") return run(args, env);
      const executor = args[args.indexOf("--executor") + 1];
      const client = executor === "claude-cli" ? "claude" : executor === "integration-test-agent-runner" ? "copilot" : undefined;
      if (!client || trials.some(trial => trial.client === client)) throw new Error("Unexpected or repeated live client.");
      const group = `rg-vally-foundry-${owner}-${client}`;
      const evidenceDir = path.join(directory, client);
      await mkdir(evidenceDir);
      const trial: Trial = { client, group, status: "creating", evidenceDir };
      trials.push(trial);
      await save();
      await createGroup(subscription, group, owner, location, request, dependencies.pause);
      const cleanup = async () => {
        trial.cleanup = "deleting";
        await save();
        try {
          await deleteGroup(subscription, group, owner, request, dependencies.pause);
          trial.cleanup = "deleted";
        } catch (error) {
          trial.cleanup = "failed";
          trial.error = error instanceof Error ? error.message : String(error);
          throw error;
        } finally {
          await save();
        }
      };
      try {
        trial.status = "running";
        await save();
        const code = await run([...args, "--grader-plugin", path.join(import.meta.dirname, "outcome-grader.ts")], {
          ...env, VALLY_LIVE_AUTHORIZED: "true", VALLY_LIVE_SUBSCRIPTION: subscription,
          VALLY_LIVE_RESOURCE_GROUP: group, VALLY_LIVE_LOCATION: location, VALLY_LIVE_RUN_ID: owner,
          VALLY_LIVE_AGENT_NAME: "hello-world", VALLY_LIVE_EVIDENCE_DIR: evidenceDir,
          AZURE_SUBSCRIPTION_ID: subscription, AZURE_RESOURCE_GROUP: group, AZURE_RESOURCE_GROUP_NAME: group,
          AZURE_LOCATION: location,
        });
        if (code !== 0) {
          trial.status = "execution-failed";
          trial.error = `Vally exited ${code}.`;
          return code;
        }
        trial.outcome = JSON.parse(await readFile(path.join(evidenceDir, "live-outcome.json"), "utf8")) as unknown;
        trial.status = object(trial.outcome, "live outcome").passed === true ? "verified" : "outcome-failed";
        return code;
      } finally {
        await cleanup();
      }
    });
    if (trials.length !== 2 || trials.some(trial => trial.status !== "verified" || trial.cleanup !== "deleted")) {
      throw new Error("One or both clients failed independent deployment verification. See live-run.json and each live-outcome.json.");
    }
    manifest.status = "completed";
    return directory;
  } catch (error) {
    manifest.status = "failed";
    manifest.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await save();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseLiveArgs(process.argv.slice(2));
    if (!options) console.log("Usage: npm run compare:foundry-live -- --execute --copilot-model <id> --claude-model <id> --judge-model <id> [--location northcentralus] [--timeout 30m]");
    else console.log(`Live comparison complete: ${await runLive(options.comparison, options.location)}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
