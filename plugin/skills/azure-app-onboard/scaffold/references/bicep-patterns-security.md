# Bicep Patterns — Security Defaults

Mandatory security configuration for all AppOnboard-generated Bicep. Read during IaC generation before writing resource definitions. Apply during scaffold — never defer to deploy.

For core patterns (file structure, skeleton, naming, tagging), see [bicep-patterns.md](bicep-patterns.md). For data module templates (PostgreSQL, Redis), see [bicep-patterns-data.md](bicep-patterns-data.md).

## Key Vault Deployer RBAC

The deploying user/principal needs RBAC to write secrets (scaffold seeds initial values) and read them (verify wiring):

- **Key Vault Secrets Officer** (`b86a8fe4-44ce-4948-aee5-eccb2c155cd7`) — write secrets
- **Key Vault Secrets User** (`4633458b-17de-408a-b874-0445c86b69e6`) — read secrets (also needed by app MI)

If the app seeds data using a generated secret (admin password, API key), either display it to the user at deploy time OR ensure the deployer has read RBAC on the Key Vault.

## Security Defaults

> **Source:** Adapted from Azure security best practices. See [Azure security baseline](https://learn.microsoft.com/en-us/security/benchmark/azure/overview) for updates.

### Identity — Managed Identity Everywhere

> ⛔ **Managed identity decision — evaluate top to bottom, first match wins.**
>
> | Condition | Include MI? |
> |-----------|-------------|
> | Any Key Vault, database, storage, queue, or ACR access | **YES** |
> | F1 or D1 SKU on Linux | **NO** (MI sidecar causes OOM) |
> | None of the above | **YES** (default secure) |

- **System-assigned managed identity** for all services (default). User-assigned only when shared identity is explicitly needed.
- ⛔ **Never generate `administratorLogin` or `administratorLoginPassword`** for SQL — including inside conditional branches. Use Entra-only auth (see SQL Server pattern below).
- App-to-service auth: managed identity + RBAC role assignments. Zero secrets in code or config.

```bicep
identity: {
  type: 'SystemAssigned'
}
```

### SQL Server — Entra-Only Authentication

> For full SQL auth reference (connection strings, managed identity SQL grants, CI/CD principal types), see `azure-prepare/references/services/sql-database/auth.md`.

```bicep
param principalId string
param principalName string
@allowed(['User', 'Group', 'Application'])
param principalType string = 'User'

// Preview API required — azureADOnlyAuthentication via administrators block
// is not available in GA API versions (GA path uses a separate child resource).
resource sqlServer 'Microsoft.Sql/servers@2024-05-01-preview' = {
  name: '${resourcePrefix}-sql-${uniqueHash}'
  location: location
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: principalType
      login: principalName
      sid: principalId
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: true
    }
    minimalTlsVersion: '1.2'
  }
}
```

> ⚠️ If deploying from CI/CD with a service principal, set `principalType` to `'Application'`. The default `'User'` only works for interactive deployments.

### Secrets — Key Vault References

Store secrets in Key Vault. Reference via app settings — never inline.

> ⛔ **No plaintext secrets in Bicep `appSettings`.** Values like `SECRET_KEY`, `JWT_SECRET`, `API_KEY`, session secrets, and database passwords MUST NOT be hardcoded in Bicep — not even as "placeholder" values like `'change-me-on-first-deploy'` or `'replace-this'`. Never use `uniqueString()` for secrets — it is deterministic and predictable. These appear in ARM deployment history, are visible in the Azure portal, and persist in source control.
>
> **Correct patterns (pick one):**
> 1. **Key Vault reference (preferred):** `'@Microsoft.KeyVault(VaultName=${kvName};SecretName=secret-key)'` — requires KV + RBAC setup
> 2. **Deploy-time seeding (for free-tier without KV):** Omit the secret from Bicep `appSettings`. After IaC deploy, run `az webapp config appsettings set -g {rg} -n {app} --settings SECRET_KEY=$(openssl rand -base64 32)` to inject a random value. This avoids plaintext in IaC while keeping the resource count minimal.
> 3. **Bicep `@secure()` parameter:** Pass via CLI `--parameters secretKey=$(openssl rand -base64 32)` — never committed to parameters.json
>
> ❌ **NEVER:** `{ name: 'SECRET_KEY', value: 'hard-to-guess-string' }` or `{ name: 'SECRET_KEY', value: 'change-me' }` in Bicep

```bicep
// App Service / Functions — Key Vault reference pattern
appSettings: [
  {
    name: 'DB_CONNECTION_STRING'
    value: '@Microsoft.KeyVault(VaultName=${kvName};SecretName=db-connection-string)'
  }
]
```

Key Vault config:
```bicep
properties: {
  sku: { family: 'A', name: 'standard' }
  tenantId: subscription().tenantId
  enableRbacAuthorization: true  // RBAC, not access policies
  // ⛔ enablePurgeProtection is write-once: only `true` is valid once set.
  // For dev deployments, OMIT entirely (defaults to false for new vaults).
  // Never set enablePurgeProtection: false — ARM rejects it.
}
```

### Transport — HTTPS Only

All web-facing resources:

```bicep
// App Service
httpsOnly: true
siteConfig: {
  minTlsVersion: '1.2'
}

// Storage
supportsHttpsTrafficOnly: true
allowBlobPublicAccess: false
minimumTlsVersion: 'TLS1_2'
```

### Cosmos DB — Data Plane RBAC

⛔ **Cosmos DB uses its OWN role system** — see [rbac-roles.md](rbac-roles.md) for the behavioral rules and role ID table. Do NOT use `Microsoft.Authorization/roleAssignments` for Cosmos DB data access.

```bicep
// Built-in Cosmos DB data roles:
// Data Reader:      '00000000-0000-0000-0000-000000000001'
// Data Contributor: '00000000-0000-0000-0000-000000000002'

resource cosmosRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, principalId, dataContributorRoleId)
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: managedIdentity.properties.principalId
    scope: cosmosAccount.id
  }
}
```

⛔ **Never use `Microsoft.Authorization/roleAssignments` for Cosmos data access** — use `sqlRoleAssignments` with Cosmos's own role IDs. ARM role assignment with Cosmos data-plane ID fails: `"RoleDefinitionDoesNotExist"`.

### RBAC — Deterministic Role Assignments

For the common roles GUID table, see [rbac-roles.md](rbac-roles.md).

```bicep
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(scopeResourceId, principalId, roleDefinitionId)
  scope: targetResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'  // REQUIRED — prevents AAD graph lookup delays
  }
}
