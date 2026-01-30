# Azure Functions Templates Reference

## Preferred: Deploy with Azure Developer CLI (azd)

> **Prefer `azd` over raw `az` CLI for deployments.**

**Why azd is preferred:**
- **Flex Consumption** plan (required for new deployments)
- **Parallel provisioning** - Deploys in seconds, not minutes
- **Single command** - `azd up` replaces 5+ `az` commands
- **Secure-by-default** - Managed identity with RBAC, no connection strings
- **Infrastructure as Code** - Reproducible with Bicep

**When `az` CLI is acceptable:**
- Single-resource deployments without IaC requirements
- Quick prototyping or one-off deployments
- User explicitly requests `az` CLI
- Querying or inspecting existing resources

> ⚠️ **IMPORTANT**: For automation and agent scenarios, always use `--no-prompt` flag.

---

## MCP Tools for azd Workflows

| Command | Description |
|---------|-------------|
| `validate_azure_yaml` | Validates azure.yaml against official JSON schema |
| `discovery_analysis` | Analyze application components for AZD migration |
| `architecture_planning` | Select Azure services for discovered components |
| `infrastructure_generation` | Generate Bicep templates |
| `project_validation` | Comprehensive validation before deployment |
| `error_troubleshooting` | Diagnose and troubleshoot azd errors |

---

## Non-Interactive Deployment

```bash
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"
azd init -t <TEMPLATE> -e "$ENV_NAME"
azd provision --preview
azd up --no-prompt
```

> ⚠️ `azd down --force --purge` permanently deletes ALL resources including Key Vault.

---

## Template Selection Decision Tree

Check indicators in order:

1. **MCP server?** (`mcp_tool_trigger`, `MCPTrigger`, `@app.mcp_tool`) → MCP Template
2. **Cosmos DB?** (`CosmosDBTrigger`, `@app.cosmos_db`) → Cosmos Template
3. **Azure SQL?** (`SqlTrigger`, `@app.sql`) → SQL Template
4. **AI/OpenAI?** (`openai`, `AzureOpenAI`, `langchain`) → AI Template
5. **SWA full-stack?** (`staticwebapp.config.json`) → SWA+Functions Template
6. **Default** → HTTP Template by runtime

---

## MCP Server Templates

**Indicators**: `mcp_tool_trigger`, `MCPTrigger`, `@app.mcp_tool`, project name contains "mcp"

| Language | Template |
|----------|----------|
| Python | `azd init -t remote-mcp-functions-python` |
| TypeScript | `azd init -t remote-mcp-functions-typescript` |
| C# (.NET) | `azd init -t remote-mcp-functions-dotnet` |
| Java | `azd init -t remote-mcp-functions-java` |

**MCP + API Management (OAuth):**
| Language | Template |
|----------|----------|
| Python | `azd init -t remote-mcp-apim-functions-python` |

**Self-Hosted MCP SDK:**
| Language | Template |
|----------|----------|
| Python | `azd init -t remote-mcp-sdk-functions-hosting-python` |
| TypeScript | `azd init -t remote-mcp-sdk-functions-hosting-node` |
| C# | `azd init -t remote-mcp-sdk-functions-hosting-dotnet` |

**GitHub Repositories:**
- [remote-mcp-functions-python](https://github.com/Azure-Samples/remote-mcp-functions-python)
- [remote-mcp-functions-typescript](https://github.com/Azure-Samples/remote-mcp-functions-typescript)
- [remote-mcp-functions-dotnet](https://github.com/Azure-Samples/remote-mcp-functions-dotnet)
- [remote-mcp-functions-java](https://github.com/Azure-Samples/remote-mcp-functions-java)

---

## HTTP Function Templates (Default)

| Runtime | Template |
|---------|----------|
| C# (.NET) | `azd init -t functions-quickstart-dotnet-azd` |
| JavaScript | `azd init -t functions-quickstart-javascript-azd` |
| TypeScript | `azd init -t functions-quickstart-typescript-azd` |
| Python | `azd init -t functions-quickstart-python-http-azd` |
| Java | `azd init -t azure-functions-java-flex-consumption-azd` |
| PowerShell | `azd init -t functions-quickstart-powershell-azd` |

---

## Integration Templates

### Full-Stack (SWA + Functions)
| Stack | Sample |
|-------|--------|
| C# + SQL | [todo-csharp-sql-swa-func](https://github.com/Azure-Samples/todo-csharp-sql-swa-func) |
| Node + MongoDB | [todo-nodejs-mongo-swa-func](https://github.com/azure-samples/todo-nodejs-mongo-swa-func) |

### Database & AI Templates
| Service | Templates |
|---------|-----------|
| Cosmos DB | [Awesome AZD Cosmos](https://azure.github.io/awesome-azd/?tags=functions&name=cosmos) |
| Azure SQL | [Awesome AZD SQL](https://azure.github.io/awesome-azd/?tags=functions&name=sql) |
| OpenAI/AI Foundry | [Awesome AZD AI](https://azure.github.io/awesome-azd/?tags=functions&name=ai) |

### Trigger & Binding Quick Reference
| Service | Trigger | Input | Output |
|---------|---------|-------|--------|
| Cosmos DB | ✅ | ✅ | ✅ |
| Azure SQL | ✅ | ✅ | ✅ |
| Storage Blob/Queue | ✅ | ✅ | ✅ |
| Service Bus | ✅ | ❌ | ✅ |
| Event Grid/Hubs | ✅ | ❌ | ✅ |
| Azure OpenAI | ❌ | ✅ | ✅ |
| SignalR | ✅ | ✅ | ✅ |

**Browse all templates:** [Awesome AZD Functions](https://azure.github.io/awesome-azd/?tags=functions)

---

## What azd Creates (Secure-by-Default)

- **Flex Consumption plan** (required for new deployments)
- User-assigned managed identity
- RBAC role assignments (no connection strings)
- Storage with `allowSharedKeyAccess: false`
- App Insights with `disableLocalAuth: true`
- Optional VNET with private endpoints

---

## Key Flags for Non-Interactive Mode

| Flag | Purpose |
|------|---------|
| `-e <name>` | Set environment name (avoids prompt) |
| `-t <template>` | Specify template |
| `--no-prompt` | Skip all confirmations (REQUIRED for automation/agents) |

> ⚠️ **`azd env set` vs Application Environment Variables**
>
> **`azd env set`** sets variables for the **azd provisioning process**, NOT application runtime environment variables.
>
> **Application environment variables** must be configured:
> 1. In Bicep templates
> 2. Via `az functionapp config appsettings set`
> 3. In local.settings.json (local dev only)
