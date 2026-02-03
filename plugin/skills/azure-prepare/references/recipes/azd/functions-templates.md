# Azure Functions Templates

Azure Functions template selection for AZD-based deployments.

## When to Use Functions

Use Azure Functions when your application needs:
- Event-driven workloads
- Scheduled tasks (cron jobs)
- HTTP APIs with variable traffic
- Message/queue processing
- Real-time file processing
- Serverless compute preference

## Template Selection Decision Tree

**CRITICAL**: Check for specific integration indicators IN ORDER before defaulting to HTTP.

```
1. Is this an MCP server?
   Indicators: mcp_tool_trigger, MCPTrigger, @app.mcp_tool, "mcp" in project name
   └─► YES → Use MCP Template

2. Does it use Cosmos DB?
   Indicators: CosmosDBTrigger, @app.cosmos_db, cosmos_db_input, cosmos_db_output
   └─► YES → Use Cosmos DB Template: https://azure.github.io/awesome-azd/?tags=functions&name=cosmos

3. Does it use Azure SQL?
   Indicators: SqlTrigger, @app.sql, sql_input, sql_output, SqlInput, SqlOutput
   └─► YES → Use SQL Template: https://azure.github.io/awesome-azd/?tags=functions&name=sql

4. Does it use AI/OpenAI?
   Indicators: openai, AzureOpenAI, azure-ai-openai, langchain, langgraph, semantic_kernel,
               Microsoft.Agents, azure-ai-projects, CognitiveServices, text_completion,
               embeddings_input, ChatCompletions, azure.ai.inference, @azure/openai
   └─► YES → Use AI Template: https://azure.github.io/awesome-azd/?tags=functions&name=ai

5. Is it a full-stack app with SWA?
   Indicators: staticwebapp.config.json, swa-cli, @azure/static-web-apps
   └─► YES → Use SWA+Functions Template (see Integration Templates below)

6. DEFAULT → Use HTTP Template by runtime
```

## MCP Server Templates

**Indicators**: `mcp_tool_trigger`, `MCPTrigger`, `@app.mcp_tool`, project name contains "mcp"

| Language | MCP Template |
|----------|--------------|
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

## Integration Templates (Cosmos DB, SQL, AI, SWA)

**Browse by service to find the right template:**
| Service | Find Templates |
|---------|----------------|
| Cosmos DB | [Awesome AZD Cosmos](https://azure.github.io/awesome-azd/?tags=functions&name=cosmos) |
| Azure SQL | [Awesome AZD SQL](https://azure.github.io/awesome-azd/?tags=functions&name=sql) |
| AI/OpenAI | [Awesome AZD AI](https://azure.github.io/awesome-azd/?tags=functions&name=ai) |
| SWA + Functions | [todo-csharp-sql-swa-func](https://github.com/Azure-Samples/todo-csharp-sql-swa-func), [todo-nodejs-mongo-swa-func](https://github.com/azure-samples/todo-nodejs-mongo-swa-func) |

## HTTP Function Templates (Default - use only if no specific integration)

| Runtime | Template |
|---------|----------|
| C# (.NET) | `azd init -t functions-quickstart-dotnet-azd` |
| JavaScript | `azd init -t functions-quickstart-javascript-azd` |
| TypeScript | `azd init -t functions-quickstart-typescript-azd` |
| Python | `azd init -t functions-quickstart-python-http-azd` |
| Java | `azd init -t azure-functions-java-flex-consumption-azd` |
| PowerShell | `azd init -t functions-quickstart-powershell-azd` |

**Browse all templates:** [Awesome AZD Functions](https://azure.github.io/awesome-azd/?tags=functions)

## Template Usage

**Key flags for non-interactive mode:**
| Flag | Purpose |
|------|---------|
| `-e <name>` | Set environment name (avoids prompt) |
| `-t <template>` | Specify template |
| `--no-prompt` | Skip all confirmations (REQUIRED for automation/agents) |

### Non-Interactive Initialization

```bash
# Generate environment name from project folder - NEVER PROMPT USER
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"

# Initialize with template and environment name
azd init -t <TEMPLATE> -e "$ENV_NAME"
```

## What azd Creates (Secure-by-Default)

When using azd templates, the following resources are created:
- **Flex Consumption plan** (required for new deployments)
- User-assigned managed identity
- RBAC role assignments (no connection strings)
- Storage with `allowSharedKeyAccess: false`
- App Insights with `disableLocalAuth: true`
- Optional VNET with private endpoints

## Hosting Plans

**ALWAYS USE FLEX CONSUMPTION** for new deployments. All azd templates use Flex Consumption by default.

| Plan | Scaling | VNET | Use Case |
|------|---------|------|----------|
| **Flex Consumption** ⭐ | Auto, pay-per-execution | ✅ | **Default for all new projects** |
| Premium | Auto, pre-warmed | ✅ | Long-running, consistent load |
| Dedicated | Manual | ✅ | Predictable workloads |

## Trigger Types

| Trigger | Use Case |
|---------|----------|
| HTTP | REST APIs, webhooks |
| Timer | Scheduled jobs (CRON) |
| Blob | File processing |
| Queue | Message processing |
| Event Grid | Event-driven |
| Cosmos DB | Change feed processing |
| Service Bus | Enterprise messaging |

## Next Steps

After selecting and initializing a template:
1. Review generated azure.yaml
2. Review generated Bicep infrastructure
3. Proceed to **azure-validate** skill
