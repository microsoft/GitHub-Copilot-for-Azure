---
name: azure-container-apps
description: Deploy and manage Azure Container Apps for microservices, APIs, and serverless containers. Includes guidance on azd deployment, ACR integration, scaling, and troubleshooting.
---

# Azure Compute Services

## MANDATORY: Use azd for All Deployments

> **DO NOT use `az` CLI commands like `az containerapp create`, `az webapp up`, etc.**
> **ALWAYS use `azd up` for deployments.**
> Only use `az` for deployments if the user explicitly requests it.

```bash
# Deploy everything - THIS IS THE ONLY WAY
azd up

# Clean up test environments
azd down --force --purge
```

**Why azd is mandatory:**
- **Parallel provisioning** - deploys in seconds, not minutes
- **Automatic ACR integration** - no image pull failures
- **Single command** - `azd up` replaces 5+ `az` commands
- **Use az for queries only** - `az containerapp show`, `az webapp list`, etc.

## Services

| Service | Use When | azd Template |
|---------|----------|--------------|
| Container Apps | Microservices, APIs, containers | `todo-nodejs-mongo-aca` |
| Azure Functions | Event-driven, serverless | `todo-python-mongo-swa-func` |
| App Service | Traditional web apps | `todo-csharp-sql` |
| AKS | Full Kubernetes control | (use azd with custom Bicep) |

## Quick Deploy

```bash
# 1. Initialize from template
azd init --template azure-samples/todo-nodejs-mongo-aca

# 2. Deploy (provisions + deploys in parallel)
azd up

# 3. Iterate on code changes
azd deploy

# 4. Clean up test environment
azd down --force --purge
```

## Pre-flight Check

**Run `/azure:preflight` before deploying** to verify:
- Tools installed (az, azd, docker)
- Authentication valid
- Quotas sufficient
- Docker running

## MCP Server (For Queries Only)

Use MCP tools to **query** existing resources, not deploy:

- `azure_container_app_list` - List container apps
- `azure_appservice_webapp_list` - List web apps
- `azure_function_app_list` - List function apps
- `azure_aks_cluster_list` - List AKS clusters

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.

## Choosing the Right Compute

| If your app is... | Use | Why |
|-------------------|-----|-----|
| HTTP APIs, microservices | **Container Apps** | Serverless, auto-scale, Dapr |
| Event-driven | **Functions** | Pay-per-execution |
| Traditional web apps | **App Service** | Managed platform |
| Complex K8s workloads | **AKS** | Full control |

## Service Details

- Container Apps (recommended) -> `services/container-apps.md`
- Azure Functions -> `services/functions.md`
- App Service -> `services/app-service.md`
- AKS -> `services/aks.md`

## Production Configs

- Node.js/Express apps -> `scenarios/nodejs-production.md`

---

# Azure Container Apps

> **MANDATORY: Deploy with `azd up` - DO NOT use `az containerapp create/up`**
> The `az` CLI is for queries only (show, list, logs). Use `azd` for all deployments.

## Quick Reference

| Property | Value |
|----------|-------|
| Deploy with | **`azd up` (MANDATORY)** |
| Query with | `az containerapp show/list/logs` |
| MCP tools | `azure_container_app_list` |
| Best for | Microservices, serverless containers, HTTP APIs |

## Deploy with azd (MANDATORY)

```bash
# Initialize
azd init --template azure-samples/todo-nodejs-mongo-aca

# Deploy (handles ACR, Container Apps, networking automatically)
azd up

# Update code only
azd deploy

# Clean up test environment
azd down --force --purge
```

**azd advantages:**
- Parallel resource provisioning (faster than az)
- Automatic ACR credential configuration
- Integrated environment management
- One-command teardown

## Popular azd Templates

| Template | Stack |
|----------|-------|
| `todo-nodejs-mongo-aca` | Node.js + MongoDB + Container Apps |
| `todo-python-mongo-aca` | Python + MongoDB + Container Apps |
| `todo-csharp-sql-aca` | .NET + SQL + Container Apps |

## ACR Integration (CRITICAL)

**azd handles this automatically.** If you must deploy manually, configure ACR credentials:

```bash
# The problem: Container Apps can't pull from ACR without credentials
# The fix:
az containerapp registry set \
  --name APP \
  --resource-group RG \
  --server ACR.azurecr.io \
  --identity system
```

**Symptom of missing ACR config:** Container stuck in "Waiting" or "ImagePullBackOff"

## Manual Deployment (Only If azd Not Possible)

### Option 1: ACR Build (Cloud Build)

```bash
# Build in the cloud (requires ACR Tasks - may be disabled on free subscriptions)
az acr build --registry ACR --image myapp:v1 .
```

### Option 2: Local Docker Build (Fallback)

**If ACR Tasks is disabled** (common on free/trial subscriptions), build locally:

```bash
# Build locally with Docker
docker build -t ACR.azurecr.io/myapp:v1 .

# Login to ACR
az acr login --name ACR

# Push to ACR
docker push ACR.azurecr.io/myapp:v1
```

**Error pattern to detect:** `ACR Tasks is not supported` or `TasksOperationsNotAllowed`

### Deploy to Container Apps

```bash
# Create Container App
az containerapp up \
  --name myapp \
  --resource-group RG \
  --image ACR.azurecr.io/myapp:v1 \
  --ingress external \
  --target-port 8080

# IMPORTANT: Configure ACR credentials
az containerapp registry set \
  --name myapp \
  --resource-group RG \
  --server ACR.azurecr.io \
  --identity system
```

## Scaling Configuration

### HTTP-Based Scaling

```bash
az containerapp update \
  --name myapp \
  --resource-group RG \
  --min-replicas 1 \
  --max-replicas 10 \
  --scale-rule-name http-rule \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50
```

### Prevent Cold Starts

```bash
# Set minimum replicas to avoid cold start
az containerapp update --name myapp -g RG --min-replicas 1
```

## Environment Variables and Secrets

```bash
# Set environment variable
az containerapp update \
  --name myapp -g RG \
  --set-env-vars KEY=VALUE NODE_ENV=production

# Create secret
az containerapp secret set \
  --name myapp -g RG \
  --secrets dbpassword=secretvalue

# Reference secret in env var
az containerapp update \
  --name myapp -g RG \
  --set-env-vars DB_PASSWORD=secretref:dbpassword
```

## Troubleshooting

### ACR Tasks Disabled (Free Subscriptions)

**Symptom:** `az acr build` fails with "ACR Tasks is not supported" or "TasksOperationsNotAllowed"

**Cause:** Free/trial subscriptions often have ACR Tasks disabled

**Fix: Use local Docker build instead:**
```bash
# Build locally
docker build -t ACR.azurecr.io/myapp:v1 .

# Login to ACR
az acr login --name ACR

# Push
docker push ACR.azurecr.io/myapp:v1
```

### Image Pull Failures

**Symptom:** App stuck in "Waiting" or "ImagePullBackOff"

**Diagnose:**
```bash
# Check if registry is configured
az containerapp show --name APP -g RG --query "properties.configuration.registries"
```

**Fix:**
```bash
az containerapp registry set --name APP -g RG --server ACR.azurecr.io --identity system
```

### Cold Start Timeouts

**Symptom:** First request times out

**Fix:**
```bash
az containerapp update --name APP -g RG --min-replicas 1
```

### Port Mismatch

**Symptom:** App starts but requests fail

**Check:**
```bash
az containerapp show --name APP -g RG --query "properties.configuration.ingress.targetPort"
```

**Fix:** Ensure app listens on the configured port (check Dockerfile EXPOSE)

### View Logs

```bash
# Stream logs
az containerapp logs show --name APP -g RG --follow

# Recent logs
az containerapp logs show --name APP -g RG --tail 100
```

## Health Checks

Configure health probes:

```bash
az containerapp update \
  --name myapp -g RG \
  --health-probe-path /health \
  --health-probe-interval 30 \
  --health-probe-timeout 5
```

Your app should expose a health endpoint:
```javascript
app.get('/health', (req, res) => res.sendStatus(200));
```

## Dapr Integration

Enable Dapr for service-to-service communication:

```bash
az containerapp update \
  --name myapp -g RG \
  --enable-dapr \
  --dapr-app-id myapp \
  --dapr-app-port 8080
```

## Best Practices

1. **Use azd** for all deployments
2. **Run preflight checks** before deploying
3. **Set min-replicas=1** to avoid cold starts in production
4. **Configure health probes** for reliability
5. **Use managed identity** for ACR access
6. **Store secrets in Key Vault** with managed identity
