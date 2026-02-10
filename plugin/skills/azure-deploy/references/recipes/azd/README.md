# AZD Deploy Recipe

Deploy to Azure using Azure Developer CLI (azd).

> 💡 **Note:** azd supports both Bicep and Terraform as IaC providers. The deployment workflow is identical regardless of which you use.

## Prerequisites

- `azd` CLI installed → Run `mcp_azure_mcp_extension_cli_install` with `cli-type: azd` if needed
- `.azure/preparation-manifest.md` exists with status `Validated`
- `azure.yaml` exists and validated
- Infrastructure files exist:
  - For Bicep: `infra/main.bicep`
  - For Terraform: `infra/*.tf` files with `azure.yaml` having `infra.provider: terraform`
- **Subscription and location confirmed** → See [pre-deploy-checklist.md](../../pre-deploy-checklist.md)

## Workflow

> ⛔ **CRITICAL**: Follow this sequence EXACTLY. Do NOT skip steps or reorder.

| Step | Task | Command | Notes |
|------|------|---------|-------|
| 1 | **Create environment** | `azd env new <name>` | MUST be first |
| 2 | **Check RG exists** | `az group show --name rg-<name>` | Avoid location conflicts |
| 3 | **Check tag conflicts in RG** | `az resource list --resource-group rg-<name> --tag azd-service-name=web` | Per service |
| 4 | **Confirm with user** | Use `ask_user` | Subscription AND location |
| 5 | **Set subscription** | `azd env set AZURE_SUBSCRIPTION_ID <id>` | — |
| 6 | **Set location** | `azd env set AZURE_LOCATION <region>` | — |
| 7 | **Verify settings** | `azd env get-values` | Confirm before deploy |
| 8 | **Deploy** | `azd up --no-prompt` | Only after all above |

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

- [Pre-deploy checklist](../../pre-deploy-checklist.md) — **REQUIRED reading**
- [Azure Functions deployment](functions-deploy.md)
- [Verification steps](verify.md)
- [Error handling](errors.md)
