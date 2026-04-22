# Composition Algorithm — REFERENCE ONLY

Step-by-step algorithm for composing a Container Apps base template with integration recipes.

> **This is the authoritative process. Follow it exactly.**

## Algorithm

```
INPUT:
  - base:        web-app | api | microservice | worker | job | functions-on-aca
  - recipes:     dapr | cosmos | servicebus | redis | acr | postgres (zero or more)
  - iac:         bicep | terraform

OUTPUT:
  - Complete project directory ready for `azd up`
```

### Step 1: Select Base Template

Choose the base template from [selection.md](../selection.md) based on the workload type.
Copy the base template structure into the project directory.

```bash
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"
azd init -e "$ENV_NAME" --no-prompt
```

### Step 2: Check if Recipes Needed

```
IF no integrations detected:
  → DONE. Base template is complete.

IF recipes detected:
  → Continue to Step 3 for each recipe.
```

### Step 3: Add IaC Module (per recipe)

**Bicep:**
1. Copy recipe Bicep module into `infra/app/`
2. Add module reference in `infra/main.bicep`:
   ```bicep
   module cosmos './app/cosmos.bicep' = {
     name: 'cosmos'
     scope: rg
     params: {
       name: name
       location: location
       tags: tags
       principalId: app.outputs.principalId
     }
   }
   ```

**Terraform:**
1. Copy recipe `.tf` file into `infra/`
2. Merge recipe app settings into container app environment variables

### Step 4: Add Environment Variables

Read the recipe's `README.md` for required env vars. Add them to the container app config.

> **CRITICAL: User Assigned Managed Identity (UAMI)**
>
> Use managed identity for all service connections. Never use connection strings or keys.
>
> ```bicep
> env: [
>   { name: 'COSMOS_ENDPOINT', value: cosmos.outputs.endpoint }
>   { name: 'AZURE_CLIENT_ID', value: uami.outputs.clientId }
> ]
> ```

### Step 5: Add RBAC Role Assignments

Each recipe defines required RBAC roles. Use exact role definition GUIDs from recipe docs.

```bicep
resource cosmosRbac 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmos
  name: guid(cosmos.id, uami.id, 'data-contributor')
  properties: {
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: uami.outputs.principalId
    scope: cosmos.id
  }
}
```

### Step 6: Add Scaling Rules (if applicable)

For workers and event-driven apps, add KEDA scaling rules from the recipe:

```bicep
scale: {
  minReplicas: 0
  maxReplicas: 30
  rules: [
    // From recipe scaling configuration
  ]
}
```

### Step 7: Validate and Deploy

```bash
azd env set AZURE_LOCATION eastus2
azd provision --no-prompt
sleep 60                         # Wait for RBAC propagation
azd deploy --no-prompt
```

## Multiple Recipes

Recipes are additive. Apply each recipe independently:

```
Base (web-app)
  + cosmos recipe   → adds Cosmos module + RBAC + env vars
  + redis recipe    → adds Redis module + RBAC + env vars
  + acr recipe      → adds ACR build pipeline
  = Complete project
```

> ⚠️ **Each recipe is independent.** No recipe should modify another recipe's resources.

## Critical Rules

1. **Never synthesize IaC from scratch** — always extend base template
2. **Don't replace or remove base IaC resources** — extend base files only by adding module references and additive resources
3. **Always use recipe RBAC role GUIDs** — never let the LLM guess role IDs
4. **Always use UAMI** — never use connection strings or access keys
5. **Always use `--no-prompt`** with azd commands
6. **Always wait for RBAC propagation** — use two-phase deploy
