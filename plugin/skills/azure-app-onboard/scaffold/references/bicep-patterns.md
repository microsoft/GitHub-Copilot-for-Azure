# Bicep Patterns

Bicep default-path patterns for AppOnboard scaffold. Used as the primary IaC format. For the alternative Terraform path (existing `.tf` files or user override), scaffold uses `mcp_azure_mcp_azureterraformbestpractices` output patterns.

> **Source:** Adapted from Azure Bicep best practices. See [Bicep best practices](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/best-practices) for updates.

## File Structure

> ⛔ **Always use `targetScope = 'subscription'`.** Subscription-scope Bicep creates the resource group in IaC with all 5 AppOnboard tags (including `created-at`). Resource-group scope requires `az group create` via CLI, which consistently misses `created-at` — this has caused 4/5 tag failures in every resource-group-scope run. There are zero benefits to resource-group scope for AppOnboard.

```
infra/
├── main.bicep              # Entry point (subscription scope)
├── main.parameters.json    # ARM JSON parameter values (NOT .bicepparam)
└── modules/
    ├── container-app.bicep
    ├── app-service.bicep
    ├── sql-database.bicep
    ├── key-vault.bicep
    ├── log-analytics.bicep
    └── ...
```

Each service gets its own module. `main.bicep` orchestrates resource group creation + module calls.

## main.bicep Skeleton

```bicep
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
param environmentName string

@minLength(1)
param location string

param sessionId string

param deployedBy string   // resolved via: az ad signed-in-user show --query displayName -o tsv

// ⛔ createdAt: passed in parameters.json, NOT utcNow() default (crashes Portal blade)
param createdAt string

var tags = {
  'app-onboard-skill': 'true'
  'app-onboard-session-id': sessionId
  'created-at': createdAt
  environment: environmentName
  'deployed-by': deployedBy
}

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module resources './modules/resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    tags: tags
  }
}
```

## main.parameters.json

> ⛔ **ARM JSON only.** Do NOT use `.bicepparam` syntax (`using`, `param`, `readEnvironmentVariable()`). AppOnboard deploys via `az deployment sub create` (subscription-scope default) — not `azd` — and `.bicepparam` requires azd or newer tooling. If the user lacks subscription-level permissions, the deploy phase falls back to `az deployment group create` automatically.

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": { "value": "{project}-{env}" },
    "location": { "value": "{region}" },
    "sessionId": { "value": "{context.json.sessionId}" },
    "deployedBy": { "value": "{context.json.azure.userDisplayName}" }
  }
}
```

## Naming Convention (Bicep)

The prepare phase generates final resource names in `prepare-plan.json.naming.resources[]`. Scaffold MUST use those exact names as Bicep parameters — do NOT re-derive them with `take()`, `uniqueString()`, or string manipulation.

```bicep
// Names come from prepare-plan.json.naming.resources[] — passed as parameters
param kvName string      // e.g. 'kv-myapp-dev-a1d5'
param storName string    // e.g. 'stmyappdeva1d5'
param acrName string     // e.g. 'crmyappdeva1d5'
```

The prepare phase handles length constraints and character restrictions per resource type — see [naming-patterns.md](../../prepare/references/naming-patterns.md).

## Compute-Target Patterns

Read the file matching the service mapping — load only one:
- **App Service / Functions:** [bicep-app-service.md](bicep-app-service.md) — module template, SCM/FTP auth, native module deploy strategy
- **Container Apps:** [bicep-container-apps.md](bicep-container-apps.md) — two-phase ACR wiring, ingress, secretRef, image parameter, multi-container DNS

Load both only if the plan includes both compute targets.

> ⛔ **F1/D1 SKU: do NOT generate a Dockerfile.** If `prepare-plan.json` specifies F1 or D1 (free/shared tier), use the platform's built-in runtime stack (e.g., `NODE|20-lts` for Node.js, `PYTHON|3.12` for Python). Dockerfiles are for B1+ or Container Apps only.

> ⛔ **Native module deploy strategy.** If `prepare-plan.json.deployStrategy` exists, read [bicep-app-service.md § Native Module Deploy Strategy](bicep-app-service.md) and apply the startup command + app settings. `deployStrategy.startupCommand` → `appCommandLine`, `deployStrategy.requiredAppSettings` → `appSettings[]`. When no `deployStrategy` exists, do NOT set `appCommandLine`.

### Two-Phase Deploy Pattern (Container Apps)

> ⛔ **ACR role + KV secretRef timing.** Container Apps has a circular dependency: the CA needs the ACR image, but the managed identity for AcrPull and KV Secrets User doesn't exist until the CA is created. Additionally, KV `secretRef` entries fail if the CA's identity doesn't have the `Key Vault Secrets User` role yet.

1. **Phase 1** — Deploy CA with placeholder image `mcr.microsoft.com/azuredocs/containerapps-helloworld:latest`. No `registries` block, no KV `secretRef`. This creates the managed identity.
2. **Phase 2** — Assign `AcrPull` + `Key Vault Secrets User` roles to the CA's managed identity. Wait ~60s for RBAC propagation. Then redeploy with the real ACR image + KV `secretRef` entries.

This consolidates the ACR pull and KV secret timing issues into one pattern. See [bicep-container-apps.md § Two-Phase Wiring](bicep-container-apps.md) for the full Bicep template.

## Service Tagging

> ⛔ **You MUST read [iac-generation-rules.md § Session Tags](iac-generation-rules.md).** All resources MUST include the 5 AppOnboard session tags. Pass `tags` object from `main.bicep` into every module.

## API Version Policy

Use the latest stable API version for each resource type. Never use preview APIs unless required for a feature with no GA alternative. Validate via `bicep build` — stale API versions produce warnings.

## Key Vault Reference Syntax by Service

| Service | Secret Reference Syntax | Identity Requirement |
|---------|------------------------|---------------------|
| App Service / Functions | `@Microsoft.KeyVault(SecretUri=https://{kv}.vault.azure.net/secrets/{name})` in app settings | System-assigned MI + `Key Vault Secrets User` role |
| Container Apps | `secrets[].keyVaultUrl` + `secrets[].identity: 'system'` → `env[].secretRef` | System-assigned MI + `Key Vault Secrets User` role |
| Terraform (any) | `azurerm_key_vault_secret` data source → `value` attribute | `azurerm_role_assignment` for the app identity |

> ⛔ **Never mix syntaxes.** App Service `@Microsoft.KeyVault()` on Container Apps = silent failure (value treated as literal string). Container Apps `secretRef` on App Service = invalid config.
