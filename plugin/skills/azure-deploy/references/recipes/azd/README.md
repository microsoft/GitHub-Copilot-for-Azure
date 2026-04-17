# AZD Deploy Recipe

Deploy to Azure using Azure Developer CLI (azd).

> 💡 **Note:** azd supports both Bicep and Terraform as IaC providers. The deployment workflow is identical regardless of which you use.

## Prerequisites

- `azd` CLI installed → Run `mcp_azure_mcp_extension_cli_install` with `cli-type: azd` if needed
- `.azure/deployment-plan.md` exists with status `Validated`
- `azure.yaml` exists and validated
- Infrastructure files exist (Bicep: `infra/main.bicep`, Terraform: `infra/*.tf`)
- **AZD environment configured** → Done in azure-validate
- **Subscription and location confirmed** → See [Pre-deploy Checklist](../../pre-deploy-checklist.md)

## Workflow

| Step | Task | Command |
|------|------|---------|
| 1 | **Verify environment** | `azd env get-values` — Confirm AZURE_SUBSCRIPTION_ID and AZURE_LOCATION set |
| 2 | **Provision infrastructure** | `azd provision --no-prompt` |
| 3 | **Sync provisioning outputs** | `azd env refresh` — See [Sync Outputs After Provision](#sync-outputs-after-provision) |
| 4 | **RBAC health check** *(Container Apps + ACR only)* | After provisioning, verify `AcrPull` role has propagated before deploying — see [Pre-Deploy Checklist](../../pre-deploy-checklist.md#container-apps--acr--pre-deploy-rbac-health-check) |
| 5 | **Deploy application** | `azd deploy --no-prompt` |
| 6 | **Post-Deploy** | [Post-Deployment Steps](post-deployment.md) — If using SQL + managed identity |
| 7 | **Verify** | See [Verification](verify.md) |
| 8 | **Report** | Present deployed endpoint URLs to the user — see [Verification](verify.md) Step 3 |

> ⚠️ **Important:** For Container Apps that use a managed identity to pull from ACR, always run `azd provision` and `azd deploy` as **separate steps** (not `azd up`) and complete the RBAC health check between them. This ensures the managed identity `AcrPull` role assignment has propagated before the Container App revision attempts to pull the image.

> ⚠️ **Important:** For .NET Aspire projects or projects using azd "limited mode" (no explicit `infra/` folder), verify that `azd provision` populated all required environment variables. If `azd deploy` fails with errors about missing `AZURE_CONTAINER_REGISTRY_ENDPOINT`, `AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID`, or `MANAGED_IDENTITY_CLIENT_ID`, see [Error Handling](errors.md#missing-container-registry-variables) for the resolution.

## Sync Outputs After Provision

> ⚠️ **MANDATORY** after `azd provision` and before `azd deploy`. Skipping this step can leave critical environment variables (e.g., `AZURE_CONTAINER_REGISTRY_ENDPOINT`) unpopulated, causing `azd deploy` to fail.

After `azd provision` completes, run `azd env refresh` to sync Bicep/Terraform outputs into the azd environment, then verify the required variables are set:

```bash
azd env refresh
azd env get-values
```

**PowerShell:**
```powershell
azd env refresh
azd env get-values
```

For Container Apps deployments, confirm that `AZURE_CONTAINER_REGISTRY_ENDPOINT` appears in the output. If it is missing after `azd env refresh`, set it manually:

```bash
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT $(az acr list --resource-group rg-<env-name> --query "[0].loginServer" -o tsv)
```

**PowerShell:**
```powershell
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT (az acr list --resource-group rg-<env-name> --query "[0].loginServer" -o tsv)
```

> 💡 **Tip:** `azd env refresh` re-reads all outputs from the most recent deployment. This is especially important when `azd provision` runs a long deployment where outputs may not be captured automatically.

## Common Mistakes

| ❌ Wrong | Why It Fails |
|----------|-------------|
| `azd up --location eastus2` | `--location` is not a valid flag for `azd up` |
| `azd up` without `azd env new` | Prompts for input, fails with `--no-prompt` |
| `mkdir .azure` then `azd env new --no-prompt` | Creates env folder structure incorrectly |
| Setting AZURE_LOCATION without checking RG | "Invalid resource group location" if RG exists elsewhere |
| Ignoring `azd-service-name` tag conflicts in same RG | "found '2' resources tagged with..." error |
| Skipping `azd env refresh` after `azd provision` | `AZURE_CONTAINER_REGISTRY_ENDPOINT` missing, `azd deploy` fails |
| `language: html` or `language: static` | Not valid - use `language: js` with `dist: .` for static sites |

## Deployment Commands

> ⚠️ `azd up` takes 5-15 min. Run with output **streamed visibly to the user** — do NOT run silently or suppress output. The user must see provisioning progress in real time.

### Full Deployment

Provisions infrastructure AND deploys application:

```bash
azd up --no-prompt
```

### Infrastructure Only

```bash
azd provision --no-prompt
```

### Application Only

Deploy code to existing infrastructure:

```bash
azd deploy --no-prompt
```

### Single Service

```bash
azd deploy api --no-prompt
```

## References

- [Pre-deploy Checklist](../../pre-deploy-checklist.md) — **REQUIRED**
- [Post-Deployment Steps](post-deployment.md) — SQL + managed identity setup
- [Azure Functions Deployment](functions-deploy.md)
- [Verification](verify.md)
- [Error Handling](errors.md)
