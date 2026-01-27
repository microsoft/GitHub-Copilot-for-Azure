---
name: azure-mcp
description: Set up and use the Azure MCP server for direct access to Azure services through structured tools
---

# Azure MCP Server

## Overview

The Azure MCP server provides direct access to Azure services through structured tools, enabling richer data access than CLI commands alone.

## Configuration

Add to your MCP configuration (`.mcp.json` or settings):

```json
{
  "mcpServers": {
    "azure": {
      "command": "npx",
      "args": ["-y", "@azure/mcp@latest", "server", "start"],
      "env": {}
    }
  }
}
```

## Authentication

The Azure MCP server uses Azure CLI credentials by default.

### Login First

```bash
# Interactive login
az login

# Device code flow (headless/remote)
az login --use-device-code

# Set subscription
az account set --subscription "Subscription Name"
```

### Service Principal (CI/CD)

Set environment variables:
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`

## Enabling the MCP Server

### In Claude Code

1. Run `/mcp` to view MCP servers
2. Enable the Azure MCP server
3. Or run `/azure:setup` for guided configuration

### Verify Connection

After enabling, verify tools are available:
- Check `/azure:status`
- Try `azure__subscription_list` to list subscriptions

## Benefits Over CLI

| Feature | MCP Server | CLI |
|---------|------------|-----|
| Structured data | JSON responses | Text parsing needed |
| Pagination | Automatic | Manual continuation |
| Schema info | Built-in | Separate queries |
| Authentication | Managed | Manual |

## Troubleshooting

### Server Not Starting

1. Ensure Node.js 18+ is installed
2. Check npx is available
3. Verify network access to npm registry

### Authentication Errors

1. Run `az login` to refresh credentials
2. Check subscription is set: `az account show`
3. Verify permissions on target resources

### Tool Not Available

1. Enable the Azure MCP server first
2. Check server is connected in `/mcp`
3. Some tools require specific permissions

## Fallback to CLI

When MCP is unavailable, use Azure CLI directly:

```bash
# List subscriptions
az account list --output table

# List resources
az resource list -g RESOURCE_GROUP --output table
```

See `cli/cheatsheet.md` for common CLI commands.

---

# Tool Reference

The Azure MCP server exposes two types of tools:
- **Standalone tools**: Called directly (e.g., `azure__subscription_list`)
- **Hierarchical tools**: Called with a `command` parameter (e.g., `azure__deploy` with command `deploy_plan_get`)

## Core Operations

| Tool | Description |
|------|-------------|
| `azure__subscription_list` | List all subscriptions |
| `azure__group_list` | List resource groups in subscription |

## Storage

| Tool | Command | Description |
|------|---------|-------------|
| `azure__storage` | `storage_account_list` | List storage accounts |
| `azure__storage` | `storage_container_list` | List containers in account |
| `azure__storage` | `storage_blob_list` | List blobs in container |
| `azure__storage` | `storage_blob_get` | Download blob content |
| `azure__storage` | `storage_blob_put` | Upload blob content |

## SQL Database

| Tool | Command | Description |
|------|---------|-------------|
| `azure__sql` | `sql_server_list` | List SQL servers |
| `azure__sql` | `sql_database_list` | List databases on server |
| `azure__sql` | `sql_firewall_list` | List firewall rules |

## Cosmos DB

| Tool | Command | Description |
|------|---------|-------------|
| `azure__cosmos` | `cosmos_account_list` | List Cosmos DB accounts |
| `azure__cosmos` | `cosmos_database_list` | List databases in account |
| `azure__cosmos` | `cosmos_container_list` | List containers |

## Redis

| Tool | Command | Description |
|------|---------|-------------|
| `azure__redis` | `redis_cache_list` | List Redis caches |

## Key Vault

| Tool | Command | Description |
|------|---------|-------------|
| `azure__keyvault` | `keyvault_list` | List Key Vaults |
| `azure__keyvault` | `keyvault_secret_list` | List secrets in vault |
| `azure__keyvault` | `keyvault_secret_get` | Get secret value |
| `azure__keyvault` | `keyvault_key_list` | List keys |
| `azure__keyvault` | `keyvault_certificate_list` | List certificates |

## RBAC

| Tool | Command | Description |
|------|---------|-------------|
| `azure__role` | `role_assignment_list` | List role assignments |
| `azure__role` | `role_definition_list` | List role definitions |

## App Service

| Tool | Command | Description |
|------|---------|-------------|
| `azure__appservice` | `appservice_webapp_list` | List web apps |
| `azure__appservice` | `appservice_webapp_get` | Get app details |
| `azure__appservice` | `appservice_plan_list` | List App Service plans |

## Functions

| Tool | Command | Description |
|------|---------|-------------|
| `azure__functionapp` | `functionapp_list` | List function apps |

## AKS

| Tool | Command | Description |
|------|---------|-------------|
| `azure__aks` | `aks_cluster_list` | List AKS clusters |
| `azure__aks` | `aks_nodepool_list` | List node pools |

## Container Apps

| Tool | Command | Description |
|------|---------|-------------|
| `azure__appservice` | `containerapp_list` | List container apps |

## AI Search

| Tool | Command | Description |
|------|---------|-------------|
| `azure__search` | `search_index_list` | List search indexes |
| `azure__search` | `search_index_get` | Get index details |
| `azure__search` | `search_query` | Query search index |

## Speech

| Tool | Command | Description |
|------|---------|-------------|
| `azure__speech` | `speech_transcribe` | Speech to text |
| `azure__speech` | `speech_synthesize` | Text to speech |

## Foundry

| Tool | Command | Description |
|------|---------|-------------|
| `azure__foundry` | `foundry_model_list` | List AI models |
| `azure__foundry` | `foundry_deployment_list` | List deployments |
| `azure__foundry` | `foundry_agent_list` | List AI agents |

## Monitoring

| Tool | Command | Description |
|------|---------|-------------|
| `azure__monitor` | `monitor_metrics_query` | Query metrics |
| `azure__monitor` | `monitor_logs_query` | Query logs with KQL |
| `azure__applicationinsights` | `applicationinsights_component_list` | List App Insights |
| `azure__resourcehealth` | *(various)* | Check resource health and availability |
| `azure__applens` | *(conversational)* | AI-powered diagnostics for troubleshooting Azure resource issues |

## Deployment & Infrastructure

| Tool | Command | Description |
|------|---------|-------------|
| `azure__deploy` | `deploy_plan_get` | Generate a deployment plan for Azure infrastructure |
| `azure__deploy` | `deploy_iac_rules_get` | Get IaC (Bicep/Terraform) guidelines |
| `azure__deploy` | `deploy_app_logs_get` | Fetch logs from deployed apps |
| `azure__deploy` | `deploy_pipeline_guidance_get` | Get CI/CD pipeline guidance |
| `azure__deploy` | `deploy_architecture_diagram_generate` | Generate architecture diagrams |
| `azure__bicepschema` | *(schema queries)* | Get Bicep resource type schemas |
| `azure__quota` | `quota_region_availability_list` | Check regional quota and availability |

## Best Practices

| Tool | Command | Description |
|------|---------|-------------|
| `azure__get_azure_bestpractices` | *(various)* | Get Azure best practices for code generation and deployment |

## Documentation

| Tool | Description |
|------|-------------|
| `azure__documentation` | Search official Microsoft/Azure documentation |

## CLI Helpers

| Tool | Description |
|------|-------------|
| `azure__extension_cli_install` | Get CLI installation instructions |
| `azure__extension_cli_generate` | Generate Azure CLI commands |
| `azure__extension_azqr` | Run Azure Quick Review for compliance/security reports |

### CLI Install Tool

```
Parameters:
  - cli-type: "az" | "azd" | "func"
```

### CLI Generate Tool

```
Parameters:
  - intent: Description of what you want to do
  - cli-type: "az"
```
