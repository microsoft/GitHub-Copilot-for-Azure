# Plugin Manifest

Plugin manifests are the `plugin.json` files that describes the information of a plugin and where to look for its content, such as skills, mcp servers and hooks.

These files are used by clients when they installs a plugin. We have to maintain separate plugin manifest for different clients before they work in different ways.

Every plugin manifest references a dedicated hooks manifest because every client supports hooks in incompatible ways.

## Copilot CLI

Copilot CLI looks for the `.plugin/plugin.json` file. It references a hooks manifest shared with VS Code.

## VS Code

Copilot CLI looks for the `.plugin/plugin.json` file. It references a hooks manifest shared with Copilot CLI.

## Claude Code

Claude Code looks for the `.claude-plugin/plugin.json` file. It references its dedicated `claude-hooks.json` hooks manifest.

## Cursor

Cursor looks for the `.cursor-plugin/plugin.json`. It references a dedicated `cursor-hooks.json` hooks manifest. It also has a `logo` property referencing an image file. Cursor marketplace presents the [azure](https://cursor.com/marketplace/azure) plugin with the icon in its website. This log is not required if the plugin is not onboarded to the official Cursor marketplace.