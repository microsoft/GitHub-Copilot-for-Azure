# Plugin Manifest

## Agent Plugins 1.0

Every plugin provides a root `plugin.json` conforming to
[Agent Plugins 1.0.0](https://agent-plugins.org/specification), with
`$schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"`.
It contains plugin identity and metadata, not component paths or inline
configuration. Clients discover skills from `skills/` and MCP servers
from root `mcp.json`.

The portable MCP configuration declares
`$schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json"` and an
`mcpServers` object. Local executable servers use `type: "stdio"`; remote
Streamable HTTP servers use `type: "streamable-http"`. Empty server maps
are valid. Keep server names and configuration equivalent to the retained
legacy `.mcp.json`, whose client-specific transport syntax is unchanged.

The build produces `com.github.copilot/hooks/hooks.json` from compiled
`hooks/copilot-hooks.json`, including plugin-local Copilot fragments.
This is a file-based Copilot extension, not a portable hook component.
It preserves the Copilot hook format and references existing scripts
under `${PLUGIN_ROOT}/hooks/scripts/`. Other clients ignore this namespace.

Source manifests use `0.0.0-placeholder`; the build stamps the same real
version into root and legacy manifests. Use built packages from
`output/<plugin>/`, which include shared hooks and generated metadata.

## Legacy client manifests

The existing `.plugin/plugin.json`, `.claude-plugin/plugin.json`,
`.cursor-plugin/plugin.json`, and `.mcp.json` files are retained for
backwards compatibility.

These manifests describe plugin metadata and component paths for clients
using their older formats. They remain alongside the portable manifest;
they do not override its core metadata.

Every plugin manifest references a dedicated hooks manifest because every client supports hooks in incompatible ways.

### Copilot CLI

Copilot CLI looks for the `.plugin/plugin.json` file. It references a hooks manifest shared with VS Code.

### VS Code

VS Code's legacy plugin manifest is `.plugin/plugin.json`. It references a hooks manifest shared with Copilot CLI.

### Claude Code

Claude Code looks for the `.claude-plugin/plugin.json` file. It references its dedicated `claude-hooks.json` hooks manifest.

### Cursor

Cursor looks for the `.cursor-plugin/plugin.json`. It references a dedicated `cursor-hooks.json` hooks manifest. It also has a `logo` property referencing an image file. Cursor marketplace presents the [azure](https://cursor.com/marketplace/azure) plugin with the icon in its website. This log is not required if the plugin is not onboarded to the official Cursor marketplace.