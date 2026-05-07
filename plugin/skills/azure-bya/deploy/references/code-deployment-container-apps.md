# Code Deployment — Container Apps

After IaC deployment creates the Container App with a placeholder image (`mcr.microsoft.com/azuredocs/containerapps-helloworld:latest`), deploy the actual application code. This is **Phase 2** of the two-phase Container Apps deployment pattern.

> ⛔ **`--subscription {subscriptionId}` on EVERY `az` command** (from `deploymentVariables.subscriptionId`). Without it, the CLI uses whatever subscription is currently active — which may have changed since the prepare phase. This applies to ALL commands below.

> ⛔ **Phase 2 is NOT optional.** If IaC deployed a Container App with a placeholder image, you MUST execute Phase 2 before health checks. Do NOT leave a placeholder image and tell the user to deploy code manually.

**Determine the code deploy path:**

| Condition | Path | Steps |
|-----------|------|-------|
| ACR exists in IaC (`services[]` has Container Registry) | ACR build + image update | Steps 1–4 below |
| No ACR in IaC, simple app (single Dockerfile or source) | Add ACR to IaC + redeploy, then ACR build | Step 0 + Steps 1–4 |
| No ACR in IaC, no Dockerfile, Oryx-compatible (Node/Python/Go/.NET) | `az containerapp update --source .` | Step 5 (Oryx shortcut) |

## Step 0 — Add ACR to IaC (if not already present)

```bicep
// Add to modules/ — e.g., infra/modules/container-registry.bicep
param acrName string
param location string
param tags object

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

output acrLoginServer string = acr.properties.loginServer
output acrId string = acr.id
```

Also add AcrPull role assignment for the Container App's managed identity:
```bicep
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, containerApp.id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

Redeploy IaC with ACR included. Wait for AcrPull role to propagate (~60s). Log as a healing attempt.

⛔ **Update `prepare-plan.json`** — add the ACR service to `services[]` with correct naming. Update `scaffold-manifest.json.files[]` with the new module path. Update `costEstimate` if ACR changes the total.

## Steps 1–4 — ACR Build + Image Update (IaC-compliant)

| Step | Command | Notes |
|------|---------|-------|
| 1. Build image | `az acr build --subscription {subscriptionId} -r {acrName} -t {appName}:latest .` | Builds from workspace root. If `buildRequirements.hasBuildKitSyntax`, use `-f Dockerfile.azure` (see BuildKit handling below). Log in `deploy-audit.log` |
| 2. Update Bicep image | Edit `infra/modules/{containerapp}.bicep`: replace placeholder with `image: '{acrLoginServer}/{appName}:latest'`. Add ACR registry config: `registries: [{ server: acrLoginServer, identity: 'system' }]` | IaC-only — no imperative `az containerapp update` |
| 3. Redeploy | `az deployment sub create --subscription {subscriptionId} --location {location} --template-file infra/main.bicep --parameters @infra/main.parameters.json --name bya-code-deploy-{timestamp}` | Log in `deploy-audit.log`. Emit new portal link |
| 4. Verify revision | `az containerapp show --subscription {subscriptionId} -g {rg} -n {ca} --query "{revision:properties.latestReadyRevisionName, image:properties.template.containers[0].image}" -o json` | Confirm image is not the placeholder |

> ⛔ **`az acr build` failures count toward the `deploy-result.json.healingAttempts[]` counter.** After 3 failed builds (even with different root causes), pause and present a diagnosis to the user: "Web image build failed 3 times: [root causes]. Continue healing? (Yes / Cancel)." Each build fix attempt = 1 healing entry. Cross-reference deploy SKILL.md healing loop rule.

## Step 5 — Oryx Shortcut (no ACR needed, no Dockerfile)

```powershell
az containerapp update --subscription {subscriptionId} -g {rg} -n {ca} --source . --set-env-vars NODE_ENV=production
```

> ⛔ **`az containerapp update --source` is allowed for code deploy ONLY.** This is different from `az containerapp up --source` (which is ⛔ BLOCKED because it creates resources imperatively). `update --source` updates an EXISTING Container App — no state drift.

## After Code Deploy (all paths)

- Wait 30–60s for the new revision to become ready
- Proceed to Step 7 (Health-Check Endpoints)
- If health check returns placeholder content → image update didn't take effect. Check `az containerapp revision list`

> ⛔ **`az containerapp revision restart` does NOT re-resolve KV secrets.** Container Apps caches KV-backed `secretRef` values at revision *creation* time. To pick up updated KV secrets, create a NEW revision by redeploying Bicep (preferred) or `az containerapp update --revision-suffix rev{timestamp}`. Do NOT use `revision restart` for KV secret rotation — it only restarts the container with the same cached values.

> ⛔ **KV secretRef requires managed identity + role to exist first.** Phase 1 of the two-phase deploy creates the Container App with a placeholder image. KV `secretRef` cannot be used in Phase 1 because the Container App's managed identity doesn't exist yet (CA not created → no principalId → role assignment fails → KV access denied). Use inline `@secure()` parameters or hardcoded env vars in Phase 1. After Phase 1 completes and RBAC propagates (~60s), Phase 2 can use KV secretRef.

## BuildKit Dockerfile Handling

When `buildRequirements.hasBuildKitSyntax == true`, `az acr build` will fail because ACR's server-side builder does not support BuildKit extensions. Generate `Dockerfile.azure`:

1. Copy the original `Dockerfile` to `Dockerfile.azure`
2. Remove all `--mount=type=cache`, `--mount=type=bind`, `--mount=type=secret` directives from `RUN` lines
3. Remove `# syntax=docker/dockerfile:1` directives
4. Preserve everything else — especially multi-stage `FROM` ... `AS` and `COPY --from=` lines

**Examples:**

```dockerfile
# Original (BuildKit):
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
# Dockerfile.azure:
RUN pip install -r requirements.txt

# Multi-stage with --mount in build stage:
FROM node:20 AS builder
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html  # preserved
```

**Multi-line continuation (critical):** When `--mount` is on a line ending with `\`, the actual command is on the NEXT line. Strip the `--mount` flag AND the line continuation, then keep the command:

```dockerfile
# Original (BuildKit with continuation):
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project
# Dockerfile.azure:
RUN uv sync --frozen --no-dev --no-install-project

# Original (multiple flags on continuation lines):
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=bind,source=requirements.txt,target=requirements.txt \
    pip install -r requirements.txt
# Dockerfile.azure:
RUN pip install -r requirements.txt
```

⛔ **Do NOT strip `--mount` and leave a bare `RUN` instruction** — this produces `unknown instruction` errors on the next line. The command after ALL mount flags MUST be preserved as the `RUN` argument.

Use `az acr build -f Dockerfile.azure .` for the ACR build step. Complex cases (multiple `--mount` types, secret mounts with build args) may need manual review — flag as ⚠️ WARN if unsure.

## Image Parameter Pass-Through (Bicep Redeploy Safety)

When Bicep uses `param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'` as a placeholder, re-deploying IaC (e.g., to fix a firewall rule) resets the image. Pass the real image on every Bicep redeploy:

```powershell
az deployment sub create ... --parameters containerImage='{acrLoginServer}/{appName}:latest'
```

## Database Post-Deploy Verification

> ⛔ **You MUST read [`database-post-deploy.md`](database-post-deploy.md) using the `view` tool** for migration discovery, execution via Container Apps exec, error handling, and PostgreSQL-specific checks.
