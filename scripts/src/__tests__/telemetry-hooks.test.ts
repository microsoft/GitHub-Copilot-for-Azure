import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type CursorPayload = {
  tool_input: {
    file_path?: string;
  };
};

type ShellCase = {
  name: string;
  command: string;
  args: (scriptPath: string) => string[];
};

type DispatcherResult = {
  error?: Error;
  status: number | null;
};

type Dispatcher = {
  getHookCommand: (platform: string) => {
    command: string;
    args: string[];
  };
  run: (
    platform?: string,
    spawn?: (command: string, args: string[], options: { stdio: string }) => DispatcherResult,
  ) => number;
};

const TEST_DIR = mkdtempSync(join(tmpdir(), "azure-telemetry-hooks-"));
const BIN_DIR = join(TEST_DIR, "bin");
const CAPTURE_FILE = join(TEST_DIR, "npx-args.txt");
const LOG_DIR = join(TEST_DIR, "logs");
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SOURCE_HOOKS_DIR = join(REPO_ROOT, "hooks", "scripts");
const PLUGIN_ROOT = join(
  TEST_DIR,
  ".cursor",
  "plugins",
  "cache",
  "cursor-public",
  "azure",
  "revision",
);
const HOOKS_DIR = join(PLUGIN_ROOT, "hooks", "scripts");
const DISPATCHER_PATH = join(HOOKS_DIR, "track-telemetry.js");
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const SESSION_ID = "73e52424-a95d-4e21-b70c-2dffe48fdd86";
const require = createRequire(import.meta.url);
const dispatcher = require(join(SOURCE_HOOKS_DIR, "track-telemetry.js")) as Dispatcher;

const shellCandidates: ShellCase[] = [
  {
    name: "Bash",
    command: "bash",
    args: scriptPath => [scriptPath],
  },
  {
    name: "PowerShell",
    command: process.platform === "win32" ? "powershell.exe" : "pwsh",
    args: scriptPath => ["-NoProfile", "-NonInteractive", "-File", scriptPath],
  },
];

// Returns whether the shell executable can be launched in the current environment.
function isCommandAvailable(command: string): boolean {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).error === undefined;
}

const shells = shellCandidates.filter(shell => isCommandAvailable(shell.command));

// Loads a Cursor hook payload fixture by file name.
function fixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8")) as Record<string, unknown>;
}

// Creates a representative Cursor plugin cache with a versioned test skill.
function createCursorSkillCache(): string {
  const skillRoot = join(PLUGIN_ROOT, "skills", "azure-cost");
  mkdirSync(join(skillRoot, "cost-query"), { recursive: true });
  writeFileSync(
    join(skillRoot, "SKILL.md"),
    "---\nmetadata:\n  version: \"1.2.3\"\n---\n# Azure Cost\n",
  );
  writeFileSync(join(skillRoot, "cost-query", "guardrails.md"), "# Guardrails\n");
  return skillRoot;
}

// Converts Windows fixture paths for Bash, which represents the Unix dispatcher branch.
function pathForShell(shell: ShellCase, filePath: string): string {
  if (shell.name !== "Bash" || process.platform !== "win32") {
    return filePath;
  }

  const result = spawnSync("bash", ["-lc", 'cygpath -u "$1"', "bash", filePath], {
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

// Runs a telemetry hook with the payload and returns its captured npx arguments.
function runHook(shell: ShellCase, payload: Record<string, unknown>): string[] {
  rmSync(CAPTURE_FILE, { force: true });
  const extension = shell.name === "Bash" ? "sh" : "ps1";
  const scriptPath = join(HOOKS_DIR, `track-telemetry.${extension}`);
  const result = spawnSync(shell.command, shell.args(scriptPath), {
    encoding: "utf8",
    input: JSON.stringify(payload),
    env: {
      ...process.env,
      PATH: `${BIN_DIR}${delimiter}${process.env.PATH ?? ""}`,
      AZURE_SKILLS_TELEMETRY_LOG_DIR: LOG_DIR,
      COPILOT_CLI: "",
      TELEMETRY_CAPTURE_FILE: CAPTURE_FILE,
    },
  });

  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe('{"continue":true}');
  if (!existsSync(CAPTURE_FILE)) {
    return [];
  }
  return readFileSync(CAPTURE_FILE, "utf8").trim().split(/\r?\n/);
}

// Runs telemetry through the Node dispatcher using the current platform's shell.
function runDispatcher(payload: Record<string, unknown>): string[] {
  rmSync(CAPTURE_FILE, { force: true });
  const result = spawnSync(process.execPath, [DISPATCHER_PATH], {
    encoding: "utf8",
    input: JSON.stringify(payload),
    env: {
      ...process.env,
      PATH: `${BIN_DIR}${delimiter}${process.env.PATH ?? ""}`,
      AZURE_SKILLS_TELEMETRY_LOG_DIR: LOG_DIR,
      COPILOT_CLI: "",
      TELEMETRY_CAPTURE_FILE: CAPTURE_FILE,
    },
  });

  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe('{"continue":true}');
  return readFileSync(CAPTURE_FILE, "utf8").trim().split(/\r?\n/);
}

// Verifies that a named command argument is followed by the expected value.
function expectArg(args: string[], name: string, value: string): void {
  const index = args.indexOf(name);
  expect(index).toBeGreaterThan(-1);
  expect(args[index + 1]).toBe(value);
}

beforeAll(() => {
  mkdirSync(BIN_DIR, { recursive: true });
  cpSync(SOURCE_HOOKS_DIR, HOOKS_DIR, { recursive: true });
  writeFileSync(
    join(BIN_DIR, "npx"),
    "#!/usr/bin/env bash\nprintf '%s\\n' \"$@\" > \"$TELEMETRY_CAPTURE_FILE\"\n",
  );
  chmodSync(join(BIN_DIR, "npx"), 0o755);
  writeFileSync(
    join(BIN_DIR, "npx.cmd"),
    "@echo off\r\n:loop\r\nif \"%~1\"==\"\" goto end\r\n>>\"%TELEMETRY_CAPTURE_FILE%\" echo %~1\r\nshift\r\ngoto loop\r\n:end\r\n",
  );
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("Cursor telemetry dispatcher", () => {
  it.each([
    {
      platform: "win32",
      command: "powershell.exe",
      script: "track-telemetry.ps1",
      expectedArgs: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File"],
    },
    {
      platform: "linux",
      command: "bash",
      script: "track-telemetry.sh",
      expectedArgs: [],
    },
    {
      platform: "darwin",
      command: "bash",
      script: "track-telemetry.sh",
      expectedArgs: [],
    },
  ])("selects $command on $platform", ({ platform, command, script, expectedArgs }) => {
    const selected = dispatcher.getHookCommand(platform);

    expect(selected.command).toBe(command);
    expect(selected.args.slice(0, -1)).toEqual(expectedArgs);
    expect(basename(selected.args.at(-1) ?? "")).toBe(script);
  });

  it("propagates the child exit status", () => {
    expect(dispatcher.run("linux", () => ({ status: 17 }))).toBe(17);
  });

  it("returns failure when the child process cannot start", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(dispatcher.run("linux", () => ({ error: new Error("missing shell"), status: null }))).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("Failed to run telemetry hook: missing shell");

    errorSpy.mockRestore();
  });

  it("passes Cursor payloads and responses through the selected shell", () => {
    const args = runDispatcher(fixture("cursor-mcp-invocation.json"));

    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--event-type", "tool_invocation");
    expectArg(args, "--session-id", SESSION_ID);
    expectArg(args, "--tool-name", "MCP:get_azure_bestpractices");
  });
});

describe.each(shells)("Cursor telemetry hook ($name)", shell => {
  const skillRoot = createCursorSkillCache();

  it("reports a SKILL.md read as a skill invocation", () => {
    const payload = fixture("cursor-skill-read.json") as CursorPayload & Record<string, unknown>;
    payload.tool_input.file_path = pathForShell(shell, join(skillRoot, "SKILL.md"));

    const args = runHook(shell, payload);

    expect(args.slice(0, 4)).toEqual(["-y", "@azure/mcp@latest", "server", "plugin-telemetry"]);
    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--event-type", "skill_invocation");
    expectArg(args, "--session-id", SESSION_ID);
    expectArg(args, "--skill-name", "azure-cost");
    expectArg(args, "--skill-version", "1.2.3");
    expect(args).not.toContain("--file-reference");
  });

  it("reports a bundled file read as a reference read", () => {
    const payload = fixture("cursor-reference-read.json") as CursorPayload & Record<string, unknown>;
    payload.tool_input.file_path = pathForShell(
      shell,
      join(skillRoot, "cost-query", "guardrails.md"),
    );

    const args = runHook(shell, payload);

    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--event-type", "reference_file_read");
    expectArg(args, "--session-id", SESSION_ID);
    expectArg(args, "--skill-version", "1.2.3");
    expectArg(args, "--file-reference", "azure-cost\\cost-query\\guardrails.md");
    expect(args).not.toContain("--skill-name");
  });

  it("reports an Azure MCP invocation", () => {
    const args = runHook(shell, fixture("cursor-mcp-invocation.json"));

    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--event-type", "tool_invocation");
    expectArg(args, "--session-id", SESSION_ID);
    expectArg(args, "--tool-name", "MCP:get_azure_bestpractices");
  });

  it("does not report a non-Azure MCP invocation", () => {
    const payload = fixture("cursor-mcp-invocation.json");
    payload.mcp_server_name = "github";

    expect(runHook(shell, payload)).toEqual([]);
  });

  it("does not report MCP calls from the generic postToolUse event", () => {
    const payload = fixture("cursor-mcp-invocation.json");
    payload.hook_event_name = "postToolUse";
    payload.tool_name = "MCP:get_azure_bestpractices";
    delete payload.mcp_server_name;

    expect(runHook(shell, payload)).toEqual([]);
  });
});
