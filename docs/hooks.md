# Hooks

Hooks manifests are the `hooks.json` files that tells the agent what hooks to execute.

These files are used by clients when running agent sessions. We have to maintain separate plugin manifest for different clients before they work in different ways.

## Copilot CLI

Copilot CLI uses the `copilot-hooks.json` hooks manifest, referenced explicitly via the `hooks` property in the Copilot plugin manifest (`.plugin/plugin.json`). Although it shares the manifest with VS Code, it only uses the `bash` and `powershell` properties defined in it. At runtime, Copilot CLI replaces the `PLUGIN_ROOT` variable to construct the path that can resolve the scripts. On macOS and Linux, it executes the `bash` script. On Windows, it executes the `powershell` script.

The `SessionStart` hook reports new and resumed sessions. Copilot CLI is identified through its `COPILOT_CLI` environment variable, and plugin metadata is read from `.plugin/plugin.json`.

## VS Code

VS Code uses the `copilot-hooks.json` hooks manifest. Although it shares the manifest with Copilot CLI, it only uses the `windows`, `osx` and `linux` properties defined in it. At runtime, VS Code replaces the `PLUGIN_ROOT` variable to construct the path that can resolve the scripts. It then executes the script matching the host OS.

The shared manifest marks its hooks as belonging to the Copilot/VS Code client family so session-start payloads without tool or transcript fields are still identified as VS Code. Plugin metadata is read from `.plugin/plugin.json`.

## Claude Code

Claude Code uses the `claude-hooks.json` hooks manifest. Its manifest defines a nested `hooks` array under each event, making it unique from other clients' hooks manifests. At runtime, Claude Code replaces the `CLAUDE_PLUGIN_ROOT` variable to construct the path that can resolve to the scripts. It then executes the script with bash.

The `SessionStart` hook reports both startup and resume events. Plugin metadata is read from `.claude-plugin/plugin.json`.

## Cursor

Cursor uses the `cursor-hooks.json` hooks manifest. At runtime, Cursor replaces the `CURSOR_PLUGIN_ROOT` variable to construct the path that can resolve to the scripts. It invokes the Node.js dispatcher, which selects PowerShell on Windows and Bash on macOS and Linux.

The `sessionStart` hook reports each new Composer conversation. Plugin metadata is read from `.cursor-plugin/plugin.json`.

## Session-start telemetry

The build copies the shared hooks into every plugin package. Each installed plugin therefore reports its own session-start event with:

- `--plugin-name` and `--plugin-version` from the active client's `plugin.json`
- `--client-name` for the detected host
- `--timestamp` generated in UTC ISO-8601 format
- `--event-type session_start`
- `--session-id` from the host payload

The `plugin-telemetry` command requires a session ID, so the hook does not report a session-start event when the host omits it. Telemetry opt-out and fail-open behavior are the same as for the existing tool, skill, and reference-file events.

## Standalone telemetry reporter rollout

The hooks continue to publish through `npx -y @azure/mcp@latest` by default.
Set `AZURE_SKILLS_USE_STANDALONE_TELEMETRY=true` to opt into the standalone
Native AOT reporter. The hooks currently request reporter version `0.1.0` and
install the matching release asset:

```text
https://github.com/microsoft/GitHub-Copilot-for-Azure/releases/download/0.1.0/ghcfa-telem-0.1.0-<rid>.zip
```

Until that release exists, set `AZURE_SKILLS_TELEMETRY_ZIP_PATH` to a local
runtime ZIP produced by `telemetry-reporter/eng/scripts/Build-Native.ps1`.
The ZIP override does not enable the standalone path by itself; the rollout
variable must also be set to `true`.

The installer detects the native operating system and architecture, including
Apple Silicon when Bash runs under Rosetta. It installs each version and RID
once, then reuses the cached executable:

- Windows: `%LOCALAPPDATA%\GitHubCopilotForAzure\telemetry\<version>\<rid>\ghcfa-telem.exe`
- macOS/Linux: `${XDG_CACHE_HOME:-$HOME/.cache}/github-copilot-for-azure/telemetry/<version>/<rid>/ghcfa-telem`

The current reporter packages target Windows, macOS, and glibc-based Linux on
x64 and ARM64. Alpine and other musl-based Linux systems are detected but not
treated as generic Linux; the opted-in hook records the unsupported platform in
the telemetry debug log and otherwise succeeds without publishing.

When standalone mode is enabled, installation or reporter failures remain
fail-open for the host hook and do not fall back to `npx`. This makes rollout
testing deterministic while preserving the existing publisher for everyone
who has not enabled the new path.

## Misc

Most clients look for `hooks/hooks.json` as the default hook configuration and try to use it if no explicit `hooks` property is defined in the plugin manifest. We decided to explicitly define a hooks manifest for every client because it's impossible to create one hooks manifest for all clients. Copilot/VS Code, Claude and Cursor use mutually exclusive schema for hooks manifest, which means the manifest is guaranteed to cause syntax errors in one or more clients. Besides, clients use different variables to represent the plugin root. Having the incorrect variable will cause the client to fail to resolve the script path, resulting in runtime failures.

For this reason there is intentionally no file at the default `hooks/hooks.json` path. The Copilot/VS Code manifest is named `copilot-hooks.json` and is referenced explicitly from the Copilot plugin manifest. If a Copilot-format `hooks.json` were left at the default path, clients such as Claude Code — whose `hooks` property is *additive* to the default discovery rather than a replacement — would also load it and fail schema validation against their own hooks manifest (see [issue #2957](https://github.com/microsoft/GitHub-Copilot-for-Azure/issues/2957)).