import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

type InstallerDetectionCase = {
  platform: "Linux" | "OSX" | "Windows" | "FreeBSD";
  architecture: "X64" | "Arm64" | "X86";
  libc?: "glibc" | "alpine-release" | "os-release" | "musl-loader";
  osRelease?: string;
  machine?: string;
  translated?: boolean;
  processorArchitecture?: string;
  nativeProcessorArchitecture?: string;
  useHomeCache?: boolean;
  version?: string;
  unameFailure?: string;
};

type CopilotHookEntry = {
  type: "command";
  windows: string;
  osx: string;
  linux: string;
  bash: string;
  powershell: string;
  env?: Record<string, string>;
};

type CursorHookEntry = {
  type: "command";
  command: string;
};

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TEST_DIR = mkdtempSync(join(tmpdir(), "azure-telemetry-hooks-"));
const BIN_DIR = join(TEST_DIR, "bin");
const SCRATCH_DIR = join(TEST_DIR, "scratch");
const TEMP_ENV = { TMP: SCRATCH_DIR, TEMP: SCRATCH_DIR };
const CAPTURE_FILE = join(TEST_DIR, "reporter-args.txt");
const LOG_DIR = join(TEST_DIR, "logs");
const LOG_FILE = join(LOG_DIR, "telemetry.log");
const RAW_INPUT_DIR = join(LOG_DIR, "raw-input");
const INSTALL_CACHE_DIR = join(TEST_DIR, "telemetry-cache");
const TELEMETRY_ARCHIVE_DIR = join(TEST_DIR, "telemetry-archive");
const TELEMETRY_ZIP_PATH = join(TEST_DIR, "ghcfa-telem-local.zip");
const DOWNLOAD_CAPTURE_FILE = join(TEST_DIR, "download-url.txt");
const INVALID_TELEMETRY_ZIP_PATH = join(TEST_DIR, "invalid-telemetry.zip");
const CHECKSUM_MANIFEST_NAME = "telemetry-reporter-checksums.txt";
const HOOKS_SOURCE_DIR = join(REPO_ROOT, "hooks");
const SOURCE_HOOKS_DIR = join(REPO_ROOT, "hooks", "scripts");
const PLUGIN_HOOKS_SOURCE_DIR = join(
  REPO_ROOT,
  "plugins",
  "azure-skills",
  "hooks",
  "scripts",
);
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
const STUB_HOOKS_DIR = join(PLUGIN_ROOT, "hooks", "stub scripts");
const SPACED_PLUGIN_ROOT = join(TEST_DIR, "plugin root with spaces");
const SPACED_HOOKS_DIR = join(SPACED_PLUGIN_ROOT, "hooks", "scripts");
const SIDECAR_METADATA_PLUGIN_ROOT = join(TEST_DIR, "sidecar-metadata-plugin");
const SIDECAR_METADATA_HOOKS_DIR = join(SIDECAR_METADATA_PLUGIN_ROOT, "hooks", "scripts");
const MISSING_METADATA_PLUGIN_ROOT = join(TEST_DIR, "missing-metadata-plugin");
const MISSING_METADATA_HOOKS_DIR = join(MISSING_METADATA_PLUGIN_ROOT, "hooks", "scripts");
const OWNED_MCP_PLUGIN_ROOT = join(TEST_DIR, "owned-mcp-plugin");
const OWNED_MCP_HOOKS_DIR = join(OWNED_MCP_PLUGIN_ROOT, "hooks", "scripts");
const EMPTY_MCP_PLUGIN_ROOT = join(TEST_DIR, "empty-mcp-plugin");
const EMPTY_MCP_HOOKS_DIR = join(EMPTY_MCP_PLUGIN_ROOT, "hooks", "scripts");
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const SESSION_ID = "73e52424-a95d-4e21-b70c-2dffe48fdd86";
const TELEMETRY_REPORTER_VERSION = "0.1.16-g03871c5229";
const TELEMETRY_REPORTER_DIGESTS = {
  "linux-arm64": "f1a12dd39592b3179b96cf98d1648e15ad7189690484e0fa6d4ebabd74373b59",
  "linux-musl-arm64": "70d1a09e9c9136417ba00ac78c390517fa4d991082358cd949a996633227f2f8",
  "linux-musl-x64": "82fcdb2751c9002bd45f44a0a181bcd8a205835ced0260275fff1e2a80295b5e",
  "linux-x64": "4d35e70d142afaa827f0940c79420f1558edb2b397b11c9fa3c3511bfd0b3326",
  "osx-arm64": "8af0f060c53088e4298a8939719a89bc25e4f2d751ec10e8ca75da5dd818d073",
  "osx-x64": "643fa1379a724a3b147da973b7c3c193fe40fdc58739b6a37da5e43a2d6905f9",
  "win-arm64": "fdd37f4538522099b552284a8029ad586ac6006f44bccdeb8048b60afeac9cf0",
  "win-x64": "f850546e46777b59373cf3525e65b882056dd8f3d141e2799cbda223d18ff199",
} as const;
const STANDALONE_PUBLISHER = `Standalone ghcfa-telem (version ${TELEMETRY_REPORTER_VERSION})`;
const PUBLISHER_STDOUT = "test-only-private-publisher-stdout";
const PUBLISHER_STDERR = "test-only-private-publisher-stderr";
const PRIVATE_EVENT_DATA = "test-only-private-event-data";
const PLUGIN_METADATA = {
  copilot: { directory: ".plugin", name: "test-plugin", version: "1.2.3" },
  cursor: { directory: ".cursor-plugin", name: "test-plugin", version: "1.2.3" },
  claude: { directory: ".claude-plugin", name: "test-plugin", version: "1.2.3" },
} as const;

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

function resolveCommand(command: string): string {
  if (process.platform !== "win32") {
    return command;
  }
  const result = spawnSync("where.exe", [command], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.split(/\r?\n/, 1)[0] : command;
}

const shells = shellCandidates.filter(shell => isCommandAvailable(shell.command));

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function quoteBash(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function writePublisherStub(binaryPath: string): void {
  if (binaryPath.endsWith(".cmd")) {
    writeFileSync(
      binaryPath,
      [
        "@echo off",
        ":loop",
        "if \"%~1\"==\"\" goto end",
        ">>\"%TELEMETRY_CAPTURE_FILE%\" echo %~1",
        "shift",
        "goto loop",
        ":end",
        `echo ${PUBLISHER_STDOUT}`,
        `echo ${PUBLISHER_STDERR} >&2`,
        "if defined TELEMETRY_TEST_EXIT_CODE exit /b %TELEMETRY_TEST_EXIT_CODE%",
        "exit /b 0",
        "",
      ].join("\r\n"),
    );
  } else {
    writeFileSync(
      binaryPath,
      [
        "#!/usr/bin/env bash",
        "printf '%s\\n' \"$@\" > \"$TELEMETRY_CAPTURE_FILE\"",
        `printf '%s\\n' '${PUBLISHER_STDOUT}'`,
        `printf '%s\\n' '${PUBLISHER_STDERR}' >&2`,
        "exit \"${TELEMETRY_TEST_EXIT_CODE:-0}\"",
        "",
      ].join("\n"),
    );
    chmodSync(binaryPath, 0o755);
  }
}

function createTelemetryArchive(): void {
  mkdirSync(TELEMETRY_ARCHIVE_DIR, { recursive: true });
  const binaryName = process.platform === "win32" ? "ghcfa-telem.exe" : "ghcfa-telem";
  const binaryPath = join(TELEMETRY_ARCHIVE_DIR, binaryName);
  const binaryContent =
    process.platform === "win32"
      ? "test telemetry executable"
      : "#!/usr/bin/env bash\nprintf '%s\\n' \"$@\" > \"$TELEMETRY_CAPTURE_FILE\"\n";
  writeFileSync(binaryPath, binaryContent);
  if (process.platform !== "win32") {
    chmodSync(binaryPath, 0o755);
  }

  const zip = spawnSync("zip", ["-j", TELEMETRY_ZIP_PATH, binaryPath], {
    encoding: "utf8",
  });
  if (zip.error === undefined && zip.status === 0) {
    return;
  }

  const powerShell = shellCandidates.find(
    shell => shell.name === "PowerShell" && isCommandAvailable(shell.command),
  );
  if (!powerShell) {
    throw new Error(`Unable to create telemetry ZIP: ${zip.stderr || zip.error?.message}`);
  }

  const command = [
    `Compress-Archive -LiteralPath ${quotePowerShell(binaryPath)}`,
    `-DestinationPath ${quotePowerShell(TELEMETRY_ZIP_PATH)}`,
    "-Force",
  ].join(" ");
  const compressed = spawnSync(powerShell.command, ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8",
  });
  if (compressed.error !== undefined || compressed.status !== 0) {
    throw new Error(
      `Unable to create telemetry ZIP: ${compressed.stderr || compressed.error?.message}`,
    );
  }
}

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

// Converts Windows fixture paths for Bash subprocesses.
function pathForShell(shell: ShellCase, filePath: string): string {
  if (shell.name !== "Bash" || process.platform !== "win32") {
    return filePath;
  }

  const result = spawnSync("bash", ["-lc", 'cygpath -u "$1"', "bash", filePath], {
    encoding: "utf8",
    // Git Bash derives /tmp from TMP/TEMP; match fixture subprocesses.
    env: { ...process.env, ...TEMP_ENV },
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

// Runs a telemetry hook with the payload and returns its captured publisher arguments.
function runHook(
  shell: ShellCase,
  payload: Record<string, unknown>,
  inputPrefix = "",
  envOverrides: NodeJS.ProcessEnv = {},
  hooksDirectory = STUB_HOOKS_DIR,
): string[] {
  rmSync(CAPTURE_FILE, { force: true });
  rmSync(LOG_FILE, { force: true });
  rmSync(RAW_INPUT_DIR, { recursive: true, force: true });
  const extension = shell.name === "Bash" ? "sh" : "ps1";
  const scriptPath = join(hooksDirectory, `track-telemetry.${extension}`);
  const result = spawnSync(shell.command, shell.args(scriptPath), {
    encoding: "utf8",
    input: `${inputPrefix}${JSON.stringify(payload)}`,
    env: {
      ...process.env,
      ...TEMP_ENV,
      PATH: `${BIN_DIR}${delimiter}${process.env.PATH ?? ""}`,
      AZURE_SKILLS_TELEMETRY_LOG_DIR: LOG_DIR,
      AZURE_SKILLS_TELEMETRY_ZIP_PATH: pathForShell(shell, TELEMETRY_ZIP_PATH),
      AZURE_MCP_COLLECT_TELEMETRY: "true",
      COPILOT_CLI: "",
      LOCALAPPDATA: INSTALL_CACHE_DIR,
      XDG_CACHE_HOME: INSTALL_CACHE_DIR,
      TELEMETRY_CAPTURE_FILE: CAPTURE_FILE,
      TELEMETRY_TEST_EXIT_CODE: "0",
      ...reporterStubEnvironment(shell),
      ...envOverrides,
    },
  });

  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe('{"continue":true}');
  expect(result.stderr).toBe("");
  if (!existsSync(CAPTURE_FILE)) {
    return [];
  }
  return readFileSync(CAPTURE_FILE, "utf8").trim().split(/\r?\n/);
}

function reporterStubEnvironment(shell: ShellCase): NodeJS.ProcessEnv {
  const binaryName =
    shell.name === "PowerShell" && process.platform === "win32"
      ? "ghcfa-telem.cmd"
      : "ghcfa-telem";
  return {
    TELEMETRY_TEST_REPORTER_PATH: pathForShell(shell, join(BIN_DIR, binaryName)),
  };
}

function readDebugLog(): string {
  return existsSync(LOG_FILE) ? readFileSync(LOG_FILE, "utf8") : "";
}

function runInstaller(
  shell: ShellCase,
  cacheDirectory: string,
  zipPath: string,
  version = TELEMETRY_REPORTER_VERSION,
  mockDownload = false,
  checksumManifest?: string,
): ReturnType<typeof spawnSync> {
  const extension = shell.name === "Bash" ? "sh" : "ps1";
  const sourceScriptPath = join(HOOKS_DIR, `install-telemetry.${extension}`);
  let scriptPath = sourceScriptPath;
  if (checksumManifest !== undefined) {
    const fixtureDirectory = mkdtempSync(join(TEST_DIR, "installer-hooks-"));
    scriptPath = join(fixtureDirectory, `install-telemetry.${extension}`);
    cpSync(sourceScriptPath, scriptPath);
    writeFileSync(join(fixtureDirectory, CHECKSUM_MANIFEST_NAME), checksumManifest);
  }
  const versionArgs = [
    shell.name === "Bash" ? "--version" : "-Version",
    version,
  ];
  let installerArgs = [...shell.args(scriptPath), ...versionArgs];
  if (mockDownload) {
    if (shell.name === "Bash") {
      installerArgs = [
        "-c",
        [
          "curl() {",
          "  local output=\"\"",
          "  while [ \"$#\" -gt 0 ]; do",
          "    case \"$1\" in",
          "      --output) output=\"$2\"; shift 2 ;;",
          "      https://*) printf '%s\\n' \"$1\" > \"$TELEMETRY_TEST_DOWNLOAD_URL\" || return 1; shift ;;",
          "      *) shift ;;",
          "    esac",
          "  done",
          "  cp -- \"$TELEMETRY_TEST_DOWNLOAD_ARCHIVE\" \"$output\"",
          "}",
          "source \"$1\" --version \"$2\"",
        ].join("\n"),
        "bash",
        pathForShell(shell, scriptPath),
        version,
      ];
    } else {
      installerArgs = [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        [
          "function Invoke-WebRequest {",
          "  [CmdletBinding()]",
          "  param([string] $Uri, [string] $OutFile, [switch] $UseBasicParsing)",
          "  [System.IO.File]::WriteAllText($env:TELEMETRY_TEST_DOWNLOAD_URL, $Uri)",
          "  Copy-Item -LiteralPath $env:TELEMETRY_TEST_DOWNLOAD_ARCHIVE -Destination $OutFile -ErrorAction Stop",
          "}",
          `& ${quotePowerShell(scriptPath)} -Version ${quotePowerShell(version)}`,
        ].join("\n"),
      ];
    }
  }
  const commandPath =
    shell.name === "Bash" && process.platform === "win32"
      ? `${pathForShell(shell, BIN_DIR)}:/usr/bin:/bin`
      : `${BIN_DIR}${delimiter}${process.env.PATH ?? ""}`;
  return spawnSync(resolveCommand(shell.command), installerArgs, {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: commandPath,
      AZURE_SKILLS_TELEMETRY_ZIP_PATH: zipPath,
      TELEMETRY_TEST_DOWNLOAD_URL: pathForShell(shell, DOWNLOAD_CAPTURE_FILE),
      TELEMETRY_TEST_DOWNLOAD_ARCHIVE: pathForShell(shell, TELEMETRY_ZIP_PATH),
      LOCALAPPDATA: cacheDirectory,
      XDG_CACHE_HOME: cacheDirectory,
      TMPDIR: pathForShell(shell, SCRATCH_DIR),
      ...TEMP_ENV,
    },
  });
}

function createTestChecksumManifest(hash: string): string {
  return [
    "# version runtime-identifier sha256",
    ...Object.keys(TELEMETRY_REPORTER_DIGESTS).map(
      rid => `${TELEMETRY_REPORTER_VERSION} ${rid} ${hash}`,
    ),
    "",
  ].join("\n");
}

// Executes only installer detection/cache/URL logic, with fixture paths and native OS mocks.
function runInstallerDetection(
  shell: ShellCase,
  scenario: InstallerDetectionCase,
): ReturnType<typeof spawnSync> {
  const fixtureDirectory = mkdtempSync(join(TEST_DIR, "detection-"));
  const etcDirectory = join(fixtureDirectory, "etc");
  const libDirectory = join(fixtureDirectory, "lib");
  mkdirSync(etcDirectory);
  mkdirSync(libDirectory);
  if (scenario.libc === "alpine-release") {
    writeFileSync(join(etcDirectory, "alpine-release"), "3.20.0\n");
  }
  writeFileSync(
    join(etcDirectory, "os-release"),
    scenario.osRelease ?? (scenario.libc === "os-release" ? '  ID = "alpine"  \n' : "ID=ubuntu\n"),
  );
  if (scenario.libc === "musl-loader") {
    const loaderArchitecture = scenario.architecture === "Arm64" ? "aarch64" : "x86_64";
    writeFileSync(join(libDirectory, `ld-musl-${loaderArchitecture}.so.1`), "");
  }

  const extension = shell.name === "Bash" ? "sh" : "ps1";
  const installerPath = join(SOURCE_HOOKS_DIR, `install-telemetry.${extension}`);
  const installer = readFileSync(installerPath, "utf8");
  let script: string;
  if (shell.name === "Bash") {
    const fixturePath = pathForShell(shell, fixtureDirectory);
    const functions = ["detect_target", "get_cache_root"].map(name => {
      const match = installer.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`, "m"));
      expect(match, `Missing installer function ${name}`).not.toBeNull();
      return match![0];
    }).join("\n")
      .replaceAll("/etc/alpine-release", quoteBash(`${fixturePath}/etc/alpine-release`))
      .replaceAll("/etc/os-release", quoteBash(`${fixturePath}/etc/os-release`))
      .replaceAll("/lib/ld-musl-*.so.1", `${quoteBash(`${fixturePath}/lib`)}/ld-musl-*.so.1`);
    const assetAssignment = installer.match(/^ASSET_NAME=.*$/m)?.[0];
    const urlAssignment = installer.match(/^\s*DOWNLOAD_URL=.*$/m)?.[0];
    expect(assetAssignment).toBeDefined();
    expect(urlAssignment).toBeDefined();
    script = `#!/usr/bin/env bash
set -u
set -o pipefail
error() { printf '%s\\n' "$*" >&2; }
uname() {
    [ "$INSTALLER_TEST_UNAME_FAILURE" != "$1" ] || return 1
    case "$1" in
        -s) printf '%s\\n' "$INSTALLER_TEST_KERNEL" ;;
        -m) printf '%s\\n' "$INSTALLER_TEST_MACHINE" ;;
        *) return 1 ;;
    esac
}
sysctl() { printf '%s\\n' "$INSTALLER_TEST_TRANSLATED"; }
TOOL_NAME="ghcfa-telem"
REPOSITORY="microsoft/GitHub-Copilot-for-Azure"
VERSION="$INSTALLER_TEST_VERSION"
${functions}
detect_target || exit 1
CACHE_ROOT="$(get_cache_root)" || exit 1
${assetAssignment}
${urlAssignment}
printf '%s\\n' "$RUNTIME_IDENTIFIER" "$BINARY_NAME" "$CACHE_ROOT/$VERSION/$RUNTIME_IDENTIFIER/$BINARY_NAME" "$DOWNLOAD_URL"
`;
  } else {
    script = `
class InstallerTestRuntime {
    static [string] $OSArchitecture
    static [string] $OSDescription
    static [bool] IsOSPlatform([System.Runtime.InteropServices.OSPlatform] $Platform) {
        return $Platform.ToString() -eq $env:INSTALLER_TEST_PLATFORM
    }
}
[InstallerTestRuntime]::OSArchitecture = $env:INSTALLER_TEST_ARCHITECTURE
[InstallerTestRuntime]::OSDescription = $env:INSTALLER_TEST_PLATFORM
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    ${quotePowerShell(installerPath)}, [ref] $tokens, [ref] $parseErrors)
if ($parseErrors.Count -gt 0) { throw ($parseErrors | Out-String) }
$definitions = $ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -in @('Get-TelemetryTarget', 'Get-TelemetryCacheRoot')
}, $true)
if ($definitions.Count -ne 2) { throw 'Missing installer detection/cache functions.' }
foreach ($definition in $definitions) {
    $body = $definition.Extent.Text.Replace(
        '[System.Runtime.InteropServices.RuntimeInformation]', '[InstallerTestRuntime]')
    $body = $body.Replace('/etc/alpine-release', ${quotePowerShell(join(etcDirectory, "alpine-release"))})
    $body = $body.Replace('/etc/os-release', ${quotePowerShell(join(etcDirectory, "os-release"))})
    $body = $body.Replace('/lib', ${quotePowerShell(libDirectory)})
    Invoke-Expression $body
}
try {
    $toolName = 'ghcfa-telem'
    $Version = $env:INSTALLER_TEST_VERSION
    $target = Get-TelemetryTarget
    $cacheRoot = Get-TelemetryCacheRoot -OperatingSystem $target.OperatingSystem
    $installDirectory = Join-Path (Join-Path $cacheRoot $Version) $target.RuntimeIdentifier
    $binaryPath = Join-Path $installDirectory $target.BinaryName
    $assignments = $ast.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
            $node.Left -is [System.Management.Automation.Language.VariableExpressionAst] -and
            $node.Left.VariablePath.UserPath -in @('assetName', 'downloadUrl')
    }, $true)
    if ($assignments.Count -ne 2) { throw 'Missing installer asset/URL assignments.' }
    foreach ($assignment in $assignments) { Invoke-Expression $assignment.Extent.Text }
    Write-Output $target.RuntimeIdentifier
    Write-Output $target.BinaryName
    Write-Output $binaryPath
    Write-Output $downloadUrl
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
`;
  }
  const scriptPath = join(fixtureDirectory, `detect.${extension}`);
  writeFileSync(scriptPath, script);
  const cacheDirectory = pathForShell(shell, INSTALL_CACHE_DIR);
  const kernel = { Linux: "Linux", OSX: "Darwin", Windows: "MINGW64_NT-10.0", FreeBSD: "FreeBSD" };
  const machine = { X64: "x86_64", Arm64: "aarch64", X86: "i686" };
  const processor = { X64: "AMD64", Arm64: "ARM64", X86: "x86" };
  return spawnSync(resolveCommand(shell.command), shell.args(pathForShell(shell, scriptPath)), {
    encoding: "utf8",
    env: {
      ...process.env,
      INSTALLER_TEST_PLATFORM: scenario.platform,
      INSTALLER_TEST_ARCHITECTURE: scenario.architecture,
      INSTALLER_TEST_KERNEL: kernel[scenario.platform],
      INSTALLER_TEST_MACHINE: scenario.machine ?? machine[scenario.architecture],
      INSTALLER_TEST_TRANSLATED: scenario.translated ? "1" : "0",
      INSTALLER_TEST_VERSION: scenario.version ?? "0.1.0",
      INSTALLER_TEST_UNAME_FAILURE: scenario.unameFailure ?? "",
      PROCESSOR_ARCHITECTURE: scenario.processorArchitecture ?? processor[scenario.architecture],
      PROCESSOR_ARCHITEW6432: scenario.nativeProcessorArchitecture ?? "",
      LOCALAPPDATA: cacheDirectory,
      XDG_CACHE_HOME: scenario.useHomeCache ? "" : cacheDirectory,
      HOME: cacheDirectory,
      TMPDIR: pathForShell(shell, SCRATCH_DIR),
      ...TEMP_ENV,
    },
  });
}

function installedPathExists(shell: ShellCase, installedPath: string): boolean {
  if (shell.name === "Bash" && process.platform === "win32") {
    const result = spawnSync(resolveCommand("bash"), ["-lc", '[ -f "$1" ]', "bash", installedPath]);
    return result.status === 0;
  }
  return existsSync(installedPath);
}

function runWindowsManifestHook(
  entry: CopilotHookEntry,
  payload: Record<string, unknown>,
): string[] {
  rmSync(CAPTURE_FILE, { force: true });
  rmSync(LOG_FILE, { force: true });
  rmSync(RAW_INPUT_DIR, { recursive: true, force: true });
  const command = entry.windows.replaceAll("${PLUGIN_ROOT}", SPACED_PLUGIN_ROOT);
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    {
      encoding: "utf8",
      input: JSON.stringify(payload),
      env: {
        ...process.env,
        PATH: `${BIN_DIR}${delimiter}${process.env.PATH ?? ""}`,
        AZURE_SKILLS_TELEMETRY_LOG_DIR: LOG_DIR,
        AZURE_SKILLS_TELEMETRY_ZIP_PATH: TELEMETRY_ZIP_PATH,
        AZURE_MCP_COLLECT_TELEMETRY: "true",
        COPILOT_CLI: "",
        LOCALAPPDATA: INSTALL_CACHE_DIR,
        XDG_CACHE_HOME: INSTALL_CACHE_DIR,
        TELEMETRY_CAPTURE_FILE: CAPTURE_FILE,
        TELEMETRY_TEST_REPORTER_PATH: join(BIN_DIR, "ghcfa-telem.cmd"),
        ...entry.env,
      },
    },
  );

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

function expectStandaloneInvocation(args: string[]): void {
  expect(args).not.toContain("server");
  expect(args).not.toContain("plugin-telemetry");
}

function expectIsoTimestamp(args: string[]): void {
  const index = args.indexOf("--timestamp");
  expect(index).toBeGreaterThan(-1);
  expect(args[index + 1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
}

function copyTestHookScripts(destination: string): void {
  cpSync(SOURCE_HOOKS_DIR, destination, { recursive: true });
  cpSync(PLUGIN_HOOKS_SOURCE_DIR, destination, { recursive: true });
}

function writeHookMetadata(
  pluginRoot: string,
  metadata: { name: string; version: string },
  mcpServers: string[] = [],
): void {
  const metadataPath = join(pluginRoot, "hooks", "metadata.txt");
  mkdirSync(dirname(metadataPath), { recursive: true });
  writeFileSync(
    metadataPath,
    [
      `plugin-name=${metadata.name}`,
      `plugin-version=${metadata.version}`,
      ...mcpServers.map(serverName => `mcp-server=${serverName}`),
      "",
    ].join("\n"),
  );
}

function createPluginMetadataFixture(
  pluginRoot: string,
  metadata?: { name: string; version: string },
  mcpServers: string[] = [],
): void {
  const hooksDirectory = join(pluginRoot, "hooks", "scripts");
  cpSync(STUB_HOOKS_DIR, hooksDirectory, { recursive: true });
  if (metadata) {
    writeHookMetadata(pluginRoot, metadata, mcpServers);
  }
}

beforeAll(() => {
  mkdirSync(BIN_DIR, { recursive: true });
  mkdirSync(SCRATCH_DIR);
  copyTestHookScripts(HOOKS_DIR);
  cpSync(HOOKS_DIR, STUB_HOOKS_DIR, { recursive: true });
  writeFileSync(
    join(STUB_HOOKS_DIR, "install-telemetry.sh"),
    "#!/usr/bin/env bash\nprintf '%s\\n' \"$TELEMETRY_TEST_REPORTER_PATH\"\n",
  );
  writeFileSync(
    join(STUB_HOOKS_DIR, "install-telemetry.ps1"),
    "Write-Output $env:TELEMETRY_TEST_REPORTER_PATH\nexit 0\n",
  );
  createTelemetryArchive();
  writeFileSync(INVALID_TELEMETRY_ZIP_PATH, "not a ZIP archive");
  cpSync(STUB_HOOKS_DIR, SPACED_HOOKS_DIR, { recursive: true });
  writeHookMetadata(
    PLUGIN_ROOT,
    PLUGIN_METADATA.cursor,
    ["azure"],
  );
  createPluginMetadataFixture(
    SIDECAR_METADATA_PLUGIN_ROOT,
    { name: "sidecar-plugin", version: "9.8.7" },
  );
  createPluginMetadataFixture(MISSING_METADATA_PLUGIN_ROOT);
  const missingMetadataSkillRoot = join(
    MISSING_METADATA_PLUGIN_ROOT,
    "skills",
    "test-skill",
  );
  mkdirSync(missingMetadataSkillRoot, { recursive: true });
  writeFileSync(
    join(missingMetadataSkillRoot, "SKILL.md"),
    "---\nmetadata:\n  version: \"1.0.0\"\n---\n# Test Skill\n",
  );
  createPluginMetadataFixture(
    OWNED_MCP_PLUGIN_ROOT,
    { name: "owned-mcp-plugin", version: "1.0.0" },
    ["azure", "github"],
  );
  createPluginMetadataFixture(
    EMPTY_MCP_PLUGIN_ROOT,
    { name: "empty-mcp-plugin", version: "1.0.0" },
  );
  for (const metadata of Object.values(PLUGIN_METADATA)) {
    const manifestDir = join(PLUGIN_ROOT, metadata.directory);
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      join(manifestDir, "plugin.json"),
      JSON.stringify({ name: metadata.name, version: metadata.version }),
    );
  }
  mkdirSync(join(SPACED_PLUGIN_ROOT, PLUGIN_METADATA.copilot.directory), { recursive: true });
  writeFileSync(
    join(SPACED_PLUGIN_ROOT, PLUGIN_METADATA.copilot.directory, "plugin.json"),
    JSON.stringify({
      name: PLUGIN_METADATA.copilot.name,
      version: PLUGIN_METADATA.copilot.version,
    }),
  );
  writeHookMetadata(SPACED_PLUGIN_ROOT, PLUGIN_METADATA.copilot);
  for (const binaryName of ["ghcfa-telem", "ghcfa-telem.cmd"]) {
    writePublisherStub(join(BIN_DIR, binaryName));
  }
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("Telemetry hook manifests", () => {
  const copilot = JSON.parse(
    readFileSync(join(HOOKS_SOURCE_DIR, "copilot-hooks.json"), "utf8"),
  ) as {
    hooks: {
      SessionStart: CopilotHookEntry[];
      PostToolUse: CopilotHookEntry[];
    };
  };

  it("registers the client-specific lifecycle event shapes", () => {
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
        sessionStart: CursorHookEntry[];
        postToolUse: CursorHookEntry[];
        afterMCPExecution: CursorHookEntry[];
      };
    };

    expect(copilot.hooks.SessionStart).toHaveLength(1);
    expect(copilot.hooks.SessionStart[0].env?.AZURE_SKILLS_HOOK_CLIENT_FAMILY).toBe(
      "copilot-vscode",
    );
    expect(claude.hooks.SessionStart[0].hooks).toHaveLength(1);
    expect(cursor.hooks.sessionStart).toHaveLength(1);
    for (const entries of Object.values(cursor.hooks)) {
      expect(entries).toEqual([
        {
          type: "command",
          command: 'bash "${CURSOR_PLUGIN_ROOT}/hooks/scripts/track-telemetry.sh"',
        },
      ]);
    }
  });

  it.skipIf(process.platform !== "win32")(
    "executes the VS Code Windows command from a plugin path containing spaces",
    () => {
      const args = runWindowsManifestHook(copilot.hooks.SessionStart[0], {
        hook_event_name: "SessionStart",
        session_id: SESSION_ID,
        source: "new",
      });

      expectArg(args, "--plugin-name", PLUGIN_METADATA.copilot.name);
      expectArg(args, "--plugin-version", PLUGIN_METADATA.copilot.version);
      expectArg(args, "--client-name", "Visual Studio Code");
      expectArg(args, "--event-type", "session_start");
      expectArg(args, "--session-id", SESSION_ID);
    },
  );
});

describe.each(shells)("Generated plugin metadata ($name)", shell => {
  it("reads plugin name and version from hooks/metadata.txt", () => {
    const args = runHook(
      shell,
      {
        hook_event_name: "sessionStart",
        session_id: SESSION_ID,
        cursor_version: "1.7.2",
        is_background_agent: false,
        composer_mode: "agent",
      },
      "",
      {},
      SIDECAR_METADATA_HOOKS_DIR,
    );

    expectArg(args, "--plugin-name", "sidecar-plugin");
    expectArg(args, "--plugin-version", "9.8.7");
  });

  it("suppresses session telemetry when generated plugin metadata is missing", () => {
    const args = runHook(
      shell,
      {
        hook_event_name: "sessionStart",
        session_id: SESSION_ID,
        cursor_version: "1.7.2",
        is_background_agent: false,
        composer_mode: "agent",
      },
      "",
      {},
      MISSING_METADATA_HOOKS_DIR,
    );

    expect(args).toEqual([]);
  });

  it("suppresses skill telemetry when generated plugin metadata is missing", () => {
    const args = runHook(
      shell,
      {
        hook_event_name: "PostToolUse",
        session_id: SESSION_ID,
        cursor_version: "1.7.2",
        tool_name: "Skill",
        tool_input: { skill: "test-skill" },
      },
      "",
      {},
      MISSING_METADATA_HOOKS_DIR,
    );

    expect(args).toEqual([]);
  });

  it("reports Azure MCP telemetry when azure is a direct mcpServers key", () => {
    const args = runHook(
      shell,
      fixture("cursor-mcp-invocation.json"),
      "",
      {},
      OWNED_MCP_HOOKS_DIR,
    );

    expectArg(args, "--event-type", "tool_invocation");
    expectArg(args, "--tool-name", "get_azure_bestpractices");
  });

  it("does not report Azure MCP telemetry when the generated server list is empty", () => {
    const args = runHook(
      shell,
      fixture("cursor-mcp-invocation.json"),
      "",
      {},
      EMPTY_MCP_HOOKS_DIR,
    );

    expect(args).toEqual([]);
  });

  it("does not report Azure MCP telemetry when no server entries are generated", () => {
    const args = runHook(
      shell,
      fixture("cursor-mcp-invocation.json"),
      "",
      {},
      SIDECAR_METADATA_HOOKS_DIR,
    );

    expect(args).toEqual([]);
  });
});
describe.each(shells)("Telemetry reporter installer ($name)", shell => {
  it("installs from a local ZIP and reuses the cached executable", () => {
    const cacheDirectory = join(INSTALL_CACHE_DIR, `installer-${shell.name}`);
    rmSync(cacheDirectory, { recursive: true, force: true });

    const first = runInstaller(shell, cacheDirectory, TELEMETRY_ZIP_PATH);
    expect(first.error).toBeUndefined();
    expect(first.status, String(first.stderr)).toBe(0);
    const installedPath = String(first.stdout).trim();
    expect(installedPathExists(shell, installedPath)).toBe(true);
    if (process.platform !== "win32") {
      expect(statSync(installedPath).mode & 0o777).toBe(0o755);
    }

    const second = runInstaller(shell, cacheDirectory, join(TEST_DIR, "missing-cached.zip"));
    expect(second.error).toBeUndefined();
    expect(second.status, String(second.stderr)).toBe(0);
    expect(String(second.stdout).trim()).toBe(installedPath);
  }, 30_000);

  it("does not enforce release digests for an explicit local ZIP", () => {
    const cacheDirectory = join(INSTALL_CACHE_DIR, `local-override-${shell.name}`);
    rmSync(cacheDirectory, { recursive: true, force: true });

    const result = runInstaller(
      shell,
      cacheDirectory,
      TELEMETRY_ZIP_PATH,
      TELEMETRY_REPORTER_VERSION,
      false,
      "malformed checksum manifest\n",
    );

    expect(result.error).toBeUndefined();
    expect(result.status, String(result.stderr)).toBe(0);
    expect(installedPathExists(shell, String(result.stdout).trim())).toBe(true);
  });

  it("rejects an invalid local ZIP", () => {
    const cacheDirectory = join(INSTALL_CACHE_DIR, `invalid-installer-${shell.name}`);
    rmSync(cacheDirectory, { recursive: true, force: true });

    const result = runInstaller(shell, cacheDirectory, INVALID_TELEMETRY_ZIP_PATH);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
  });

  it("fails when the local ZIP is missing and no cached executable exists", () => {
    const cacheDirectory = join(INSTALL_CACHE_DIR, `missing-installer-${shell.name}`);
    const result = runInstaller(shell, cacheDirectory, join(TEST_DIR, "missing.zip"));
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(String(result.stdout).trim()).toBe("");
    expect(String(result.stderr)).toContain("Telemetry ZIP not found:");
  });

  it.each(["", "../invalid"])("rejects invalid version %j with usage exit code 2", version => {
    const result = runInstaller(shell, INSTALL_CACHE_DIR, TELEMETRY_ZIP_PATH, version);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(String(result.stdout).trim()).toBe("");
  });
});

describe("Telemetry reporter release download", () => {
  it("pins both hooks to the published reporter version", () => {
    const bashHook = readFileSync(
      join(SOURCE_HOOKS_DIR, "track-telemetry.sh"),
      "utf8",
    );
    const powerShellHook = readFileSync(
      join(SOURCE_HOOKS_DIR, "track-telemetry.ps1"),
      "utf8",
    );

    expect(bashHook).toContain(
      `TELEMETRY_REPORTER_VERSION="${TELEMETRY_REPORTER_VERSION}"`,
    );
    expect(powerShellHook).toContain(
      `$telemetryReporterVersion = "${TELEMETRY_REPORTER_VERSION}"`,
    );
  });

  it("pins every published runtime asset digest", () => {
    const manifest = readFileSync(join(SOURCE_HOOKS_DIR, CHECKSUM_MANIFEST_NAME), "utf8");
    const manifestEntries = manifest
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line !== "" && !line.startsWith("#"))
      .map(line => {
        const [version, rid, digest, ...extra] = line.split(/\s+/);
        expect(extra).toEqual([]);
        expect(version).toBe(TELEMETRY_REPORTER_VERSION);
        expect(digest).toMatch(/^[0-9a-f]{64}$/);
        return [rid, digest] as const;
      });
    expect(manifestEntries).toHaveLength(Object.keys(TELEMETRY_REPORTER_DIGESTS).length);
    expect(new Set(manifestEntries.map(([rid]) => rid)).size).toBe(manifestEntries.length);
    const entries = Object.fromEntries(manifestEntries);

    expect(entries).toEqual(TELEMETRY_REPORTER_DIGESTS);
  });

  it.each(shells)("downloads the prefixed release tag and RID-specific asset ($name)", shell => {
    const cacheDirectory = join(INSTALL_CACHE_DIR, `download-installer-${shell.name}`);
    rmSync(cacheDirectory, { recursive: true, force: true });
    rmSync(DOWNLOAD_CAPTURE_FILE, { force: true });

    const archiveHash = createHash("sha256").update(readFileSync(TELEMETRY_ZIP_PATH)).digest("hex");
    const result = runInstaller(
      shell,
      cacheDirectory,
      "",
      TELEMETRY_REPORTER_VERSION,
      true,
      createTestChecksumManifest(archiveHash),
    );
    expect(result.error).toBeUndefined();
    expect(result.status, String(result.stderr)).toBe(0);
    const installedPath = String(result.stdout).trim();
    expect(installedPathExists(shell, installedPath)).toBe(true);
    const rid = basename(dirname(installedPath));
    expect([
      "win-x64", "win-arm64", "osx-x64", "osx-arm64", "linux-x64", "linux-arm64",
      "linux-musl-x64", "linux-musl-arm64",
    ]).toContain(rid);
    expect(installedPath.replaceAll("\\", "/")).toContain(
      `/${TELEMETRY_REPORTER_VERSION}/${rid}/ghcfa-telem`,
    );
    expect(readFileSync(DOWNLOAD_CAPTURE_FILE, "utf8").trim()).toBe(
      `https://github.com/microsoft/GitHub-Copilot-for-Azure/releases/download/ghcfa-telem-${TELEMETRY_REPORTER_VERSION}/ghcfa-telem-${TELEMETRY_REPORTER_VERSION}-${rid}.zip`,
    );
  }, 30_000);

  it.each(shells)("rejects a downloaded asset whose digest does not match ($name)", shell => {
    const cacheDirectory = join(INSTALL_CACHE_DIR, `digest-mismatch-${shell.name}`);
    rmSync(cacheDirectory, { recursive: true, force: true });

    const result = runInstaller(
      shell,
      cacheDirectory,
      "",
      TELEMETRY_REPORTER_VERSION,
      true,
      createTestChecksumManifest("0".repeat(64)),
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(String(result.stdout).trim()).toBe("");
    expect(String(result.stderr)).toContain("SHA-256 validation failed for telemetry reporter asset");
  });

  const invalidChecksumCases = [
    {
      caseName: "missing",
      manifest: "# no matching checksum\n",
      diagnostic: "has no entry for version",
    },
    {
      caseName: "duplicate",
      manifest: `${createTestChecksumManifest("0".repeat(64))}${createTestChecksumManifest("1".repeat(64))}`,
      diagnostic: "has multiple entries for version",
    },
    {
      caseName: "malformed",
      manifest: "not-a-valid-checksum-entry\n",
      diagnostic: "has a malformed entry on line 1",
    },
  ];
  it.each(
    shells.flatMap(shell =>
      invalidChecksumCases.map(checksumCase => ({ shell, checksumCase })),
    ),
  )("rejects a $checksumCase.caseName checksum manifest entry ($shell.name)", ({
    shell,
    checksumCase,
  }) => {
    const cacheDirectory = join(
      INSTALL_CACHE_DIR,
      `checksum-${checksumCase.caseName}-${shell.name}`,
    );
    rmSync(cacheDirectory, { recursive: true, force: true });

    const result = runInstaller(
      shell,
      cacheDirectory,
      "",
      TELEMETRY_REPORTER_VERSION,
      true,
      checksumCase.manifest,
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(String(result.stdout).trim()).toBe("");
    expect(String(result.stderr)).toContain(checksumCase.diagnostic);
  });
});

describe.each(shells)("Telemetry reporter installer detection ($name)", shell => {
  function expectTarget(scenario: InstallerDetectionCase, rid: string): void {
    const result = runInstallerDetection(shell, scenario);
    expect(result.error).toBeUndefined();
    expect(result.status, String(result.stderr)).toBe(0);
    const binary = rid.startsWith("win-") ? "ghcfa-telem.exe" : "ghcfa-telem";
    const cacheRoot = rid.startsWith("win-")
      ? "GitHubCopilotForAzure/telemetry"
      : `${scenario.useHomeCache ? ".cache/" : ""}github-copilot-for-azure/telemetry`;
    const version = scenario.version ?? "0.1.0";
    const cacheDirectory = pathForShell(shell, INSTALL_CACHE_DIR).replaceAll("\\", "/");
    expect(String(result.stdout).trim().replaceAll("\\", "/").split(/\r?\n/)).toEqual([
      rid,
      binary,
      `${cacheDirectory}/${cacheRoot}/${version}/${rid}/${binary}`,
      `https://github.com/microsoft/GitHub-Copilot-for-Azure/releases/download/ghcfa-telem-${version}/ghcfa-telem-${version}-${rid}.zip`,
    ]);
  }

  const architectures = ["X64", "Arm64"] as const;
  const linuxCases = (["glibc", "alpine-release", "os-release", "musl-loader"] as const)
    .flatMap(libc => architectures.map(architecture => ({ libc, architecture })));
  it.each(linuxCases)("selects Linux $libc on $architecture", ({ libc, architecture }) => {
    const prefix = libc === "glibc" ? "linux" : "linux-musl";
    const suffix = architecture === "X64" ? "x64" : "arm64";
    expectTarget({ platform: "Linux", architecture, libc }, `${prefix}-${suffix}`);
  });

  it.each(
    (["Windows", "OSX"] as const).flatMap(platform =>
      architectures.map(architecture => ({ platform, architecture }))),
  )("preserves $platform on $architecture", ({ platform, architecture }) => {
    const prefix = platform === "Windows" ? "win" : "osx";
    const suffix = architecture === "X64" ? "x64" : "arm64";
    expectTarget({ platform, architecture }, `${prefix}-${suffix}`);
  });

  it("does not mistake ID_LIKE or an unrelated distribution for Alpine", () => {
    expectTarget({
      platform: "Linux",
      architecture: "X64",
      osRelease: 'ID=alpine-like\nID_LIKE="alpine"\n',
    }, "linux-x64");
  });

  it("selects Alpine from an unquoted distribution ID", () => {
    expectTarget({
      platform: "Linux",
      architecture: "X64",
      osRelease: "ID=alpine\n",
    }, "linux-musl-x64");
  });

  it("keeps the HOME cache fallback and version separation for musl", () => {
    expectTarget({
      platform: "Linux",
      architecture: "Arm64",
      libc: "musl-loader",
      useHomeCache: true,
      version: "0.2.0",
    }, "linux-musl-arm64");
  });

  it.skipIf(shell.name !== "Bash")("selects native Apple Silicon under Rosetta", () => {
    expectTarget({
      platform: "OSX",
      architecture: "X64",
      translated: true,
    }, "osx-arm64");
  });

  it.skipIf(shell.name !== "Bash")("prefers the native Windows architecture over emulation", () => {
    expectTarget({
      platform: "Windows",
      architecture: "X64",
      processorArchitecture: "AMD64",
      nativeProcessorArchitecture: "ARM64",
    }, "win-arm64");
  });

  it.each([
    { platform: "FreeBSD", architecture: "X64", error: "Unsupported operating system:" },
    { platform: "Linux", architecture: "X86", error: "Unsupported native architecture:" },
  ] as const)("rejects unsupported $platform/$architecture", ({ platform, architecture, error }) => {
    const result = runInstallerDetection(shell, { platform, architecture });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(String(result.stdout).trim()).toBe("");
    expect(String(result.stderr)).toContain(error);
  });

  it("still rejects unsupported architectures on musl Linux", () => {
    const result = runInstallerDetection(shell, {
      platform: "Linux",
      architecture: "X86",
      libc: "alpine-release",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(String(result.stdout).trim()).toBe("");
    expect(String(result.stderr)).toContain("Unsupported native architecture:");
  });

  it.skipIf(shell.name !== "Bash").each([
    { unameFailure: "-s", error: "Unable to determine the operating system." },
    { unameFailure: "-m", error: "Unable to determine the native architecture." },
  ])("propagates uname $unameFailure failures", ({ unameFailure, error }) => {
    const result = runInstallerDetection(shell, {
      platform: "Linux",
      architecture: "X64",
      unameFailure,
    });
    expect(result.status).toBe(1);
    expect(String(result.stdout).trim()).toBe("");
    expect(String(result.stderr)).toContain(error);
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

      expectStandaloneInvocation(args);
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
    expect(readDebugLog()).toBe("");
  });

  it("uses the standalone publisher with a ZIP override and no rollout flag", () => {
    const args = runHook(
      shell,
      fixture("cursor-mcp-invocation.json"),
      "",
      { AZURE_SKILLS_TELEMETRY_ZIP_PATH: TELEMETRY_ZIP_PATH },
    );

    expectStandaloneInvocation(args);
    expectArg(args, "--tool-name", "get_azure_bestpractices");
  });

  it.skipIf(process.platform === "win32")(
    "installs, invokes, and reuses the standalone reporter",
    () => {
      const shellCache = join(INSTALL_CACHE_DIR, shell.name);
      rmSync(shellCache, { recursive: true, force: true });
      const payload = fixture("cursor-mcp-invocation.json");
      const enabledEnvironment = {
        AZURE_SKILLS_TELEMETRY_ZIP_PATH: TELEMETRY_ZIP_PATH,
        LOCALAPPDATA: shellCache,
        XDG_CACHE_HOME: shellCache,
      };

      const firstArgs = runHook(shell, payload, "", enabledEnvironment, HOOKS_DIR);
      expectStandaloneInvocation(firstArgs);
      expectArg(firstArgs, "--tool-name", "get_azure_bestpractices");
      expect(readDebugLog()).toContain(`Publisher: ${STANDALONE_PUBLISHER} | Args:`);
      expect(readDebugLog().replaceAll("\\", "/")).toContain(`/${TELEMETRY_REPORTER_VERSION}/`);

      const firstArgsTimestampIndex = firstArgs.indexOf("--timestamp");
      firstArgs.splice(firstArgsTimestampIndex, 2);

      // Each run uses a dynamically generated timestamp which may differ.
      // Every other argument should be identical.
      const secondArgs = runHook(
        shell,
        payload,
        "",
        {
          ...enabledEnvironment,
          AZURE_SKILLS_TELEMETRY_ZIP_PATH: join(TEST_DIR, "missing-after-install.zip"),
        },
        HOOKS_DIR,
      );
      const secondArgsTimestampIndex = secondArgs.indexOf("--timestamp");
      secondArgs.splice(secondArgsTimestampIndex, 2);

      expect(secondArgs).toEqual(firstArgs);
    },
  );

  it("fails open when standalone installation fails", () => {
    const args = runHook(
      shell,
      fixture("cursor-mcp-invocation.json"),
      "",
      {
        AZURE_SKILLS_TELEMETRY_ZIP_PATH: join(TEST_DIR, "missing.zip"),
        LOCALAPPDATA: join(INSTALL_CACHE_DIR, `${shell.name}-failure`),
        XDG_CACHE_HOME: join(INSTALL_CACHE_DIR, `${shell.name}-failure`),
      },
      HOOKS_DIR,
    );

    expect(args).toEqual([]);
    const log = readDebugLog();
    expect(log).toContain(`Publisher: ${STANDALONE_PUBLISHER} | Args:`);
    expect(log).toContain(
      `Publisher: ${STANDALONE_PUBLISHER} | Installation failed with status 1:`,
    );
    expect(log).toContain("Telemetry ZIP not found:");
  });
});

describe.each(shells)("Telemetry publisher debug logs ($name)", shell => {
  it("identifies the standalone version, executable, and actual arguments", () => {
    const env = reporterStubEnvironment(shell);
    const args = runHook(shell, fixture("cursor-mcp-invocation.json"), "", env, STUB_HOOKS_DIR);
    const log = readDebugLog();

    expectArg(args, "--tool-name", "get_azure_bestpractices");
    expect(args).not.toContain("server");
    expect(args).not.toContain("plugin-telemetry");
    expect(log).toContain(`Publisher: ${STANDALONE_PUBLISHER} | Args: ${args.join(" ")}`);
    expect(log).toContain(
      `Publisher: ${STANDALONE_PUBLISHER} | Executable: ${env.TELEMETRY_TEST_REPORTER_PATH}`,
    );
    expect(log.match(/\| Args:/g)).toHaveLength(1);
    expect(log).not.toContain("MCP Args:");
  });

  it("attributes execution failures without logging private output or extra event data", () => {
    const args = runHook(
      shell,
      { ...fixture("cursor-mcp-invocation.json"), tool_input: PRIVATE_EVENT_DATA },
      "",
      {
        ...reporterStubEnvironment(shell),
        TELEMETRY_TEST_EXIT_CODE: "17",
      },
      STUB_HOOKS_DIR,
    );
    const log = readDebugLog();

    expectArg(args, "--tool-name", "get_azure_bestpractices");
    expect(log).toContain(`Publisher: ${STANDALONE_PUBLISHER} | Execution failed with status 17.`);
    expect(log.indexOf("| Args:")).toBeLessThan(log.indexOf("| Execution failed"));
    expect(log).not.toContain(PUBLISHER_STDOUT);
    expect(log).not.toContain(PUBLISHER_STDERR);
    expect(log).not.toContain(PRIVATE_EVENT_DATA);
  });

  it("attributes a reporter launch failure", () => {
    const args = runHook(
      shell,
      fixture("cursor-mcp-invocation.json"),
      "",
      {
        ...reporterStubEnvironment(shell),
        TELEMETRY_TEST_REPORTER_PATH: pathForShell(shell, join(BIN_DIR, "missing-reporter")),
      },
      STUB_HOOKS_DIR,
    );
    const log = readDebugLog();

    expect(args).toEqual([]);
    expect(log).toContain(`Publisher: ${STANDALONE_PUBLISHER} | Executable:`);
    expect(log).toContain(
      `Publisher: ${STANDALONE_PUBLISHER} | Execution failed ${shell.name === "Bash" ? "with status 127." : "to start."
      }`,
    );
  }, 30_000);

  it("diagnoses a successful installer exit with no executable path", () => {
    const args = runHook(
      shell,
      fixture("cursor-mcp-invocation.json"),
      "",
      { ...reporterStubEnvironment(shell), TELEMETRY_TEST_REPORTER_PATH: "" },
      STUB_HOOKS_DIR,
    );
    const log = readDebugLog();

    expect(args).toEqual([]);
    expect(log).toContain(
      `Publisher: ${STANDALONE_PUBLISHER} | Installation failed: installer returned no executable path.`,
    );
    expect(log).not.toContain("Installation failed with status");
    expect(log).not.toContain("| Executable:");
  });

  it("keeps logging opt-in", () => {
    const args = runHook(
      shell,
      fixture("cursor-mcp-invocation.json"),
      "",
      {
        ...reporterStubEnvironment(shell),
        AZURE_SKILLS_TELEMETRY_LOG_DIR: "",
      },
      STUB_HOOKS_DIR,
    );

    expectArg(args, "--tool-name", "get_azure_bestpractices");
    expect(existsSync(LOG_FILE)).toBe(false);
    expect(existsSync(RAW_INPUT_DIR)).toBe(false);
  });

  it("does not publish or log events when telemetry is opted out", () => {
    const args = runHook(
      shell,
      fixture("cursor-mcp-invocation.json"),
      "",
      {
        ...reporterStubEnvironment(shell),
        AZURE_MCP_COLLECT_TELEMETRY: "false",
      },
      STUB_HOOKS_DIR,
    );

    expect(args).toEqual([]);
    expect(existsSync(LOG_FILE)).toBe(false);
    expect(existsSync(RAW_INPUT_DIR)).toBe(false);
  });
});

describe.each(shells)("Cursor telemetry hook ($name)", shell => {
  const skillRoot = createCursorSkillCache();

  it("reports a SKILL.md read as a skill invocation", () => {
    const payload = fixture("cursor-skill-read.json") as CursorPayload & Record<string, unknown>;
    payload.tool_input.file_path = join(skillRoot, "SKILL.md");

    const args = runHook(shell, payload);

    expectStandaloneInvocation(args);
    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--event-type", "skill_invocation");
    expectArg(args, "--session-id", SESSION_ID);
    expectArg(args, "--skill-name", "azure-cost");
    expectArg(args, "--skill-version", "1.2.3");
    expect(args).not.toContain("--file-reference");
  }, 10_000);

  it("reports a bundled file read as a reference read", () => {
    const payload = fixture("cursor-reference-read.json") as CursorPayload & Record<string, unknown>;
    payload.tool_input.file_path = join(skillRoot, "cost-query", "guardrails.md");

    const args = runHook(shell, payload);

    expectArg(args, "--client-name", "cursor");
    expectArg(args, "--event-type", "reference_file_read");
    expectArg(args, "--session-id", SESSION_ID);
    expectArg(args, "--skill-version", "1.2.3");
    expectArg(args, "--file-reference", "azure-cost\\cost-query\\guardrails.md");
    expect(args).not.toContain("--skill-name");
  }, 10_000);

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
    expect(readDebugLog()).toBe("");
  });

  it("does not report MCP calls from the generic postToolUse event", () => {
    const payload = fixture("cursor-mcp-invocation.json");
    payload.hook_event_name = "postToolUse";
    payload.tool_name = "MCP:get_azure_bestpractices";
    delete payload.mcp_server_name;

    expect(runHook(shell, payload)).toEqual([]);
    expect(readDebugLog()).toBe("");
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
