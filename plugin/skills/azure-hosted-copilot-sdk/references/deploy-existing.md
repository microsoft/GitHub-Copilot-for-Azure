# Deploy Existing Copilot SDK App

Adapt a user's existing Copilot SDK app for Azure using patterns from the reference templates.

## 1. Study Template Infra

Read the template via GitHub MCP before generating any files:

`github-mcp-server-get_file_contents` owner: `azure-samples`, repo: `copilot-sdk-service`

Key files to read: `azure.yaml`, `infra/main.bicep`, `infra/resources.bicep`, `scripts/get-github-token.mjs`, `AGENTS.md`

## 2. GitHub Token Flow

The Copilot SDK requires a `GITHUB_TOKEN` with `copilot` scope at runtime. The template pattern:

1. **`scripts/get-github-token.mjs`** — azd hook script that runs `gh auth token`, verifies `copilot` scope, stores token via `azd env set GITHUB_TOKEN`
2. **`azure.yaml` hooks** — `preprovision` and `prerun` both call the token script
3. **Bicep `@secure() param githubToken`** — azd auto-maps the env var to the Bicep param
4. **Key Vault** — stores `github-token` secret; Managed Identity gets `Key Vault Secrets User` role
5. **Container App env** — `{ name: 'GITHUB_TOKEN', secretRef: 'github-token' }` pulls from Key Vault URL

> ⚠️ Copy `scripts/get-github-token.mjs` from the template — do NOT rewrite it.

## 3. Bicep Pattern (AVM Modules)

Use these AVM modules — match the template exactly:

| Resource | AVM Module |
|----------|-----------|
| Monitoring | `br/public:avm/ptn/azd/monitoring:0.2.1` |
| Managed Identity | `br/public:avm/res/managed-identity/user-assigned-identity:0.5.0` |
| Key Vault | `br/public:avm/res/key-vault/vault:0.13.3` |
| Container Apps Stack | `br/public:avm/ptn/azd/container-apps-stack:0.3.0` |
| Container App | `br/public:avm/ptn/azd/acr-container-app:0.4.0` |

Key Vault config: `enableRbacAuthorization: true`, `enablePurgeProtection: false`, `softDeleteRetentionInDays: 7`.

## 4. azure.yaml Structure

```yaml
hooks:
  preprovision:
    windows:
      shell: pwsh
      run: node scripts/get-github-token.mjs
    posix:
      shell: sh
      run: node scripts/get-github-token.mjs
  prerun:
    windows:
      shell: pwsh
      run: node scripts/get-github-token.mjs
    posix:
      shell: sh
      run: node scripts/get-github-token.mjs

services:
  api:
    project: <user-api-path>
    language: <detected-language>
    host: containerapp
    ports: ["<detected-port>"]
    docker:
      path: ./Dockerfile
```

Adapt `project`, `language`, `ports` to the user's app. Add a `web` service if the app has a frontend.

## 5. Dockerfile

If the user has no Dockerfile, read the template's Dockerfile for the detected language via GitHub MCP and adapt it to the user's project structure (entry point, build steps, port).

## 6. BYOM Infrastructure (Azure Model)

If the user wants Azure BYOM, add these to Bicep:

| Resource | Purpose |
|----------|---------|
| Azure OpenAI / AI Services account | Hosts model deployments |
| Role assignment | `Cognitive Services OpenAI User` for Managed Identity |

Add env vars to Container App: `AZURE_OPENAI_ENDPOINT`, `MODEL_PROVIDER=azure`, `MODEL_NAME=<deployment>`.

See [Azure Model Configuration](azure-model-config.md) for provider config and auth pattern.

## 7. Errors

| Error | Fix |
|-------|-----|
| `gh` not installed | User must install GitHub CLI |
| Missing `copilot` scope | Run `gh auth refresh --scopes copilot` |
| Key Vault soft-delete conflict | Use a unique vault name or purge the old one |
| Token not injected | Verify `azure.yaml` hooks and `scripts/get-github-token.mjs` exist |
