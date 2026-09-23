import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
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
const RAW_INPUT_DIR = join(LOG_DIR, "raw-input");
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const HOOKS_SOURCE_DIR = join(REPO_ROOT, "hooks");
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
const PLUGIN_METADATA = {
  copilot: { directory: ".plugin", name: "copilot-test-plugin", version: "1.2.3" },
  cursor: { directory: ".cursor-plugin", name: "cursor-test-plugin", version: "2.3.4" },
  claude: { directory: ".claude-plugin", name: "claude-test-plugin", version: "3.4.5" },
} as const;
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
function runHook(
  shell: ShellCase,
  payload: Record<string, unknown>,
  inputPrefix = "",
  envOverrides: NodeJS.ProcessEnv = {},
): string[] {
  rmSync(CAPTURE_FILE, { force: true });
  rmSync(RAW_INPUT_DIR, { recursive: true, force: true });
  const extension = shell.name === "Bash" ? "sh" : "ps1";
  const scriptPath = join(HOOKS_DIR, `track-telemetry.${extension}`);
  const result = spawnSync(shell.command, shell.args(scriptPath), {
    encoding: "utf8",
    input: `${inputPrefix}${JSON.stringify(payload)}`,
    env: {
      ...process.env,
      PATH: `${BIN_DIR}${delimiter}${process.env.PATH ?? ""}`,
      AZURE_SKILLS_TELEMETRY_LOG_DIR: LOG_DIR,
      COPILOT_CLI: "",
      TELEMETRY_CAPTURE_FILE: CAPTURE_FILE,
      ...envOverrides,
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
function runDispatcher(payload: Record<string, unknown>, inputPrefix = ""): string[] {
  rmSync(CAPTURE_FILE, { force: true });
  rmSync(RAW_INPUT_DIR, { recursive: true, force: true });
  const result = spawnSync(process.execPath, [DISPATCHER_PATH], {
    encoding: "utf8",
    input: `${inputPrefix}${JSON.stringify(payload)}`,
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

function readRawInput(): string {
  const files = readdirSync(RAW_INPUT_DIR);
  expect(files).toHaveLength(1);
  return readFileSync(join(RAW_INPUT_DIR, files[0]), "utf8");
}

// Verifies that a named command argument is followed by the expected value.
function expectArg(args: string[], name: string, value: string): void {
  const index = args.indexOf(name);
  expect(index).toBeGreaterThan(-1);
  expect(args[index + 1]).toBe(value);
}

function expectIsoTimestamp(args: string[]): void {
  const index = args.indexOf("--timestamp");
  expect(index).toBeGreaterThan(-1);
  expect(args[index + 1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
}

beforeAll(() => {
  mkdirSync(BIN_DIR, { recursive: true });
  cpSync(SOURCE_HOOKS_DIR, HOOKS_DIR, { recursive: true });
  for (const metadata of Object.values(PLUGIN_METADATA)) {
    const manifestDir = join(PLUGIN_ROOT, metadata.directory);
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "plugin.json"),
      JSON.stringify({ name: metadata.name, version: metadata.version }),
    );
  }
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

describe("Session start hook manifests", () => {
  it("registers the client-specific lifecycle event shapes", () => {
    const copilot = JSON.parse(
      readFileSync(join(HOOKS_SOURCE_DIR, "copilot-hooks.json"), "utf8"),
    ) as {
      hooks: {
        SessionStart: Array<{ env?: Record<string, string> }>;
      };
    };
    const claude = JSON.parse(
      readFileSync(join(HOOKS_SOURCE_DIR, "claude-hooks.json"), "utf8"),
    ) as {
      hooks: {
        SessionStart: Array<{ hooks: unknown[] }>;
      };
    };
    const cursor = JSON.parse(
      readFileSync(join(HOOKS_SOURCE_DIR, "cursor-hooks.json"), "utf8"),
    ) as {
      hooks: {
        sessionStart: unknown[];
      };
    };

    expect(copilot.hooks.SessionStart).toHaveLength(1);
    expect(copilot.hooks.SessionStart[0].env?.AZURE_SKILLS_HOOK_CLIENT_FAMILY).toBe(
      "copilot-vscode",
    );
    expect(claude.hooks.SessionStart[0].hooks).toHaveLength(1);
    expect(cursor.hooks.sessionStart).toHaveLength(1);
  });
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
    expectArg(args, "--tool-name", "get_azure_bestpractices");
  });

  it("reports Cursor session starts with Cursor plugin metadata", () => {
    const args = runDispatcher({
      hook_event_name: "sessionStart",
      session_id: SESSION_ID,
      cursor_version: "1.7.2",
      is_background_agent: false,
      composer_mode: "agent",
    });

    expectArg(args, "--plugin-name", PLUGIN_METADATA.cursor.name);
    expectArg(args, "--plugin-version", PLUGIN_METADATA.cursor.version);
    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--event-type", "session_start");
    expectArg(args, "--session-id", SESSION_ID);
    expectIsoTimestamp(args);
  });

  it.skipIf(process.platform !== "win32").each([
    { name: "a UTF-8 BOM", prefix: "\uFEFF" },
    {
      name: "Cursor's Windows BOM artifact",
      prefix: "\uFEFF\u2229\u2557\u2510",
    },
  ])("normalizes input prefixed with $name", ({ prefix }) => {
    const payload = {
      ...fixture("cursor-mcp-invocation.json"),
      unicode_probe: "café \u2603",
    };

    const args = runDispatcher(payload, prefix);

    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--tool-name", "get_azure_bestpractices");
    expect(readRawInput()).toBe(JSON.stringify(payload));
  });
});

describe.each(shells)("Session start telemetry hook ($name)", shell => {
  it.each([
    {
      client: "Copilot CLI",
      payload: {
        hook_event_name: "SessionStart",
        session_id: SESSION_ID,
        source: "resume",
      },
      env: {
        AZURE_SKILLS_HOOK_CLIENT_FAMILY: "copilot-vscode",
        COPILOT_CLI: "1",
      },
      expectedClient: "copilot-cli",
      expectedPlugin: PLUGIN_METADATA.copilot,
    },
    {
      client: "VS Code",
      payload: {
        hook_event_name: "SessionStart",
        session_id: SESSION_ID,
        source: "new",
      },
      env: {
        AZURE_SKILLS_HOOK_CLIENT_FAMILY: "copilot-vscode",
      },
      expectedClient: "Visual Studio Code",
      expectedPlugin: PLUGIN_METADATA.copilot,
    },
    {
      client: "Claude Code",
      payload: {
        hook_event_name: "SessionStart",
        session_id: SESSION_ID,
        source: "resume",
      },
      env: {},
      expectedClient: "claude-code",
      expectedPlugin: PLUGIN_METADATA.claude,
    },
    {
      client: "Cursor",
      payload: {
        hook_event_name: "sessionStart",
        session_id: SESSION_ID,
        cursor_version: "1.7.2",
        is_background_agent: false,
        composer_mode: "agent",
      },
      env: {},
      expectedClient: "cursor",
      expectedPlugin: PLUGIN_METADATA.cursor,
    },
  ])(
    "reports $client with client-specific plugin metadata",
    ({ payload, env, expectedClient, expectedPlugin }) => {
      const args = runHook(shell, payload, "", env);

      expect(args.slice(0, 4)).toEqual(["-y", "@azure/mcp@latest", "server", "plugin-telemetry"]);
      expectArg(args, "--plugin-name", expectedPlugin.name);
      expectArg(args, "--plugin-version", expectedPlugin.version);
      expectArg(args, "--client-name", expectedClient);
      expectArg(args, "--event-type", "session_start");
      expectArg(args, "--session-id", SESSION_ID);
      expectIsoTimestamp(args);
    },
  );

  it("does not report when the session ID is missing", () => {
    const args = runHook(shell, {
      hook_event_name: "SessionStart",
      conversation_id: "cursor-conversation-id",
      source: "startup",
    });

    expect(args).toEqual([]);
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

  it.each(["get_azure_bestpractices", "MCP:get_azure_bestpractices"])(
    "reports an Azure MCP invocation without Cursor's display prefix: %s",
    toolName => {
      const payload = fixture("cursor-mcp-invocation.json");
      payload.tool_name = toolName;
      const args = runHook(shell, payload);

      expectArg(args, "--client-name", "cursor");
      expectArg(args, "--event-type", "tool_invocation");
      expectArg(args, "--session-id", SESSION_ID);
      expectArg(args, "--tool-name", "get_azure_bestpractices");
    },
  );

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

const powerShell = shellCandidates.find(shell => shell.name === "PowerShell");

describe.skipIf(!powerShell)("PowerShell telemetry input encoding", () => {
  it.each([
    { name: "without a BOM", prefix: "" },
    { name: "with a BOM", prefix: "\uFEFF" },
    {
      name: "with Cursor's Windows BOM artifact",
      prefix: "\uFEFF\u2229\u2557\u2510",
    },
  ])("reads UTF-8 input $name when invoked directly", ({ prefix }) => {
    const payload = {
      ...fixture("cursor-mcp-invocation.json"),
      unicode_probe: "café \u2603",
    };

    const args = runHook(powerShell!, payload, prefix);

    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--tool-name", "get_azure_bestpractices");
    expect(readRawInput()).toBe(JSON.stringify(payload));
  });
});
