# AZD Deploy Recipe

Deploy to Azure using Azure Developer CLI (azd).

> 💡 **Note:** azd supports both Bicep and Terraform as IaC providers. The deployment workflow is identical regardless of which you use.

## Prerequisites

- `azd` CLI installed → Run `mcp_azure_mcp_extension_cli_install` with `cli-type: azd` if needed
- `.azure/plan.md` exists with status `Validated`
- `azure.yaml` exists and validated
- Infrastructure files exist (Bicep: `infra/main.bicep`, Terraform: `infra/*.tf`)
- **AZD environment configured** → Done in azure-validate
- **Subscription and location confirmed** → See [Pre-deploy Checklist](../../pre-deploy-checklist.md)

## Workflow

> ⚠️ **CRITICAL:** The deployment workflow differs based on project type. Follow the correct workflow below.

### For .NET Aspire Projects (Container Apps)

**If the project has `*.AppHost.csproj` or uses Aspire, you MUST use the split workflow:**

| Step | Task | Command |
|------|------|---------|
| 1 | **Verify environment** | `azd env get-values` — Confirm AZURE_SUBSCRIPTION_ID and AZURE_LOCATION set |
| 2 | **Provision infrastructure** | `azd provision --no-prompt` |
| 3 | **Set environment variables** | See [Aspire Environment Variables](#aspire-environment-variables) section below |
| 4 | **Deploy application** | `azd deploy --no-prompt` |
| 5 | **Verify** | See [Verification](verify.md) |

> 🛑 **DO NOT use `azd up` for Aspire projects.** It combines provision + deploy without the intermediate env var setup step, causing deployment failures.

### For Non-Aspire Projects

| Step | Task | Command |
|------|------|---------|
| 1 | **Verify environment** | `azd env get-values` — Confirm AZURE_SUBSCRIPTION_ID and AZURE_LOCATION set |
| 2 | **Deploy** | `azd up --no-prompt` |
| 3 | **Verify** | See [Verification](verify.md) |

## Aspire Environment Variables

**Required for .NET Aspire Container Apps projects after `azd provision`:**

```bash
# Get resource group name
RG_NAME=$(azd env get-values | grep AZURE_RESOURCE_GROUP | cut -d'=' -f2 | tr -d '"')

# Set required variables
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT $(az acr list --resource-group "$RG_NAME" --query "[0].loginServer" -o tsv)
azd env set AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID $(az identity list --resource-group "$RG_NAME" --query "[0].id" -o tsv)
azd env set MANAGED_IDENTITY_CLIENT_ID $(az identity list --resource-group "$RG_NAME" --query "[0].clientId" -o tsv)
```

**PowerShell:**
```powershell
# Get resource group name
$rgName = (azd env get-values | Select-String 'AZURE_RESOURCE_GROUP').Line.Split('=')[1].Trim('"')

# Set required variables
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT (az acr list --resource-group $rgName --query "[0].loginServer" -o tsv)
azd env set AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID (az identity list --resource-group $rgName --query "[0].id" -o tsv)
azd env set MANAGED_IDENTITY_CLIENT_ID (az identity list --resource-group $rgName --query "[0].clientId" -o tsv)
```

## Common Mistakes

| ❌ Wrong | Why It Fails |
|----------|-------------|
| `azd up --location eastus2` | `--location` is not a valid flag for `azd up` |
| `azd up` without `azd env new` | Prompts for input, fails with `--no-prompt` |
| `mkdir .azure` then `azd env new` | Creates env folder structure incorrectly |
| Setting AZURE_LOCATION without checking RG | "Invalid resource group location" if RG exists elsewhere |
| Ignoring `azd-service-name` tag conflicts in same RG | "found '2' resources tagged with..." error |
| `language: html` or `language: static` | Not valid - use `language: js` with `dist: .` for static sites |

## Deployment Commands

### Full Deployment (Non-Aspire Projects Only)

Provisions infrastructure AND deploys application in one command:

```bash
azd up --no-prompt
```

> 🛑 **DO NOT use `azd up` for .NET Aspire projects.** Use the split workflow above instead.

### Split Workflow (Required for Aspire, Optional for Others)

**1. Provision infrastructure:**

```bash
azd provision --no-prompt
```

**2. Set environment variables (if needed for Aspire):**

See [Aspire Environment Variables](#aspire-environment-variables) section.

**3. Deploy application:**

```bash
azd deploy --no-prompt
```

### Single Service

Deploy a specific service only:

```bash
azd deploy api --no-prompt
```

## References

- [Pre-deploy Checklist](../../pre-deploy-checklist.md) — **REQUIRED**
- [Azure Functions Deployment](functions-deploy.md)
- [Verification](verify.md)
- [Error Handling](errors.md)
