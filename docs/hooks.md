# Hooks

Hooks manifests are the `hooks.json` files that tells the agent what hooks to execute.

These files are used by clients when running agent sessions. We have to maintain separate plugin manifest for different clients before they work in different ways.

## Shared and plugin-owned hooks

Repository-level files under `hooks/` are shared by every plugin. Files under
`plugins/<plugin-name>/hooks/` belong only to that plugin. During the build,
the two source trees are assembled into `output/<plugin-name>/hooks/`.

Every plugin must define its own Bash and PowerShell installation-path
patterns under `hooks/scripts/pluginPathAllowPattern.sh` and
`hooks/scripts/pluginPathAllowPattern.ps1`. Other plugin-specific scripts can
be added below the same local `hooks/` directory, but their output paths must
not collide with shared files.

A plugin can optionally add `copilot-hooks.json`, `claude-hooks.json`, or
`cursor-hooks.json`. These files are manifest fragments, not replacements:

- Include only event registrations owned by the plugin.
- A new event is added to the compiled manifest.
- Registrations for an existing event are appended after the shared
  registrations.
- Top-level metadata can only repeat an existing shared value exactly.

The build validates all fragments and emits the compiled manifests at the
existing client paths. It also copies compiled `hooks/copilot-hooks.json`
unchanged to `com.github.copilot/hooks/hooks.json` in each built package,
the Copilot extension location for Agent Plugins 1.0. Only shared and
plugin-local `copilot-hooks.json` registrations contribute to this file;
Claude and Cursor hooks are not included.

The namespaced manifest still references `${PLUGIN_ROOT}/hooks/scripts/`.
Scripts, metadata, allowlists, and legacy manifests stay under `hooks/`;
no scripts are duplicated. The namespaced file is generated during the
build rather than maintained separately in plugin sources.

After assembling hooks, the build generates `hooks/allowlists/allowed-skills.txt`
and `hooks/allowlists/allowed-references.txt` in each plugin package. These
plugin-specific, newline-separated lists describe the packaged skills and their
supporting files. Reference paths remain relative to the plugin's `skills/`
directory, not the allowlist directory.

The build also copies the shared `plugins/allowed-azure-tools.json` source to
`hooks/allowlists/allowed-tools.json` in every plugin package, beside the text
lists. It copies the JSON byte-for-byte, preserving the `commands`, `areas`, and
`extensionTools` sections and their named groups. A source read or destination
write failure rejects the build.

Both telemetry hooks pass these three filenames to the reporter using
`--allowed-skills`, `--allowed-references`, and `--allowed-tools` for every
reported event. Paths are resolved from the installed hook script's location,
not the client's working directory, and remain single arguments when the
plugin path contains spaces. The hooks pass the tools JSON filename without
parsing or rewriting its contents.

The reporter requires all three paths and includes no embedded lists. The tools
JSON supplies all three tool categories together. The hooks pass all three paths
even if files are missing. Missing options, unreadable files, and malformed tools
JSON cause the reporter to fail without publishing telemetry or falling back.
The host hook still continues, using the existing opt-in
failure logging described below.

## Copilot CLI

Copilot CLI uses the `copilot-hooks.json` hooks manifest, referenced explicitly via the `hooks` property in the Copilot plugin manifest (`.plugin/plugin.json`). Although it shares the manifest with VS Code, it only uses the `bash` and `powershell` properties defined in it. At runtime, Copilot CLI replaces the `PLUGIN_ROOT` variable to construct the path that can resolve the scripts. On macOS and Linux, it executes the `bash` script. On Windows, it executes the PowerShell script referenced by the `powershell` property.

The `SessionStart` hook reports new and resumed sessions. Copilot CLI is identified
by `COPILOT_CLI=1` together with standalone-launcher evidence
(`COPILOT_CLI_PATH`, `COPILOT_CLI_BINARY_VERSION`, or `COPILOT_LOADER_PID`).
This is corroborating evidence, not a guaranteed host contract. Cursor's
`cursor_version` and VS Code's exact application marker take precedence over
these ambient variables. Standalone CLI evidence still takes precedence over
weaker VS Code ancestry and transcript-path signals, so a CLI launched in a
VS Code terminal is not classified as VS Code merely because of that ancestry.
Plugin metadata is read from `.plugin/plugin.json`.

## VS Code

VS Code uses the `copilot-hooks.json` hooks manifest. Although it shares the manifest with Copilot CLI, it only uses the `windows`, `osx` and `linux` properties defined in it. At runtime, VS Code replaces the `PLUGIN_ROOT` variable to construct the path that can resolve the scripts. These values are complete command lines rather than shell-specific script bodies. The Windows command therefore invokes `powershell.exe` explicitly and quotes the script path so execution does not depend on the user's `.ps1` file association and works when the plugin path contains spaces.

The shared manifest passes the `copilot-vscode` harness on every telemetry hook.
This identifies the registration family, not the application. The exact
`AI_AGENT=github_copilot_vscode_agent` marker identifies VS Code even when it
embeds the Copilot runtime (`COPILOT_CLI=1`). A VS Code PID together with either
the `extensionHost` crash-reporter process type or the extension-host entrypoint
also supports VS Code identification. Tool-use IDs and transcript paths remain
fallback signals. Once VS Code is identified, the existing transcript-path
logic chooses Insiders when `Code - Insiders` is present, otherwise Stable.
Plugin metadata is read from `.plugin/plugin.json`.

## Claude Code

Claude Code uses the `claude-hooks.json` hooks manifest. Its manifest defines a nested `hooks` array under each event, making it unique from other clients' hooks manifests. At runtime, Claude Code replaces the `CLAUDE_PLUGIN_ROOT` variable to construct the path that can resolve to the scripts. It then executes the script with bash.

The `SessionStart` hook reports both startup and resume events. Plugin metadata is read from `.claude-plugin/plugin.json`.

## Cursor

Cursor uses the `cursor-hooks.json` hooks manifest. At runtime, Cursor replaces the `CURSOR_PLUGIN_ROOT` variable to construct the path that can resolve to the scripts. Like Claude Code, it executes the telemetry script with Bash on every platform.

The `sessionStart` hook reports each new Composer conversation. Plugin metadata is read from `.cursor-plugin/plugin.json`.

## Harness parameter and host detection

The shared manifests pass an optional harness to the
[Bash](../hooks/scripts/track-telemetry.sh) and
[PowerShell](../hooks/scripts/track-telemetry.ps1) telemetry scripts on every
event. Bash accepts `--harness <value>`; PowerShell accepts `-Harness <value>`.
For example, from the repository root, with the hook JSON supplied on stdin:

```bash
bash ./hooks/scripts/track-telemetry.sh --harness copilot-vscode
```

```powershell
& .\hooks\scripts\track-telemetry.ps1 -Harness copilot-vscode
```

| Harness | Client-name behavior |
|---------|----------------------|
| `claude-code` | Reports `claude-code` unchanged. |
| `cursor` | Reports `cursor` unchanged, even without `cursor_version`. |
| `copilot-vscode` | Refines the Copilot/VS Code family using application evidence; inconclusive input reports `unknown`. |
| Any other nonempty value | Reports the value unchanged, including casing and spaces. |
| Omitted or empty | Uses environment and payload evidence, with the same runtime/application distinction. |

Definitive and custom harness values override conflicting environment or payload
signals. All nonempty harnesses other than `copilot-vscode` use the same
pass-through rule; `claude` is not an alias for `claude-code`. An optional
explicit application identifier takes precedence over
harness and passive detection: a launcher that knows its frontend can pass
`--application <client-name>` in Bash or `-Application <client-name>` in
PowerShell. The value is forwarded unchanged. From the repository root:

```bash
bash ./hooks/scripts/track-telemetry.sh --harness copilot-vscode --application copilot-cli
```

```powershell
& .\hooks\scripts\track-telemetry.ps1 -Harness copilot-vscode -Application copilot-cli
```

These parameters control the reported client name, not event classification.
Cursor MCP events are recognized by `afterMCPExecution` and
`mcp_server_name=azure`, provided the plugin owns that server, even when an
application override or custom harness label changes the reported name.

The shared manifests do not supply an application identifier because the
Copilot registration is shared by multiple applications. Without an override,
Cursor's nonempty `cursor_version` is considered first, then the exact VS Code
`AI_AGENT` marker takes precedence over ambient CLI evidence. Standalone CLI
evidence precedes weaker VS Code extension-host, tool-ID, and path evidence.
Neither Cursor's version field nor environment-based detection requires
`hook_event_name`. The existing VS Code Stable/Insiders path distinction is
retained.

Payload shape selects an input format, not an application. `toolArgs` without
`hook_event_name` no longer implies CLI, and `hook_event_name` alone no longer
implies Claude. A session with only those fields reports `unknown`; use an
explicit harness/application value or corroborating host evidence to identify
it. In particular, older CLI sessions without launcher evidence and compatible
Claude/Codex-shaped payloads are not automatically assigned a product name.

`COPILOT_CLI=1` alone indicates the runtime, not the frontend. Likewise,
`COPILOT_CLI_RUN_AS_NODE=1` alone, a standalone-launcher variable without the
runtime marker, or `VSCODE_PID` alone is inconclusive. Such inputs report
`unknown` rather than guessing CLI, VS Code, or Claude. These environment
signals are observational and can be inherited; they are not authentication.
No new passive GitHub Copilot app detection rule is assumed.

The manifests no longer set `AZURE_SKILLS_HOOK_CLIENT_FAMILY`. The scripts still
consult it if set externally, but treat it as a family hint rather than proof
of VS Code.

## Session-start telemetry

The build copies the shared hooks into every plugin package. Each installed plugin therefore reports its own session-start event with:

- `--plugin-name` and `--plugin-version` from the active client's `plugin.json`
- `--client-name` for the detected host
- `--timestamp` generated in UTC ISO-8601 format
- `--event-type session_start`
- `--session-id` from the host payload

The `plugin-telemetry` command requires a session ID, so the hook does not report a session-start event when the host omits it. Telemetry opt-out and fail-open behavior are the same as for the existing tool, skill, and reference-file events.

## Standalone telemetry reporter

The hooks publish through the standalone Native AOT reporter. The shared
tracking scripts pin the reporter version and install the matching asset from
the `ghcfa-telem-<version>` release tag. Here, `<version>` is the pinned
reporter version and `<rid>` is the detected runtime identifier:

```text
https://github.com/microsoft/GitHub-Copilot-for-Azure/releases/download/ghcfa-telem-<version>/ghcfa-telem-<version>-<rid>.zip
```

The installers verify downloaded release assets before extraction. The
[`telemetry-reporter-checksums.txt`](../hooks/scripts/telemetry-reporter-checksums.txt)
manifest pins one SHA-256 digest for each supported version and RID. A missing,
duplicate, malformed, or mismatched digest fails installation, and the hook
continues without publishing telemetry. Updating the pinned reporter version
also requires adding the release asset digests for all eight RIDs.

To test a local build, set `AZURE_SKILLS_TELEMETRY_ZIP_PATH` to a local
runtime ZIP produced by `telemetry-reporter/eng/scripts/Build-Native.ps1`.
This explicit development override bypasses the release digest manifest because
locally built ZIPs do not match the published release assets.

The installer detects the native operating system and architecture, including
Apple Silicon when Bash runs under Rosetta. It installs each version and RID
once, then reuses the cached executable:

- Windows: `%LOCALAPPDATA%\GitHubCopilotForAzure\telemetry\<version>\<rid>\ghcfa-telem.exe`
- macOS/Linux: `${XDG_CACHE_HOME:-$HOME/.cache}/github-copilot-for-azure/telemetry/<version>/<rid>/ghcfa-telem`

The reporter packages target Windows, macOS, glibc-based Linux, and musl-based
Linux on x64 and ARM64. The installers select `linux-musl-x64` or
`linux-musl-arm64` for Alpine and other detected musl-based Linux systems,
rather than the glibc `linux-x64` or `linux-arm64` assets. Both Linux variants use
the same Unix cache root, with separate per-version/RID directories.

Installation or reporter failures remain fail-open for the host hook. The hook
does not fall back to another publisher.

## Telemetry debug logs

Set `AZURE_SKILLS_TELEMETRY_LOG_DIR` to a writable directory to enable hook
debugging. Both hooks append timestamped entries to `telemetry.log` in that
directory and save raw hook inputs under `raw-input/`. Debugging remains opt-in;
these files contain existing event arguments and raw inputs, so treat them as
potentially sensitive.

Each attempted event identifies `ghcfa-telem` and the pinned version before
installation or execution. A successful installation or cache lookup also logs
the resolved executable path. For example, omitting timestamps and abbreviating
event arguments:

```text
Publisher: Standalone ghcfa-telem (version <version>) | Args: --plugin-name ...
Publisher: Standalone ghcfa-telem (version <version>) | Executable: <installed-path>
```

Standalone arguments omit `server plugin-telemetry`, matching the executable's
actual invocation. Failure entries identify the same publisher and distinguish
installation from execution:

```text
Publisher: Standalone ghcfa-telem (version <version>) | Installation failed with status 1: <installer-diagnostic>
Publisher: Standalone ghcfa-telem (version <version>) | Installation failed: installer returned no executable path.
Publisher: Standalone ghcfa-telem (version <version>) | Execution failed with status 1.
```

A successful installer exit without an executable path is reported as a
contract failure, not as an installation failure with status `0`.

PowerShell logs `Execution failed to start.` when invocation throws; Bash reports
the shell exit status, such as `126` when an executable cannot run or `127` for
a missing executable. Publisher output is suppressed rather than added to the
log. Installer diagnostics are retained.
Logging does not change publisher selection, telemetry opt-out, or fail-open
behavior: the hook still returns `{"continue":true}`, and reporter failures do
not trigger a fallback.

## Misc

Most clients look for `hooks/hooks.json` as the default hook configuration and try to use it if no explicit `hooks` property is defined in the plugin manifest. We decided to explicitly define a hooks manifest for every client because it's impossible to create one hooks manifest for all clients. Copilot/VS Code, Claude and Cursor use mutually exclusive schema for hooks manifest, which means the manifest is guaranteed to cause syntax errors in one or more clients. Besides, clients use different variables to represent the plugin root. Having the incorrect variable will cause the client to fail to resolve the script path, resulting in runtime failures.

For this reason there is intentionally no file at the default `hooks/hooks.json` path. The Copilot/VS Code manifest is named `copilot-hooks.json` and is referenced explicitly from the legacy Copilot plugin manifest. If a Copilot-format `hooks.json` were left at the default path, clients such as Claude Code — whose `hooks` property is *additive* to the default discovery rather than a replacement — would also load it and fail schema validation against their own hooks manifest (see [issue #2957](https://github.com/microsoft/GitHub-Copilot-for-Azure/issues/2957)).