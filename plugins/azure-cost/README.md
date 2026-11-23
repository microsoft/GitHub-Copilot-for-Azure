# Azure Cost

Azure cost analysis, estimation, optimization, and governance skills backed by
the Azure Resource Manager MCP server.

## Install or migrate

Choose one installation route. The [Awesome Copilot catalog page](https://awesome-copilot.github.com/plugin/azure-cost/)
is the browser fallback if a client link does not open.

### VS Code

[Install in VS Code](vscode://chat-plugin/install?source=github%2Fawesome-copilot&plugin=azure-cost)

### GitHub Copilot app

[Install in GitHub Copilot app](ghapp://plugins/install?source=azure-cost%40awesome-copilot)

### Copilot CLI — terminal

Run in your terminal:

```text
copilot plugin install azure-cost@awesome-copilot
```

Client availability and organization policy may restrict plugin installation.
Confirm the plugin is enabled and its skills are visible before starting a fresh
conversation. Installation does not grant Azure permissions or authorize changes.

### Direct Microsoft marketplace — interactive Copilot CLI

Enter these slash commands inside an interactive Copilot CLI session, not in
Bash or PowerShell:

1. Add the marketplace: `/plugin marketplace add microsoft/azure-skills`
2. Install this plugin: `/plugin install azure-cost@azure-skills`

Awesome Copilot pins published package revisions, so its version can differ from
the direct Microsoft marketplace. Update using the marketplace suffix of the
installed copy: `/plugin update azure-cost@awesome-copilot` or
`/plugin update azure-cost@azure-skills`, inside interactive Copilot CLI.
Avoid duplicate copies across marketplaces or alongside extension-managed skills;
remove the previous copy when migrating.

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.

## Skills

| Skill | Workflows |
|-------|-----------|
| **cost-analysis** | Cost query, cost investigation, and AKS cost analysis |
| **cost-estimation** | Cost forecast and pricing estimate |
| **cost-optimization** | Cost optimization and commitment analysis |
| **cost-governance** | Budget health, budget setup, and cost guardrails |

## MCP server

The plugin connects to `https://mcp.management.azure.com` and opts into the
`CostManagement` toolset. Core query and pricing tools are enabled by default:
`query_costs`, `query_aks_costs`, `get_retail_prices`,
`start_pricesheet_download`, and `get_pricesheet_status`. Opt-in Cost Management
operations support forecasts, budgets, alerts, and benefit analysis.
