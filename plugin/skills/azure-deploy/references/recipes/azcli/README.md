# Azure CLI Deploy Recipe

Deploy to Azure using Azure CLI.

## Prerequisites

- `az` CLI installed → Run `mcp_azure_mcp_extension_cli_install` with `cli-type: az` if needed
- `.azure/preparation-manifest.md` exists with status `Validated`
- Bicep/ARM templates exist in `infra/`

## Workflow

| Step | Task | Command |
|------|------|---------|
| 1 | Deploy infrastructure | `az deployment sub create` |
| 2 | Deploy application | Service-specific commands |
| 3 | Verify | `az resource list` |

## Infrastructure Deployment

### Subscription-Level (Recommended)

```bash
az deployment sub create \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters environmentName=dev
```

### Resource Group Level

```bash
az group create --name rg-myapp-dev --location eastus

az deployment group create \
  --resource-group rg-myapp-dev \
  --template-file ./infra/main.bicep \
  --parameters environmentName=dev
```

## Application Deployment

### Container Apps

```bash
az containerapp update \
  --name <app-name> \
  --resource-group <rg-name> \
  --image <acr-name>.azurecr.io/myapp:latest
```

### App Service

```bash
az webapp deploy \
  --name <app-name> \
  --resource-group <rg-name> \
  --src-path ./publish.zip
```

### Azure Functions

```bash
func azure functionapp publish <function-app-name>
```

## References

- [Verification steps](mdc:verify.md)
- [Error handling](mdc:errors.md)
