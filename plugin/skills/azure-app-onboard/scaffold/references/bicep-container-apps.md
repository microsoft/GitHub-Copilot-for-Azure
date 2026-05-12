# Bicep — Container Apps Patterns

Container Apps-specific Bicep patterns. For shared patterns (skeleton, naming, tags, security defaults, data modules), see [bicep-patterns.md](bicep-patterns.md).

## Two-Phase Wiring

Container Apps + ACR requires two-phase deployment (circular dependency: CA needs ACR image, ACR needs CA identity for AcrPull):

1. **Phase 1:** Deploy Container App with placeholder image (`mcr.microsoft.com/azuredocs/containerapps-helloworld:latest`). ⛔ **No `registries` block, no KV `secretRef`, no ACR references.** The placeholder image is pulled from MCR (public) — ACR auth is not needed and will fail (AcrPull role doesn't exist yet). KV secrets also fail (identity has no KV role yet). Use `registries: []` and `secrets: []`.
2. **Phase 2:** Build + push app image to ACR, assign `AcrPull` + KV roles to CA's managed identity, redeploy with real image + `registries` + KV `secretRef` entries.

> ⛔ **Placeholder image listens on port 80, not your app's port.** Set `targetPort` conditionally: `var effectivePort = containerImage == 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest' ? 80 : appPort`. Mismatched ports cause "Operation expired" (health probe can't reach container).

```bicep
// Phase 1: Placeholder image — NO registries, NO secrets
var isPlaceholder = containerImage == 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  identity: { type: 'SystemAssigned' }
  properties: {
    configuration: {
      registries: isPlaceholder ? [] : [{ server: acr.properties.loginServer, identity: 'system' }]
      secrets: isPlaceholder ? [] : [ /* KV secretRefs here */ ]
    }
    template: {
      containers: [{
        image: containerImage
        env: [{ name: 'PORT', value: string(isPlaceholder ? 80 : appPort) }]
      }]
    }
  }
}
```

## Ingress & Port Mapping

> ⛔ **Port alignment is critical.** The MCR placeholder image (`containerapps-helloworld`) listens on **port 80**. Your app likely listens on a different port (3000, 5000, 8080). If `targetPort` doesn't match the container's listening port, the revision health probe fails with "Operation expired."
> - **Phase 1 (placeholder):** `targetPort: 80`
> - **Phase 2 (real image):** `targetPort: {appPort}` (from Dockerfile EXPOSE or app config)
> - Use a conditional: `targetPort: isPlaceholder ? 80 : appPort`

```bicep
properties: {
  configuration: {
    ingress: {
      external: true
      targetPort: 80  // Match Oryx default; or set to app's listening port + add PORT env var
      transport: 'auto'
      allowInsecure: false  // ⛔ MANDATORY — block HTTP, enforce HTTPS-only
    }
  }
  template: {
    containers: [{
      env: [
        { name: 'PORT', value: '80' }  // Explicit — prevents mismatch
      ]
    }]
  }
}
```

## Key Vault Secret References

> ⛔ **Container Apps does NOT support `@Microsoft.KeyVault(SecretUri=...)` syntax.** That is App Service-only. Container Apps uses `secretRef` with managed identity.

**Correct pattern — Container Apps secrets from Key Vault:**

```bicep
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    configuration: {
      secrets: [
        {
          name: 'db-connection-string'
          keyVaultUrl: 'https://${keyVault.name}.vault.azure.net/secrets/db-connection-string'
          identity: 'system'  // Uses the CA's system-assigned managed identity
        }
      ]
    }
    template: {
      containers: [{
        env: [
          {
            name: 'DATABASE_URL'
            secretRef: 'db-connection-string'  // References the secret defined above
          }
        ]
      }]
    }
  }
}
```

> ⛔ **Never use conditional logic (`??`, ternary, `empty()`, `union()`) to mix plain and secret env vars in a single Bicep loop or array.** ARM evaluates ALL property paths in conditional expressions — `envVar.secretRef` errors on items that don't have that property, producing `InvalidTemplate`. Instead, define plain and secret env vars as separate arrays and concatenate:
>
> ```bicep
> env: concat(
>   [
>     { name: 'PORT', value: '8000' }
>     { name: 'NODE_ENV', value: 'production' }
>   ],
>   [
>     { name: 'DATABASE_URL', secretRef: 'db-connection-string' }
>     { name: 'REDIS_URL', secretRef: 'redis-connection-string' }
>   ]
> )
> ```

> ⛔ **The CA's managed identity needs `Key Vault Secrets User` role scoped to the Key Vault resource — NOT `resourceGroup()`.** Scoping to `resourceGroup()` causes 403 ForbiddenByRbac when the CA tries to fetch secrets. Always set `scope: keyVault` (the Key Vault resource reference).

```bicep
// Key Vault Secrets User — ⛔ scope MUST be the Key Vault resource, not resourceGroup()
var kvSecretsUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, containerApp.id, kvSecretsUserRoleId)
  scope: keyVault  // ⛔ NOT resourceGroup() — must target the Key Vault
  properties: {
    roleDefinitionId: kvSecretsUserRoleId
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

```bicep
// AcrPull role assignment — deterministic GUID, scoped to ACR
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, containerApp.identity.principalId, acrPullRoleId)
  scope: acr  // ⛔ NOT resourceGroup() — must target the ACR
  properties: {
    roleDefinitionId: acrPullRoleId
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

> For KV secret seeding and dependency chain, see [env-var-secrets.md](env-var-secrets.md).

> For env var derivation rules, see [env-var-secrets.md](env-var-secrets.md).

## Image Parameter (Redeploy Safety)

Prevent Bicep redeploy from reverting to the placeholder image:

```bicep
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

// In container template:
containers: [{ image: containerImage, ... }]
```

Deploy phase passes real image: `--parameters containerImage='{acr}.azurecr.io/{name}:latest'`.

## Multi-Container Internal DNS

Container Apps in the same environment communicate via internal DNS: `http://{container-app-name}`. Set via env vars:

```bicep
env: [
  { name: 'API_URL', value: 'http://${apiContainerApp.name}' }
  { name: 'WORKER_URL', value: 'http://${workerContainerApp.name}' }
]
```

No ingress needed for internal-only services — set `ingress.external: false` or omit ingress entirely.
