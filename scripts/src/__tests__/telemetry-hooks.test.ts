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

type HookRunOptions = {
  env?: Record<string, string>;
  hooksDir?: string;
};

type PluginInstall = {
  hooksDir: string;
  root: string;
  skillRoot: string;
};

type SkillPathCase = {
  clientName: string;
  install: PluginInstall;
  payload: (filePath: string) => Record<string, unknown>;
  runEnv?: Record<string, string>;
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
const AZURE_CURSOR_ROOT = join(
  TEST_DIR,
  ".cursor",
  "plugins",
  "cache",
  "cursor-public",
  "azure",
  "revision",
);
const KUSTO_CURSOR_ROOT = join(
  TEST_DIR,
  ".cursor",
  "plugins",
  "cache",
  "cursor-public",
  "azure-kusto-graph-skills",
  "revision",
);
const AKS_COPILOT_ROOT = join(
  TEST_DIR,
  ".copilot",
  "installed-plugins",
  "azure-skills",
  "aks-skills",
);
const AKS_CLAUDE_ROOT = join(
  TEST_DIR,
  ".claude",
  "plugins",
  "cache",
  "azure-skills",
  "aks-skills",
  "2.3.4",
);
const AKS_CURSOR_ROOT = join(
  TEST_DIR,
  ".cursor",
  "plugins",
  "cache",
  "cursor-public",
  "aks-skills",
  "revision",
);
const AKS_VSCODE_ROOT = join(
  TEST_DIR,
  ".vscode",
  "agent-plugins",
  "github.com",
  "microsoft",
  "azure-skills",
  ".github",
  "plugins",
  "aks-skills",
);
const DISPATCHER_PATH = join(AZURE_CURSOR_ROOT, "hooks", "scripts", "track-telemetry.js");
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const SESSION_ID = "73e52424-a95d-4e21-b70c-2dffe48fdd86";
const require = createRequire(import.meta.url);
const dispatcher = require(join(SOURCE_HOOKS_DIR, "track-telemetry.js")) as Dispatcher;
let azureCursorInstall: PluginInstall;
let kustoCursorInstall: PluginInstall;
let aksCopilotInstall: PluginInstall;
let aksClaudeInstall: PluginInstall;
let aksCursorInstall: PluginInstall;
let aksVscodeInstall: PluginInstall;

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

// Creates a representative installed plugin with bundled hooks and a stamped skill.
function createPluginInstall(
  root: string,
  pluginName: string,
  pluginVersion: string,
  skillName: string,
  skillVersion: string,
  ownsAzureMcp: boolean,
): PluginInstall {
  const hooksDir = join(root, "hooks", "scripts");
  const skillRoot = join(root, "skills", skillName);
  cpSync(SOURCE_HOOKS_DIR, hooksDir, { recursive: true });
  mkdirSync(join(root, ".plugin"), { recursive: true });
  mkdirSync(join(skillRoot, "cost-query"), { recursive: true });
  writeFileSync(
    join(root, ".plugin", "plugin.json"),
    JSON.stringify({ name: pluginName, version: pluginVersion }),
  );
  writeFileSync(
    join(root, ".mcp.json"),
    JSON.stringify({
      mcpServers: ownsAzureMcp
        ? { azure: { command: "npx", args: ["-y", "@azure/mcp@latest", "server", "start"] } }
        : {},
    }),
  );
  writeFileSync(
    join(skillRoot, "SKILL.md"),
    `---\nmetadata:\n  version: "${skillVersion}"\n---\n# ${skillName}\n`,
  );
  writeFileSync(join(skillRoot, "cost-query", "guardrails.md"), "# Guardrails\n");
  return { hooksDir, root, skillRoot };
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
  options: HookRunOptions = {},
): string[] {
  rmSync(CAPTURE_FILE, { force: true });
  const extension = shell.name === "Bash" ? "sh" : "ps1";
  const scriptPath = join(
    options.hooksDir ?? azureCursorInstall.hooksDir,
    `track-telemetry.${extension}`,
  );
  const result = spawnSync(shell.command, shell.args(scriptPath), {
    encoding: "utf8",
    input: JSON.stringify(payload),
    env: {
      ...process.env,
      PATH: `${BIN_DIR}${delimiter}${process.env.PATH ?? ""}`,
      AZURE_SKILLS_TELEMETRY_LOG_DIR: LOG_DIR,
      COPILOT_CLI: "",
      TELEMETRY_CAPTURE_FILE: CAPTURE_FILE,
      ...options.env,
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
  azureCursorInstall = createPluginInstall(
    AZURE_CURSOR_ROOT,
    "azure",
    "9.8.7",
    "azure-cost",
    "1.2.3",
    true,
  );
  kustoCursorInstall = createPluginInstall(
    KUSTO_CURSOR_ROOT,
    "azure-kusto-graph-skills",
    "8.7.6",
    "kusto-query",
    "4.5.6",
    true,
  );
  aksCopilotInstall = createPluginInstall(
    AKS_COPILOT_ROOT,
    "aks-skills",
    "2.3.4",
    "aks-troubleshooting",
    "5.6.7",
    false,
  );
  aksClaudeInstall = createPluginInstall(
    AKS_CLAUDE_ROOT,
    "aks-skills",
    "2.3.4",
    "aks-troubleshooting",
    "5.6.7",
    false,
  );
  aksCursorInstall = createPluginInstall(
    AKS_CURSOR_ROOT,
    "aks-skills",
    "2.3.4",
    "aks-troubleshooting",
    "5.6.7",
    false,
  );
  aksVscodeInstall = createPluginInstall(
    AKS_VSCODE_ROOT,
    "aks-skills",
    "2.3.4",
    "aks-troubleshooting",
    "5.6.7",
    false,
  );
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
  it("preserves Azure SKILL.md telemetry", () => {
    const payload = fixture("cursor-skill-read.json") as CursorPayload & Record<string, unknown>;
    payload.tool_input.file_path = pathForShell(
      shell,
      join(azureCursorInstall.skillRoot, "SKILL.md"),
    );

    const args = runHook(shell, payload, { hooksDir: azureCursorInstall.hooksDir });

    expect(args.slice(0, 4)).toEqual(["-y", "@azure/mcp@latest", "server", "plugin-telemetry"]);
    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--event-type", "skill_invocation");
    expectArg(args, "--session-id", SESSION_ID);
    expectArg(args, "--skill-name", "azure-cost");
    expectArg(args, "--skill-version", "1.2.3");
    expectArg(args, "--plugin-version", "9.8.7");
    expect(args).not.toContain("--file-reference");
  });

  it("preserves Azure bundled reference telemetry", () => {
    const payload = fixture("cursor-reference-read.json") as CursorPayload & Record<string, unknown>;
    payload.tool_input.file_path = pathForShell(
      shell,
      join(azureCursorInstall.skillRoot, "cost-query", "guardrails.md"),
    );

    const args = runHook(shell, payload, { hooksDir: azureCursorInstall.hooksDir });

    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--event-type", "reference_file_read");
    expectArg(args, "--session-id", SESSION_ID);
    expectArg(args, "--skill-version", "1.2.3");
    expectArg(args, "--plugin-version", "9.8.7");
    expectArg(args, "--file-reference", "azure-cost\\cost-query\\guardrails.md");
    expect(args).not.toContain("--skill-name");
  });

  it("reports AKS SKILL.md reads from supported client install paths", () => {
    const cases: SkillPathCase[] = [
      {
        clientName: "copilot-cli",
        install: aksCopilotInstall,
        payload: filePath => ({
          toolName: "view",
          sessionId: SESSION_ID,
          toolArgs: { path: filePath },
        }),
        runEnv: { COPILOT_CLI: "1" },
      },
      {
        clientName: "claude-code",
        install: aksClaudeInstall,
        payload: filePath => ({
          hook_event_name: "PostToolUse",
          tool_name: "Read",
          session_id: SESSION_ID,
          tool_input: { file_path: filePath },
          tool_use_id: "toolu_aks",
        }),
      },
      {
        clientName: "cursor",
        install: aksCursorInstall,
        payload: filePath => ({
          ...fixture("cursor-skill-read.json"),
          tool_input: { file_path: filePath },
        }),
      },
      {
        clientName: "Visual Studio Code",
        install: aksVscodeInstall,
        payload: filePath => ({
          hook_event_name: "PostToolUse",
          tool_name: "read_file",
          session_id: SESSION_ID,
          tool_input: { filePath },
          tool_use_id: "tool__vscode",
          transcript_path: "/Users/test/Library/Application Support/Code/User/session.json",
        }),
      },
    ];

    for (const testCase of cases) {
      const skillPath = pathForShell(shell, join(testCase.install.skillRoot, "SKILL.md"));
      const args = runHook(shell, testCase.payload(skillPath), {
        env: testCase.runEnv,
        hooksDir: testCase.install.hooksDir,
      });

      expectArg(args, "--client-name", testCase.clientName);
      expectArg(args, "--event-type", "skill_invocation");
      expectArg(args, "--skill-name", "aks-troubleshooting");
      expectArg(args, "--skill-version", "5.6.7");
      expectArg(args, "--plugin-version", "2.3.4");
    }
  });

  it("reports AKS reference reads with stamped versions", () => {
    const payload = fixture("cursor-reference-read.json") as CursorPayload & Record<string, unknown>;
    payload.tool_input.file_path = pathForShell(
      shell,
      join(aksCursorInstall.skillRoot, "cost-query", "guardrails.md"),
    );

    const args = runHook(shell, payload, { hooksDir: aksCursorInstall.hooksDir });

    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--event-type", "reference_file_read");
    expectArg(args, "--skill-version", "5.6.7");
    expectArg(args, "--plugin-version", "2.3.4");
    expectArg(
      args,
      "--file-reference",
      "aks-troubleshooting\\cost-query\\guardrails.md",
    );
    expect(args).not.toContain("--skill-name");
  });

  it("reports native namespaced AKS skill invocations", () => {
    const args = runHook(
      shell,
      {
        hook_event_name: "PostToolUse",
        tool_name: "Skill",
        session_id: SESSION_ID,
        tool_input: { skill: "aks-skills:aks-troubleshooting" },
        tool_use_id: "toolu_aks",
      },
      { hooksDir: aksClaudeInstall.hooksDir },
    );

    expectArg(args, "--client-name", "claude-code");
    expectArg(args, "--event-type", "skill_invocation");
    expectArg(args, "--skill-name", "aks-troubleshooting");
    expectArg(args, "--skill-version", "5.6.7");
    expectArg(args, "--plugin-version", "2.3.4");
  });

  it("preserves the native Azure skill namespace", () => {
    const payload = {
      hook_event_name: "PostToolUse",
      tool_name: "Skill",
      session_id: SESSION_ID,
      tool_input: { skill: "azure:azure-cost" },
      tool_use_id: "toolu_azure",
    };
    const azureArgs = runHook(shell, payload, {
      hooksDir: azureCursorInstall.hooksDir,
    });

    expectArg(azureArgs, "--skill-name", "azure-cost");
    expectArg(azureArgs, "--skill-version", "1.2.3");
    expectArg(azureArgs, "--plugin-version", "9.8.7");
    expect(
      runHook(shell, payload, { hooksDir: aksCursorInstall.hooksDir }),
    ).toEqual([]);
  });

  it("does not strip another plugin namespace from an AKS skill name", () => {
    const args = runHook(
      shell,
      {
        hook_event_name: "PostToolUse",
        tool_name: "Skill",
        session_id: SESSION_ID,
        tool_input: { skill: "azure:aks-troubleshooting" },
        tool_use_id: "toolu_aks",
      },
      { hooksDir: aksClaudeInstall.hooksDir },
    );

    expect(args).toEqual([]);
  });

  it("keeps co-installed skill reads owned by exactly one plugin hook", () => {
    const azurePayload = fixture("cursor-skill-read.json") as CursorPayload &
      Record<string, unknown>;
    azurePayload.tool_input.file_path = pathForShell(
      shell,
      join(azureCursorInstall.skillRoot, "SKILL.md"),
    );

    const azureArgs = runHook(shell, azurePayload, {
      hooksDir: azureCursorInstall.hooksDir,
    });
    expectArg(azureArgs, "--skill-name", "azure-cost");
    expect(
      runHook(shell, azurePayload, { hooksDir: kustoCursorInstall.hooksDir }),
    ).toEqual([]);
    expect(
      runHook(shell, azurePayload, { hooksDir: aksCursorInstall.hooksDir }),
    ).toEqual([]);

    const kustoPayload = fixture("cursor-skill-read.json") as CursorPayload &
      Record<string, unknown>;
    kustoPayload.tool_input.file_path = pathForShell(
      shell,
      join(kustoCursorInstall.skillRoot, "SKILL.md"),
    );

    const kustoArgs = runHook(shell, kustoPayload, {
      hooksDir: kustoCursorInstall.hooksDir,
    });
    expectArg(kustoArgs, "--skill-name", "kusto-query");
    expect(
      runHook(shell, kustoPayload, { hooksDir: azureCursorInstall.hooksDir }),
    ).toEqual([]);
    expect(
      runHook(shell, kustoPayload, { hooksDir: aksCursorInstall.hooksDir }),
    ).toEqual([]);
  });

  it("preserves configured Azure MCP telemetry without an AKS duplicate", () => {
    const payload = fixture("cursor-mcp-invocation.json");
    const azureArgs = runHook(shell, payload, {
      hooksDir: azureCursorInstall.hooksDir,
    });

    expectArg(azureArgs, "--client-name", "cursor");
    expectArg(azureArgs, "--event-type", "tool_invocation");
    expectArg(azureArgs, "--session-id", SESSION_ID);
    expectArg(azureArgs, "--tool-name", "MCP:get_azure_bestpractices");
    expectArg(azureArgs, "--plugin-version", "9.8.7");

    const kustoArgs = runHook(shell, payload, {
      hooksDir: kustoCursorInstall.hooksDir,
    });
    expectArg(kustoArgs, "--tool-name", "MCP:get_azure_bestpractices");
    expectArg(kustoArgs, "--plugin-version", "8.7.6");

    expect(
      runHook(shell, payload, { hooksDir: aksCursorInstall.hooksDir }),
    ).toEqual([]);
  });

  it("does not report a non-Azure MCP invocation", () => {
    const payload = fixture("cursor-mcp-invocation.json");
    payload.mcp_server_name = "github";

    expect(
      runHook(shell, payload, { hooksDir: azureCursorInstall.hooksDir }),
    ).toEqual([]);
  });

  it("does not report MCP calls from the generic postToolUse event", () => {
    const payload = fixture("cursor-mcp-invocation.json");
    payload.hook_event_name = "postToolUse";
    payload.tool_name = "MCP:get_azure_bestpractices";
    delete payload.mcp_server_name;

    expect(
      runHook(shell, payload, { hooksDir: azureCursorInstall.hooksDir }),
    ).toEqual([]);
  });

  it("does not report an AKS-looking path outside this hook copy", () => {
    const payload = fixture("cursor-skill-read.json") as CursorPayload & Record<string, unknown>;
    payload.tool_input.file_path = pathForShell(
      shell,
      join(
        TEST_DIR,
        ".cursor",
        "plugins",
        "cache",
        "other-catalog",
        "aks-skills",
        "other-revision",
        "skills",
        "aks-troubleshooting",
        "SKILL.md",
      ),
    );

    expect(
      runHook(shell, payload, { hooksDir: aksCursorInstall.hooksDir }),
    ).toEqual([]);
  });

  it("honors the telemetry opt-out before publishing AKS events", () => {
    const payload = fixture("cursor-skill-read.json") as CursorPayload & Record<string, unknown>;
    payload.tool_input.file_path = pathForShell(
      shell,
      join(aksCursorInstall.skillRoot, "SKILL.md"),
    );

    expect(
      runHook(shell, payload, {
        env: { AZURE_MCP_COLLECT_TELEMETRY: "false" },
        hooksDir: aksCursorInstall.hooksDir,
      }),
    ).toEqual([]);
  });
});
