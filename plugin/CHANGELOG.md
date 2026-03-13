# Changelog

All notable changes to the Azure plugin will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2025-03-13

### Added

- Initial release of the Azure plugin.
- Vendor-neutral `.plugin/plugin.json` manifest following the [Open Plugins Specification](https://open-plugins.com/plugin-builders/specification).
- Claude Code manifest (`.claude-plugin/plugin.json`).
- MCP server configuration (`.mcp.json`) for Azure MCP, Foundry MCP, and Context7.
- MIT `LICENSE` file at the plugin root.
- 21 agent skills:
  - `appinsights-instrumentation` — Azure Application Insights telemetry setup.
  - `azure-ai` — Azure AI Search, Speech, OpenAI, and Document Intelligence.
  - `azure-aigateway` — Azure API Management as an AI Gateway.
  - `azure-cloud-migrate` — Cross-cloud migration assessment and code conversion.
  - `azure-compliance` — Security auditing and best practices assessment.
  - `azure-compute` — VM size recommendation and configuration.
  - `azure-cost-optimization` — Cost savings analysis and recommendations.
  - `azure-deploy` — Azure deployment execution (azd, Bicep, Terraform).
  - `azure-diagnostics` — Production issue debugging and log analysis.
  - `azure-hosted-copilot-sdk` — Build and deploy GitHub Copilot SDK apps to Azure.
  - `azure-kusto` — Azure Data Explorer KQL queries.
  - `azure-messaging` — Event Hubs and Service Bus SDK troubleshooting.
  - `azure-prepare` — Application preparation for Azure deployment.
  - `azure-quotas` — Quota and usage management.
  - `azure-rbac` — RBAC role recommendation and assignment.
  - `azure-resource-lookup` — Azure resource discovery and listing.
  - `azure-resource-visualizer` — Mermaid architecture diagram generation.
  - `azure-storage` — Blob, File, Queue, Table, and Data Lake storage.
  - `azure-validate` — Pre-deployment validation checks.
  - `entra-app-registration` — Microsoft Entra ID app registration and OAuth setup.
  - `microsoft-foundry` — Foundry agent deployment, evaluation, and management.