---
name: azure-deploy
description: Deploy applications to Azure using Azure Developer CLI (azd). USE THIS SKILL when users want to deploy, publish, host, or run their application on Azure. Trigger phrases include "deploy to Azure", "host on Azure", "publish to Azure", "run on Azure", "deploy my app", "azd up", etc.
---

# Azure Deployment Skill

Deploy applications to Azure using Azure Developer CLI (azd).

---

## Execution Flow

### Step 0: Detect Project Type (REQUIRED FIRST)

**BEFORE following the generic flow, check for Azure Functions:**

**Azure Functions Detection** - Check for ANY of these:
- `host.json` in project root
- `local.settings.json` in project root
- `function.json` in any subfolder
- Function decorators: `@app.route`, `@app.timer`, `@app.cosmos_db`, `@app.mcp_tool`, `[Function]`, `[HttpTrigger]`

> **If Azure Functions detected:**
> 1. If `azure.yaml` exists → Skip to **Step 2** (check if environment exists, create if needed)
> 2. If NO `azure.yaml` → Go to **"Azure Functions Deployment"** section below to select template and run `azd init` (which creates the environment), then return to **Step 3** (subscription config)
>
> **Do NOT use azure-create-app for Functions** - use the Functions-specific template selection instead.

**If NOT a Functions project → Continue with Step 1.**

---

### Step 1: Check for azure.yaml

Check if `azure.yaml` exists in the project root.

**If `azure.yaml` does NOT exist:**
- Inform user: "No azure.yaml found. Use the azure-create-app skill to prepare your application for Azure deployment."
- Stop execution

**If `azure.yaml` exists:**
- Proceed to Step 2

### Step 2: Check Environment

Run:
```bash
azd env list
```

**If no environment exists:**
- Ask the user: "What name would you like for your Azure environment? (e.g., dev, staging, prod)"
- Create the environment with the user-provided name:
```bash
azd env new <user-provided-name>
```

**If environment exists:**
- Proceed to Step 3

### Step 3: Check Subscription Configuration

First, check for global defaults:
```bash
azd config get defaults
```

This may return defaults like:
```json
{
  "subscription": "<subscription-id>",
  "location": "<location>"
}
```

Store these default values if present.

Next, check environment-specific values:
```bash
azd env get-values
```

Check if `AZURE_SUBSCRIPTION_ID` is set in the output.

**If `AZURE_SUBSCRIPTION_ID` is NOT set:**

1. Call the `azure__subscription_list` MCP tool to get available subscriptions:
```json
{
  "command": "subscription_list",
  "parameters": {}
}
```

2. Present the list of subscriptions to the user. If a default subscription was found in `azd config get defaults`, include it in the prompt:
   - With default: "Which Azure subscription would you like to use? (default from azd config: `<default-subscription-id>`)"
   - Without default: "Which Azure subscription would you like to use for this deployment?"

3. Set the subscription with the user-selected value (or use default if user accepts):
```bash
azd env set AZURE_SUBSCRIPTION_ID <selected-subscription-id>
```

**If `AZURE_SUBSCRIPTION_ID` is set:**
- Proceed to Step 4

### Step 4: Check Location Configuration

Check if `AZURE_LOCATION` is set in the `azd env get-values` output from Step 3.

**If `AZURE_LOCATION` is NOT set:**

1. Get the list of available Azure regions:
```bash
az account list-locations --query "[].{name:name, displayName:displayName}" --output table
```

2. Present the list of available regions to the user. If a default location was found in `azd config get defaults`, include it in the prompt:
   - With default: "Which Azure region would you like to deploy to? (default from azd config: `<default-location>`)"
   - Without default: "Which Azure region would you like to deploy to?"

3. Set the location with the user-selected value:
```bash
azd env set AZURE_LOCATION <selected-location>
```

**If `AZURE_LOCATION` is set:**
- Proceed to Step 5

### Step 5: Deploy

Execute:
```bash
azd up --no-prompt
```

The `--no-prompt` flag is required to prevent interactive prompts from blocking execution.

This command provisions all Azure resources defined in `infra/` and deploys the application code.

**Alternative:** To provision and deploy separately:
```bash
azd provision --no-prompt   # Create Azure resources
azd deploy --no-prompt      # Deploy application code
```

**To preview changes before deployment:**
```bash
azd provision --preview
```

### Step 6: Handle Errors

If `azd up` fails, call the `azure__azd` MCP tool:
```json
{
  "command": "error_troubleshooting",
  "parameters": {}
}
```

Common error resolutions:
- "Not authenticated" → Run `azd auth login`
- "Environment not found" → Run `azd env new <name>`
- "azure.yaml invalid" → Use azure-create-app skill to regenerate
- "Bicep compilation error" → Check module paths and parameters
- "Provision failed" → Check resource quotas and permissions
- "Package failed" → Verify Dockerfile and build configuration

---

## Environment Management

```bash
azd env new <name>              # Create environment
azd env select <name>           # Switch environment
azd env set AZURE_LOCATION eastus   # Set variable
azd env list                    # List environments
```

---

## Post-Deployment Commands

```bash
azd monitor --logs      # View logs
azd monitor --overview  # Open Azure Portal
```

**Cleanup (DESTRUCTIVE):**
```bash
azd down --force --purge
```

WARNING: `azd down` permanently deletes ALL resources including databases with data, storage accounts with files, and Key Vaults with secrets.

---

## Azure Functions Deployment

> **This section is for Functions projects detected in Step 0.**
>
> If the project already has `azure.yaml`, skip this section and continue with Step 2.
>
> If NO `azure.yaml` exists, use the Template Selection below to run `azd init`, then return to **Step 2** for environment/subscription/location setup, and **Step 5** to deploy.

⚠️ **ALWAYS use azd for Functions deployment.** All templates deploy **Flex Consumption** (required) with secure-by-default configuration.

**NEVER use legacy Consumption v1** - it is deprecated and lacks VNET, RBAC, and modern security features.

**NEVER use azure-create-app skill for Functions** - use the template selection below instead.

### Template Selection Decision Tree

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

### MCP Server Templates

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

### Integration Templates (Cosmos DB, SQL, AI, SWA)

**Browse by service to find the right template:**
| Service | Find Templates |
|---------|----------------|
| Cosmos DB | [Awesome AZD Cosmos](https://azure.github.io/awesome-azd/?tags=functions&name=cosmos) |
| Azure SQL | [Awesome AZD SQL](https://azure.github.io/awesome-azd/?tags=functions&name=sql) |
| AI/OpenAI | [Awesome AZD AI](https://azure.github.io/awesome-azd/?tags=functions&name=ai) |
| SWA + Functions | [todo-csharp-sql-swa-func](https://github.com/Azure-Samples/todo-csharp-sql-swa-func), [todo-nodejs-mongo-swa-func](https://github.com/azure-samples/todo-nodejs-mongo-swa-func) |

### HTTP Function Templates (Default - use only if no specific integration)

| Runtime | Template |
|---------|----------|
| C# (.NET) | `azd init -t functions-quickstart-dotnet-azd` |
| JavaScript | `azd init -t functions-quickstart-javascript-azd` |
| TypeScript | `azd init -t functions-quickstart-typescript-azd` |
| Python | `azd init -t functions-quickstart-python-http-azd` |
| Java | `azd init -t azure-functions-java-flex-consumption-azd` |
| PowerShell | `azd init -t functions-quickstart-powershell-azd` |

**Browse all templates:** [Awesome AZD Functions](https://azure.github.io/awesome-azd/?tags=functions)

### After Template Selection

Once you've identified the correct template:

> **DEFAULT: Use the Existing Project flow below.** Only use the Empty Folder flow if starting from scratch.

```bash
# 1. Generate environment name from project folder - NEVER PROMPT USER
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"

# 2. Set template name based on decision tree above
TEMPLATE="<TEMPLATE>"

# 3. Clone template to temp folder, copy only infra files (preserves existing code)
TEMP_DIR=$(mktemp -d)
git clone --depth 1 "https://github.com/Azure-Samples/${TEMPLATE}.git" "$TEMP_DIR"

# 4. Copy azure.yaml and infra folder (DO NOT overwrite existing code)
cp "$TEMP_DIR/azure.yaml" .
cp -r "$TEMP_DIR/infra" .

# 5. Clean up temp folder
rm -rf "$TEMP_DIR"

# 6. Create azd environment (NOT azd init - that would prompt about existing azure.yaml)
azd env new "$ENV_NAME"

# 7. Set ALL required infrastructure parameters to prevent prompts
azd env set VNET_ENABLED false
```

#### Template-Specific Parameters

After step 7, set additional parameters based on template type:

**MCP Templates** (`remote-mcp-*`):
```bash
azd env set VNET_ENABLED false
azd env set ENABLE_APIM false           # If template supports APIM
```

**AI/OpenAI Templates**:
```bash
azd env set VNET_ENABLED false
azd env set AZURE_OPENAI_LOCATION eastus2   # Or user-preferred region with capacity
azd env set DEPLOY_AZURE_OPENAI true        # If template has optional AI
```

**Cosmos DB Templates**:
```bash
azd env set VNET_ENABLED false
azd env set COSMOS_DB_FREE_TIER false       # Free tier has limitations
```

**All Templates** - Common parameters to always set:
```bash
azd env set VNET_ENABLED false
```

> 💡 **TIP**: To discover required parameters for any template, check `infra/main.parameters.json` or run `azd provision --preview` to see what would be prompted.

#### Discover and Set All Required Parameters

After `azd init`, check for required parameters that don't have defaults:

```bash
# Check main.parameters.json for parameters without default values
cat infra/main.parameters.json 2>/dev/null || cat infra/main.bicepparam 2>/dev/null

# Or check main.bicep for @secure() or required parameters
grep -E "^param.*=.*\$" infra/main.bicep | head -20
```

For each parameter found without a default, set a value:
```bash
azd env set <PARAMETER_NAME> <value>
```

> ⚠️ **CRITICAL**: After copying, update `azure.yaml` to match your project structure:
> - Set correct `path` to your function app folder
> - Set correct `language` (python, js, ts, csharp, java)
> - Verify `host` matches the function app name in `infra/`

**After `azd init` completes → Return to Step 3** (subscription configuration). Skip Step 2 since environment was already created.

#### Empty Folder Alternative

Only if starting a brand new project with no existing code:

```bash
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"
azd init -t <TEMPLATE> -e "$ENV_NAME"
azd env set VNET_ENABLED false
```

Then return to **Step 3** (subscription configuration).

### VNET Configuration (Optional)

VNET is **disabled by default** (`VNET_ENABLED=false`). To enable VNET integration for secure deployments:

```bash
azd env set VNET_ENABLED true
```

### What azd Creates (Secure-by-Default)

All azd Functions templates create:
- **Flex Consumption plan** (required - NOT legacy Consumption v1)
- User-assigned managed identity
- RBAC role assignments (no connection strings)
- Storage with `allowSharedKeyAccess: false`
- App Insights with `disableLocalAuth: true`
- Optional VNET with private endpoints (`VNET_ENABLED=true`)

### RBAC Requirements

Functions templates configure these RBAC roles automatically:

| Resource | Role | Purpose |
|----------|------|---------|
| Storage Account | Storage Blob Data Owner | Function runtime storage |
| Storage Account | Storage Queue Data Contributor | Queue triggers/bindings |
| Storage Account | Storage Table Data Contributor | Table bindings |
| Key Vault | Key Vault Secrets User | Secret references |
| Cosmos DB | Cosmos DB Built-in Data Contributor | Cosmos triggers/bindings |
| Azure SQL | SQL DB Contributor | SQL triggers/bindings |
| App Insights | Monitoring Metrics Publisher | Telemetry |

### VNET Configuration

Enable VNET integration for secure deployments:

```bash
# Enable VNET before provisioning
azd env set VNET_ENABLED true
azd up --no-prompt
```

This creates:
- Virtual Network with subnets
- Private endpoints for Storage, Key Vault
- Function App VNET integration
- NSG rules for secure traffic

> **Note:** For complete Azure Functions development guidance (triggers, bindings, local development), see the **azure-functions** skill.
