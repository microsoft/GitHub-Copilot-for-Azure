# Composition Algorithm — REFERENCE ONLY

Step-by-step algorithm for composing a Container Apps base template with integration recipes.

> **This is the authoritative process. Follow it exactly.**

## Algorithm

```
INPUT:
  - base:        web-app | api | microservice | worker | job | functions-on-aca
  - recipes:     dapr | cosmos | servicebus | eventhubs | redis | acr | postgres

OUTPUT:
  - Complete project directory ready for `azd up`
```

### Step 1: Select Base Template

Choose one base guide from [selection.md](selection.md). These files are generation
guidance, not published AZD template identifiers.

```bash
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"
azd init -e "$ENV_NAME" --no-prompt
```

Generate the application, multi-stage [Dockerfile](dockerfiles/README.md), `azure.yaml`,
and base infrastructure from the selected guide. Preserve existing project files in MODIFY mode.

### Step 2: Check if Recipes Needed

```
IF no integrations detected:
  → DONE. Base template is complete.

IF recipes detected:
  → Continue to Step 3 for each recipe.
```

### Step 3: Add IaC Module (per recipe)

Read the recipe's README for IaC patterns, env vars, RBAC roles, and scaling rules:

- [ACR](recipes/acr/README.md) — Container Registry build + push
- [Cosmos DB](recipes/cosmos/README.md) — Cosmos DB NoSQL
- [Dapr](recipes/dapr/README.md) — state, pub/sub, invocation, secrets
- [Event Hubs](recipes/eventhubs/README.md) — streaming + KEDA scaling
- [PostgreSQL](recipes/postgres/README.md) — PostgreSQL Flexible Server
- [Redis](recipes/redis/README.md) — cache / state store
- [Service Bus](recipes/servicebus/README.md) — messaging + KEDA scaling

**Bicep:**
1. Create recipe Bicep module in `infra/app/` based on the recipe's documented patterns
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

1. **Generate from the selected base guide** — do not pass Markdown filenames to `azd init -t`
2. **Don't replace or remove existing IaC resources** — merge additive modules in MODIFY mode
3. **Always use recipe RBAC role GUIDs** — never let the LLM guess role IDs
4. **Always use UAMI** — never use connection strings or access keys
5. **Always use `--no-prompt`** with azd commands
6. **Always wait for RBAC propagation** — use two-phase deploy
