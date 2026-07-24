# Container Apps Template Recipes — REFERENCE ONLY

Composable IaC + configuration modules that extend base Container Apps templates
to support specific Azure service integrations.

## Architecture

```
Base Template (web-app, api, worker, job, etc.)
       │
       ├── Dockerfile + app code
       ├── IaC (Container Apps Environment, ACR, UAMI, RBAC)
       └── AZD config (azure.yaml)

       + Recipe (per integration)
       │
       ├── IaC module (new resource + RBAC + networking)
       ├── Environment variables
       └── Scaling rules (KEDA, if applicable)
       │
       = Complete deployable project → `azd up`
```

## Available Recipes

| Recipe | IaC Delta | Scaling Rules | Status |
|--------|-----------|---------------|--------|
| [dapr](dapr/README.md) | ✅ Dapr components | ❌ | ✅ Available |
| [cosmos](cosmos/README.md) | ✅ Cosmos account + DB + RBAC | ❌ | ✅ Available |
| [servicebus](servicebus/README.md) | ✅ SB namespace + queue + RBAC | ✅ KEDA azure-servicebus | ✅ Available |
| [redis](redis/README.md) | ✅ Redis cache + RBAC | ❌ | ✅ Available |
| [acr](acr/README.md) | ✅ ACR + RBAC | ❌ | ✅ Available |
| [postgres](postgres/README.md) | ✅ PostgreSQL Flexible + RBAC | ❌ | ✅ Available |

## How It Works

### Step 1: Select Base Template

Choose from [selection.md](../selection.md) based on workload type.

### Step 2: Apply Recipe(s)

Read each recipe's README for:
- **IaC modules** to copy into `infra/`
- **RBAC roles** with exact GUIDs
- **Environment variables** for the container app
- **Scaling rules** (KEDA) for event-driven scenarios

### Step 3: Wire Into Base

**Bicep:** Add `module` reference in `main.bicep`
**Terraform:** Copy `.tf` files, merge environment variables

### Step 4: Deploy

```bash
azd env set AZURE_LOCATION eastus2
azd provision --no-prompt
sleep 60
azd deploy --no-prompt
```

## Design Principles

| Principle | Why |
|-----------|-----|
| **Never synthesize base IaC** | Always use proven templates |
| **Never modify base; only extend** | Recipes are additive — no risk of breaking core |
| **Recipes own their RBAC** | Exact role GUIDs, no LLM guessing |
| **Stack-agnostic** | Container Apps runs any container — recipes work with any language |
| **Same algorithm for Bicep & Terraform** | Only IaC files differ, not composition logic |
| **UAMI everywhere** | Managed identity for all service connections |
