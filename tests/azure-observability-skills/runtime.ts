import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL(".", import.meta.url));
const skills = resolve(directory, "../../plugins/azure-observability-skills/skills");

/** Exercise shipped helpers, never the removed Python test suite or copied code. */
export class Runtime {
  readonly root = mkdtempSync(join(tmpdir(), "observability-test-"));
  private sequence = 0;
  private readonly env: NodeJS.ProcessEnv;

  constructor() {
    // Keep a user's Git config, hooks, worktree and global ignores out of scratch repos.
    this.env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
    );
    Object.assign(this.env, {
      PYTHONDONTWRITEBYTECODE: "1",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: this.file(""),
      GIT_CEILING_DIRECTORIES: tmpdir(),
      GIT_TERMINAL_PROMPT: "0",
    });
  }

  cleanup(): void {
    rmSync(this.root, { recursive: true, force: true });
  }

  file(contents: string | Buffer): string {
    const path = join(this.root, `input-${this.sequence++}.json`);
    writeFileSync(path, contents);
    return path;
  }

  json(value: unknown): string {
    return this.file(JSON.stringify(value));
  }

  run(skill: string, script: string, args: string[]): SpawnSyncReturns<string> {
    return this.python([join(skills, skill, "scripts", script), ...args]);
  }

  python(args: string[]): SpawnSyncReturns<string> {
    const result = spawnSync(process.env.OBS_TEST_PYTHON ?? "python", args, {
      cwd: this.root, env: this.env, encoding: "utf8", timeout: 15_000, maxBuffer: 2_000_000,
    });
    if (result.error) {
      throw result.error;
    }
    return result;
  }

  /** Supply a deterministic UTC clock through the public assess(value, now) API. */
  assess<T>(skill: string, script: string, value: unknown, now: string): T {
    const result = this.python(["-c", [
      "import datetime, importlib.util, json, sys",
      "spec = importlib.util.spec_from_file_location('runtime_helper', sys.argv[1])",
      "api = importlib.util.module_from_spec(spec)",
      "spec.loader.exec_module(api)",
      "with open(sys.argv[2], encoding='utf-8') as stream: value = json.load(stream)",
      "print(json.dumps(api.assess(value, datetime.datetime.fromisoformat(sys.argv[3].replace('Z', '+00:00')))))",
    ].join("\n"), join(skills, skill, "scripts", script), this.json(value), now]);
    if (result.status !== 0) {
      throw new Error(`Helper assessment failed: ${result.stderr}`);
    }
    return JSON.parse(result.stdout) as T;
  }

  git(...args: string[]): SpawnSyncReturns<string> {
    const result = spawnSync("git", ["-C", this.root, ...args], {
      env: this.env, encoding: "utf8", timeout: 15_000,
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`Scratch Git command failed: ${result.stderr}`);
    }
    return result;
  }
}

export function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(directory, "fixtures", name), "utf8")) as T;
}
