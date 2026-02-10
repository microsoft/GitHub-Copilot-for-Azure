# Azure Hosting for Copilot SDK & Extensions

Both paths deploy identically. SDK apps additionally need the Copilot CLI binary in the container.

## AZD Template (SDK Path — Recommended)

For the SDK path, start from the ready-made AZD template instead of scaffolding from scratch:

```bash
azd init --template jongio/copilot-sdk-agent
```

This template includes: TypeScript Express app with `/chat` SSE endpoint, Dockerfile, Bicep infra (Container Apps + ACR with managed identity + Key Vault), preprovision hook for GITHUB_TOKEN, and a test UI. Customize tools and prompts in `src/index.ts`, then deploy with `azd up`.

## Port Alignment Checklist

> ⚠️ All four values MUST match. Default: **3000**.

| Setting | Where | Value |
|---------|-------|-------|
| `PORT` env var | Container App env / App Settings | `3000` |
| `EXPOSE` | Dockerfile | `3000` |
| `targetPort` | Bicep ingress config | `3000` |
| `app.listen()` | Application code | `process.env.PORT \|\| 3000` |

## Container Apps (Default)

```bicep
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  properties: {
    configuration: {
      ingress: { external: true, targetPort: 3000, transport: 'auto' }
      secrets: [
        { name: 'github-token', keyVaultUrl: kvSecret.properties.secretUri, identity: containerApp.identity.principalId }
      ]
      registries: [
        {
          server: acr.properties.loginServer
          identity: containerApp.identity.principalId
        }
      ]
    }
    template: {
      containers: [{
        name: 'copilot-app'
        image: '${acr.properties.loginServer}/copilot-app:latest'
        env: [
          { name: 'PORT', value: '3000' }
          { name: 'GITHUB_TOKEN', secretRef: 'github-token' }
        ]
      }]
    }
  }
}
```

### Dockerfile

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
# SDK path only — install Copilot CLI (remove for Extensions path)
RUN npm install -g @github/copilot-cli
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

> ⚠️ Do NOT enable `proxy_buffering` — SSE streaming requires unbuffered responses.

## ACR Authentication

> ⛔ **Use managed identity for ACR pull. NEVER use `adminUserEnabled: true` or `listCredentials()`.**

```bicep
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  identity: {
    type: 'SystemAssigned'
  }
  // ... (registries use identity, not username/password)
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, containerApp.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

## GITHUB_TOKEN via Key Vault

> ⛔ **Never pass GITHUB_TOKEN as a plain Bicep `@secure()` parameter. Always use Key Vault.**

### Key Vault Secret

```bicep
resource kvSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'github-token'
  properties: { value: githubToken }
}
```

### Preprovision Hook (Recommended)

Use an AZD preprovision hook to inject GITHUB_TOKEN from the developer's `gh` CLI into the AZD environment at deploy time:

```javascript
// hooks/preprovision.mjs
import { execSync } from "node:child_process";

let token;
try {
  token = execSync("gh auth token", { encoding: "utf-8" }).trim();
} catch {
  console.error("ERROR: gh CLI not authenticated. Run: gh auth login");
  process.exit(1);
}

// Verify copilot scope
try {
  const status = execSync("gh auth status 2>&1", { encoding: "utf-8", shell: true });
  if (!status.includes("copilot")) {
    console.error("ERROR: 'copilot' scope not detected. Run: gh auth refresh --scopes copilot");
    process.exit(1);
  }
} catch {
  console.error("ERROR: gh CLI not authenticated. Run: gh auth login");
  process.exit(1);
}

execSync(`azd env set GITHUB_TOKEN ${token}`, { stdio: "inherit" });
console.log("✓ GITHUB_TOKEN set from gh CLI.");
```

Register in `azure.yaml`:

```yaml
hooks:
  preprovision:
    windows:
      shell: pwsh
      run: node hooks/preprovision.mjs
    posix:
      shell: sh
      run: node hooks/preprovision.mjs
```

## App Service (Alternative)

```bicep
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  properties: {
    siteConfig: {
      appSettings: [
        { name: 'WEBSITES_PORT', value: '3000' }
        { name: 'GITHUB_TOKEN', value: '@Microsoft.KeyVault(SecretUri=${kvSecret.properties.secretUri})' }
      ]
      linuxFxVersion: 'NODE|22-lts'
      webSocketsEnabled: true
      alwaysOn: true
    }
  }
}
```

App `PORT` and `WEBSITES_PORT` must both be `3000`.
