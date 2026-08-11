# Hooks

Hooks manifests are the `hooks.json` files that tells the agent what hooks to execute.

These files are used by clients when running agent sessions. We have to maintain separate plugin manifest for different clients before they work in different ways.

## Copilot CLI

Copilot CLI uses the `copilot-hooks.json` hooks manifest, referenced explicitly via the `hooks` property in the Copilot plugin manifest (`.plugin/plugin.json`). Although it shares the manifest with VS Code, it only uses the `bash` and `powershell` properties defined in it. At runtime, Copilot CLI replaces the `PLUGIN_ROOT` variable to construct the path that can resolve the scripts. On macOS and Linux, it executes the `bash` script. On Windows, it executes the `powershell` script.

## VS Code

VS Code uses the `copilot-hooks.json` hooks manifest. Although it shares the manifest with Copilot CLI, it only uses the `windows`, `osx` and `linux` properties defined in it. At runtime, VS Code replaces the `PLUGIN_ROOT` variable to construct the path that can resolve the scripts. It then executes the script matching the host OS.

## Claude Code

Claude Code uses the `claude-hooks.json` hooks manifest. Its manifest defines a nested `hooks` array under each event, making it unique from other clients' hooks manifests. At runtime, Claude Code replaces the `CLAUDE_PLUGIN_ROOT` variable to construct the path that can resolve to the scripts. It then executes the script with bash.

## Cursor

Cursor uses the `cursor-hooks.json` hooks manifest. At runtime, Cursor replaces the `CURSOR_PLUGIN_ROOT` variable to construct the path that can resolve to the scripts. It then executes the script with bash.

## Misc

Most clients look for `hooks/hooks.json` as the default hook configuration and try to use it if no explicit `hooks` property is defined in the plugin manifest. We decided to explicitly define a hooks manifest for every client because it's impossible to create one hooks manifest for all clients. Copilot/VS Code, Claude and Cursor use mutually exclusive schema for hooks manifest, which means the manifest is guaranteed to cause syntax errors in one or more clients. Besides, clients use different variables to represent the plugin root. Having the incorrect variable will cause the client to fail to resolve the script path, resulting in runtime failures.

For this reason there is intentionally no file at the default `hooks/hooks.json` path. The Copilot/VS Code manifest is named `copilot-hooks.json` and is referenced explicitly from the Copilot plugin manifest. If a Copilot-format `hooks.json` were left at the default path, clients such as Claude Code — whose `hooks` property is *additive* to the default discovery rather than a replacement — would also load it and fail schema validation against their own hooks manifest (see [issue #2957](https://github.com/microsoft/GitHub-Copilot-for-Azure/issues/2957)).