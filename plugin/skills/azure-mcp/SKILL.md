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
- Try `azure_subscription_list` to list subscriptions

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

## Core Operations

| Tool | Description |
|------|-------------|
| `azure_subscription_list` | List all subscriptions |
| `azure_resource_group_list` | List resource groups in subscription |

## Storage

| Tool | Description |
|------|-------------|
| `azure_storage_account_list` | List storage accounts |
| `azure_storage_container_list` | List containers in account |
| `azure_storage_blob_list` | List blobs in container |
| `azure_storage_blob_get` | Download blob content |
| `azure_storage_blob_put` | Upload blob content |

## SQL Database

| Tool | Description |
|------|-------------|
| `azure_sql_server_list` | List SQL servers |
| `azure_sql_database_list` | List databases on server |
| `azure_sql_firewall_list` | List firewall rules |

## Cosmos DB

| Tool | Description |
|------|-------------|
| `azure_cosmosdb_account_list` | List Cosmos DB accounts |
| `azure_cosmosdb_database_list` | List databases in account |
| `azure_cosmosdb_container_list` | List containers |

## Redis

| Tool | Description |
|------|-------------|
| `azure_redis_cache_list` | List Redis caches |

## Key Vault

| Tool | Description |
|------|-------------|
| `azure_keyvault_list` | List Key Vaults |
| `azure_keyvault_secret_list` | List secrets in vault |
| `azure_keyvault_secret_get` | Get secret value |
| `azure_keyvault_key_list` | List keys |
| `azure_keyvault_certificate_list` | List certificates |

## RBAC

| Tool | Description |
|------|-------------|
| `azure_rbac_role_assignment_list` | List role assignments |
| `azure_rbac_role_definition_list` | List role definitions |

## App Service

| Tool | Description |
|------|-------------|
| `azure_appservice_webapp_list` | List web apps |
| `azure_appservice_webapp_get` | Get app details |
| `azure_appservice_plan_list` | List App Service plans |

## Functions

| Tool | Description |
|------|-------------|
| `azure_function_app_list` | List function apps |

## AKS

| Tool | Description |
|------|-------------|
| `azure_aks_cluster_list` | List AKS clusters |
| `azure_aks_nodepool_list` | List node pools |

## Container Apps

| Tool | Description |
|------|-------------|
| `azure_container_app_list` | List container apps |

## AI Search

| Tool | Description |
|------|-------------|
| `azure_search_index_list` | List search indexes |
| `azure_search_index_get` | Get index details |
| `azure_search_query` | Query search index |

## Speech

| Tool | Description |
|------|-------------|
| `azure_speech_transcribe` | Speech to text |
| `azure_speech_synthesize` | Text to speech |

## Foundry

| Tool | Description |
|------|-------------|
| `azure_foundry_model_list` | List AI models |
| `azure_foundry_deployment_list` | List deployments |
| `azure_foundry_agent_list` | List AI agents |

## Monitoring

| Tool | Description |
|------|-------------|
| `azure_monitor_metrics_query` | Query metrics |
| `azure_monitor_logs_query` | Query logs with KQL |
| `azure_applicationinsights_component_list` | List App Insights |

## CLI Helpers

| Tool | Description |
|------|-------------|
| `azure__extension_cli_install` | Get CLI installation instructions |
| `azure__extension_cli_generate` | Generate Azure CLI commands |

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
