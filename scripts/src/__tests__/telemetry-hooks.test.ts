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

type ClientCase = {
  id: "copilot" | "claude" | "cursor" | "vscode";
  expectedClientName: string;
  pluginRoot: string;
  inputContainer: "toolArgs" | "tool_input";
  pathField: "path" | "file_path" | "filePath";
  expectedToolName: string;
};

const TEST_DIR = mkdtempSync(join(tmpdir(), "azure-telemetry-hooks-"));
const BIN_DIR = join(TEST_DIR, "bin");
const CAPTURE_FILE = join(TEST_DIR, "npx-args.txt");
const LOG_DIR = join(TEST_DIR, "logs");
const RAW_INPUT_DIR = join(LOG_DIR, "raw-input");
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SOURCE_HOOKS_DIR = join(REPO_ROOT, "hooks", "scripts");
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const SESSION_ID = "73e52424-a95d-4e21-b70c-2dffe48fdd86";
const PLUGIN_VERSION = "4.5.6";
const require = createRequire(import.meta.url);
const dispatcher = require(join(SOURCE_HOOKS_DIR, "track-telemetry.js")) as Dispatcher;

const clientCases: ClientCase[] = [
  {
    id: "copilot",
    expectedClientName: "copilot-cli",
    pluginRoot: join(TEST_DIR, ".copilot", "installed-plugins", "test-catalog", "azure"),
    inputContainer: "toolArgs",
    pathField: "path",
    expectedToolName: "azure-get_azure_bestpractices",
  },
  {
    id: "claude",
    expectedClientName: "claude-code",
    pluginRoot: join(
      TEST_DIR,
      ".claude",
      "plugins",
      "cache",
      "azure-skills",
      "azure",
      "1.2.3",
    ),
    inputContainer: "tool_input",
    pathField: "file_path",
    expectedToolName: "mcp__plugin_azure_azure__get_azure_bestpractices",
  },
  {
    id: "cursor",
    expectedClientName: "cursor",
    pluginRoot: join(
      TEST_DIR,
      ".cursor",
      "plugins",
      "cache",
      "cursor-public",
      "azure",
      "revision",
    ),
    inputContainer: "tool_input",
    pathField: "file_path",
    expectedToolName: "get_azure_bestpractices",
  },
  {
    id: "vscode",
    expectedClientName: "Visual Studio Code",
    pluginRoot: join(
      TEST_DIR,
      ".vscode",
      "agent-plugins",
      "github.com",
      "microsoft",
      "azure-skills",
      ".github",
      "plugins",
      "azure-skills",
    ),
    inputContainer: "tool_input",
    pathField: "filePath",
    expectedToolName: "mcp_azure_mcp_get_azure_bestpractices",
  },
];

const cursorCase = clientCases.find(client => client.id === "cursor")!;
const crossClientInstallationCases = clientCases.map((client, index) => ({
  client,
  installation: clientCases[(index + 1) % clientCases.length],
}));
const LOCAL_PLUGIN_ROOT = join(TEST_DIR, "local-plugin");
const localPluginCase: ClientCase = {
  ...cursorCase,
  pluginRoot: LOCAL_PLUGIN_ROOT,
};
const DISPATCHER_PATH = join(cursorCase.pluginRoot, "hooks", "scripts", "track-telemetry.js");
const FOREIGN_CURSOR_ROOT = join(
  TEST_DIR,
  ".cursor",
  "plugins",
  "cache",
  "cursor-public",
  "azure",
  "other-revision",
);

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

function isCommandAvailable(command: string): boolean {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).error === undefined;
}

const shells = shellCandidates.filter(shell => isCommandAvailable(shell.command));

function fixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8")) as Record<string, unknown>;
}

function createPluginCache(pluginRoot: string): string {
  const skillRoot = join(pluginRoot, "skills", "azure-cost");
  mkdirSync(join(skillRoot, "cost-query"), { recursive: true });
  mkdirSync(join(pluginRoot, ".plugin"), { recursive: true });
  writeFileSync(
    join(skillRoot, "SKILL.md"),
    "---\nmetadata:\n  version: \"1.2.3\"\n---\n# Azure Cost\n",
  );
  writeFileSync(join(skillRoot, "cost-query", "guardrails.md"), "# Guardrails\n");
  writeFileSync(
    join(pluginRoot, ".plugin", "plugin.json"),
    JSON.stringify({ version: PLUGIN_VERSION }),
  );
  return skillRoot;
}

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

function setPayloadPath(
  shell: ShellCase,
  client: ClientCase,
  payload: Record<string, unknown>,
  filePath: string,
): void {
  const toolInput = payload[client.inputContainer] as Record<string, unknown>;
  toolInput[client.pathField] = pathForShell(shell, filePath);
}

function setPayloadToolName(
  client: ClientCase,
  payload: Record<string, unknown>,
  toolName: string,
): void {
  if (client.id === "copilot") {
    payload.toolName = toolName;
  } else {
    payload.tool_name = toolName;
  }
}

function runHook(
  shell: ShellCase,
  client: ClientCase,
  payload: Record<string, unknown>,
  inputPrefix = "",
  extraEnv: NodeJS.ProcessEnv = {},
): string[] {
  rmSync(CAPTURE_FILE, { force: true });
  rmSync(RAW_INPUT_DIR, { recursive: true, force: true });
  const extension = shell.name === "Bash" ? "sh" : "ps1";
  const nativeScriptPath = join(client.pluginRoot, "hooks", "scripts", `track-telemetry.${extension}`);
  const scriptPath = pathForShell(shell, nativeScriptPath);
  const result = spawnSync(shell.command, shell.args(scriptPath), {
    encoding: "utf8",
    input: `${inputPrefix}${JSON.stringify(payload)}`,
    env: {
      ...process.env,
      PATH: `${BIN_DIR}${delimiter}${process.env.PATH ?? ""}`,
      AZURE_SKILLS_TELEMETRY_LOG_DIR: LOG_DIR,
      COPILOT_CLI: "",
      TELEMETRY_CAPTURE_FILE: CAPTURE_FILE,
      ...extraEnv,
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
  const files = readFileNames(RAW_INPUT_DIR);
  expect(files).toHaveLength(1);
  return readFileSync(join(RAW_INPUT_DIR, files[0]), "utf8");
}

function readFileNames(path: string): string[] {
  return existsSync(path) ? readdirSync(path) : [];
}

function expectArg(args: string[], name: string, value: string): void {
  const index = args.indexOf(name);
  expect(index).toBeGreaterThan(-1);
  expect(args[index + 1]).toBe(value);
}

function makeNonAzurePayload(client: ClientCase): Record<string, unknown> {
  const payload = fixture(`${client.id}-mcp-invocation.json`);
  switch (client.id) {
    case "copilot":
      payload.toolName = "github-search";
      break;
    case "claude":
      payload.tool_name = "mcp__plugin_github_github__search";
      break;
    case "cursor":
      payload.mcp_server_name = "github";
      break;
    case "vscode":
      payload.tool_name = "mcp_github_search";
      break;
  }
  return payload;
}

beforeAll(() => {
  mkdirSync(BIN_DIR, { recursive: true });
  for (const client of clientCases) {
    createPluginCache(client.pluginRoot);
    cpSync(SOURCE_HOOKS_DIR, join(client.pluginRoot, "hooks", "scripts"), { recursive: true });
  }
  createPluginCache(LOCAL_PLUGIN_ROOT);
  cpSync(SOURCE_HOOKS_DIR, join(LOCAL_PLUGIN_ROOT, "hooks", "scripts"), { recursive: true });
  createPluginCache(FOREIGN_CURSOR_ROOT);

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
    expectArg(args, "--tool-name", "get_azure_bestpractices");
  });

  it.skipIf(process.platform !== "win32")(
    "normalizes BOM-prefixed UTF-8 input on Windows",
    () => {
      const payload = {
        ...fixture("cursor-mcp-invocation.json"),
        unicode_probe: "café \u2603",
      };

      const args = runDispatcher(payload, "\uFEFF");

      expectArg(args, "--client-name", "cursor");
      expectArg(args, "--tool-name", "get_azure_bestpractices");
      expect(readRawInput()).toBe(JSON.stringify(payload));
    },
  );
});

describe.each(shells)("Telemetry hook ($name)", shell => {
  it.each(clientCases)("reports a $id SKILL.md read as a skill invocation", client => {
    const payload = fixture(`${client.id}-skill-read.json`);
    setPayloadPath(shell, client, payload, join(client.pluginRoot, "skills", "azure-cost", "SKILL.md"));

    const args = runHook(shell, client, payload);

    expect(args.slice(0, 4)).toEqual(["-y", "@azure/mcp@latest", "server", "plugin-telemetry"]);
    expectArg(args, "--client-name", client.expectedClientName);
    expectArg(args, "--event-type", "skill_invocation");
    expectArg(args, "--session-id", SESSION_ID);
    expectArg(args, "--skill-name", "azure-cost");
    expectArg(args, "--skill-version", "1.2.3");
    expectArg(args, "--plugin-version", PLUGIN_VERSION);
    expect(args).not.toContain("--file-reference");
  });

  it.each(clientCases)("reports a $id bundled file read as a reference read", client => {
    const payload = fixture(`${client.id}-reference-read.json`);
    setPayloadPath(
      shell,
      client,
      payload,
      join(client.pluginRoot, "skills", "azure-cost", "cost-query", "guardrails.md"),
    );

    const args = runHook(shell, client, payload);

    expectArg(args, "--client-name", client.expectedClientName);
    expectArg(args, "--event-type", "reference_file_read");
    expectArg(args, "--session-id", SESSION_ID);
    expectArg(args, "--skill-version", "1.2.3");
    expectArg(args, "--file-reference", "azure-cost\\cost-query\\guardrails.md");
    expect(args).not.toContain("--skill-name");
  });

  it.each(
    clientCases.flatMap(client =>
      ["view", "Read", "read_file"].map(toolName => ({ client, toolName })),
    ),
  )(
    "accepts $toolName as a file-read tool for $client.id payloads",
    ({ client, toolName }) => {
      const payload = fixture(`${client.id}-reference-read.json`);
      setPayloadToolName(client, payload, toolName);
      setPayloadPath(
        shell,
        client,
        payload,
        join(client.pluginRoot, "skills", "azure-cost", "cost-query", "guardrails.md"),
      );

      const args = runHook(shell, client, payload);

      expectArg(args, "--client-name", client.expectedClientName);
      expectArg(args, "--event-type", "reference_file_read");
      expectArg(args, "--file-reference", "azure-cost\\cost-query\\guardrails.md");
    },
  );

  it.each(crossClientInstallationCases)(
    "reports a $client.id skill read from a $installation.id installation",
    ({ client, installation }) => {
      const payload = fixture(`${client.id}-skill-read.json`);
      setPayloadPath(
        shell,
        client,
        payload,
        join(installation.pluginRoot, "skills", "azure-cost", "SKILL.md"),
      );

      const args = runHook(shell, installation, payload);

      expectArg(args, "--client-name", client.expectedClientName);
      expectArg(args, "--event-type", "skill_invocation");
      expectArg(args, "--skill-name", "azure-cost");
      expectArg(args, "--skill-version", "1.2.3");
    },
  );

  it.each(clientCases)("reports a $id Azure MCP invocation", client => {
    const args = runHook(shell, client, fixture(`${client.id}-mcp-invocation.json`));

    expectArg(args, "--client-name", client.expectedClientName);
    expectArg(args, "--event-type", "tool_invocation");
    expectArg(args, "--session-id", SESSION_ID);
    expectArg(args, "--tool-name", client.expectedToolName);
  });

  it.each(clientCases)("does not report a non-Azure $id tool invocation", client => {
    expect(runHook(shell, client, makeNonAzurePayload(client))).toEqual([]);
  });

  it("strips Claude's skill namespace for direct skill calls", () => {
    const claude = clientCases.find(client => client.id === "claude")!;
    const payload = {
      tool_name: "Skill",
      tool_input: { skill: "azure:azure-cost" },
      tool_use_id: "tool-skill",
      session_id: SESSION_ID,
      hook_event_name: "PostToolUse",
    };

    const args = runHook(shell, claude, payload);

    expectArg(args, "--client-name", "claude-code");
    expectArg(args, "--skill-name", "azure-cost");
    expectArg(args, "--skill-version", "1.2.3");
  });

  it("distinguishes VS Code Insiders", () => {
    const vscode = clientCases.find(client => client.id === "vscode")!;
    const payload = fixture("vscode-mcp-invocation.json");
    payload.transcript_path =
      "C:\\Users\\test\\AppData\\Roaming\\Code - Insiders\\User\\workspaceStorage\\transcript.json";

    const args = runHook(shell, vscode, payload);

    expectArg(args, "--client-name", "Visual Studio Code - Insiders");
  });

  it("does not report paths owned by another installed copy", () => {
    const payload = fixture("cursor-skill-read.json");
    setPayloadPath(shell, cursorCase, payload, join(FOREIGN_CURSOR_ROOT, "skills", "azure-cost", "SKILL.md"));

    expect(runHook(shell, cursorCase, payload)).toEqual([]);
  });

  it.each([
    { name: "forward slash", separator: "/" },
    { name: "backslash", separator: "\\" },
  ])("recognizes a local plugin root ending with a $name", ({ separator }) => {
    const payload = fixture("cursor-skill-read.json");
    setPayloadPath(
      shell,
      cursorCase,
      payload,
      join(LOCAL_PLUGIN_ROOT, "skills", "azure-cost", "SKILL.md"),
    );
    const configuredRoot = `${pathForShell(shell, LOCAL_PLUGIN_ROOT)}${separator}`;

    const args = runHook(shell, localPluginCase, payload, "", {
      AZURE_SKILLS_PLUGIN_ROOT: configuredRoot,
    });

    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--event-type", "skill_invocation");
    expectArg(args, "--skill-name", "azure-cost");
  });
});

const powerShell = shellCandidates.find(shell => shell.name === "PowerShell");

describe.skipIf(!powerShell)("PowerShell telemetry input encoding", () => {
  it.each([
    { name: "without a BOM", prefix: "" },
    { name: "with a BOM", prefix: "\uFEFF" },
  ])("reads UTF-8 input $name when invoked directly", ({ prefix }) => {
    const payload = {
      ...fixture("cursor-mcp-invocation.json"),
      unicode_probe: "café \u2603",
    };

    const args = runHook(powerShell!, cursorCase, payload, prefix);

    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--tool-name", "get_azure_bestpractices");
    expect(readRawInput()).toBe(JSON.stringify(payload));
  });
});
