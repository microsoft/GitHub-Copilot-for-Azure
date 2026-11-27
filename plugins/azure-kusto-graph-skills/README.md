# Azure Kusto Graph Skills

Kusto graph analysis, IRQL security hunting pipelines, and graph visualization skills for Azure Data Explorer.

## Installation

Install the plugin using one of the methods below, or via the [Awesome Copilot catalog page](https://awesome-copilot.github.com/plugin/azure-kusto-graph-skills/).

### VS Code

[Install in VS Code](vscode://chat-plugin/install?source=github%2Fawesome-copilot&plugin=azure-kusto-graph-skills)

### GitHub Copilot app

[Install in GitHub Copilot app](ghapp://plugins/install?source=azure-kusto-graph-skills%40awesome-copilot)

### Copilot CLI — terminal

Run in your terminal:

```text
copilot plugin install azure-kusto-graph-skills@awesome-copilot
```

## Security

> [!WARNING]
> The `azure-kusto-graph-skills` plugin uses `npx` to download and run the Azure MCP Server, inheriting the local environment's `.npmrc` configuration. Install this plugin only on trusted devices. A compromised `.npmrc` configuration could cause `npx` to download and execute malicious code, potentially resulting in remote code execution.

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.

## Skills

- **azure-kusto-graph** — Build and query graphs using KQL graph operators (make-graph, graph-match, shortest paths, connected components, persistent models)
- **azure-kusto-irql** — Compose IRQL incident response pipelines using Get_*, Extract_*, and Enrich_* functions
- **azure-kusto-irql-graph** — Generate Lift_To_Graph mappings and Graph_Render_View visualizations from query results
