# Composition Algorithm

Step-by-step algorithm for composing a base HTTP template with an integration recipe.

> **This is the authoritative process. Follow it exactly.**

## Algorithm

```
INPUT:
  - language:    dotnet | typescript | javascript | python | java | powershell
  - integration: http | cosmosdb | sql | servicebus | eventhubs | timer | blob | durable | mcp
  - iac:         bicep | terraform

OUTPUT:
  - Complete project directory ready for `azd up`
```

### Step 1: Fetch Base Template

```bash
# Determine template name
IF iac == 'bicep':
  TEMPLATE = base_templates[language].bicep    # e.g., functions-quickstart-dotnet-azd
ELSE IF iac == 'terraform':
  TEMPLATE = base_templates[language].terraform # e.g., functions-quickstart-dotnet-azd-tf

# Non-interactive init
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"
azd init -t $TEMPLATE -e "$ENV_NAME" --no-prompt
```

### Step 2: Check if Recipe Needed

```
IF integration IN [http]:
  → DONE. Base template is complete.

IF integration IN [timer, durable, mcp]:
  → Source-only recipe. Skip to Step 5.

IF integration IN [cosmosdb, sql, servicebus, eventhubs, blob]:
  → Full recipe. Continue to Step 3.
```

### Step 3: Add IaC Module (for full recipes only)

**Bicep:**
1. Copy `recipes/{integration}/bicep/*.bicep` → `infra/app/`
2. Add module reference in `infra/main.bicep`:
   ```bicep
   module cosmos './app/cosmos.bicep' = {
     name: 'cosmos'
     scope: rg
     params: {
       name: name
       location: location
       tags: tags
       functionAppPrincipalId: app.outputs.SERVICE_API_IDENTITY_PRINCIPAL_ID
     }
   }
   ```
3. If VNET_ENABLED, also add the network module:
   ```bicep
   module cosmosNetwork './app/cosmos-network.bicep' = if (vnetEnabled) { ... }
   ```

**Terraform:**
1. Copy `recipes/{integration}/terraform/*.tf` → `infra/`
2. Merge `locals.{integration}_app_settings` into function app's `app_setting` block in `main.tf`
3. Networking is conditional (uses `count = var.vnet_enabled ? 1 : 0`)

### Step 4: Add App Settings

Read the recipe's `README.md` for required app settings. Add them to the function app config.

**Bicep:** Add to `appSettings` array in function app resource:
```bicep
{
  name: 'COSMOS_CONNECTION__accountEndpoint'
  value: cosmos.outputs.cosmosAccountEndpoint
}
{
  name: 'COSMOS_DATABASE_NAME'
  value: cosmos.outputs.cosmosDatabaseName
}
{
  name: 'COSMOS_CONTAINER_NAME'
  value: cosmos.outputs.cosmosContainerName
}
```

**Terraform:** Merge recipe locals into function app:
```hcl
app_setting = merge(local.base_app_settings, local.cosmos_app_settings)
```

### Step 5: Replace Source Code

1. Read `recipes/{integration}/source/{language}.md`
2. Create the new trigger file(s) as specified
3. Remove the HTTP trigger files listed in "Files to Remove"
4. Add any package dependencies (NuGet, npm, pip, Maven)

### Step 6: Update azure.yaml (if needed)

Some recipes require hooks (e.g., Cosmos firewall scripts for VNet):
```yaml
hooks:
  postprovision:
    posix:
      shell: sh
      run: ./infra/scripts/add-cosmos-firewall.sh
    windows:
      shell: pwsh
      run: ./infra/scripts/add-cosmos-firewall.ps1
```

### Step 7: Validate and Deploy

```bash
# Single command — provision + deploy
azd up --no-prompt
```

## Base Template Lookup

| Language | Bicep Template | Terraform Template |
|----------|---------------|-------------------|
| dotnet | `functions-quickstart-dotnet-azd` | `functions-quickstart-dotnet-azd-tf` |
| typescript | `functions-quickstart-typescript-azd` | `functions-quickstart-typescript-azd-tf` |
| javascript | `functions-quickstart-javascript-azd` | `functions-quickstart-javascript-azd-tf` |
| python | `functions-quickstart-python-http-azd` | `functions-quickstart-python-http-azd-tf` |
| java | `azure-functions-java-flex-consumption-azd` | `azure-functions-java-flex-consumption-azd-tf` |
| powershell | `functions-quickstart-powershell-azd` | `functions-quickstart-powershell-azd-tf` |

## Recipe Classification

| Category | Integrations | What Recipe Provides |
|----------|-------------|---------------------|
| **Source-only** | timer, durable, mcp | Source code snippet only — no IaC changes |
| **Full recipe** | cosmosdb, sql, servicebus, eventhubs, blob | IaC modules + RBAC + networking + source code |

## Critical Rules

1. **NEVER synthesize Bicep or Terraform from scratch** — always start from base template IaC
2. **NEVER modify base IaC files** — only ADD recipe modules alongside them
3. **ALWAYS use recipe RBAC role GUIDs** — never let the LLM guess role IDs
4. **ALWAYS use `--no-prompt`** — the agent must never elicit user input during azd commands
5. **ALWAYS verify the base template initialized successfully** before applying recipe
