# AZD Errors

## Common Errors and Resolutions

| Error | Cause | Resolution |
|-------|-------|------------|
| `unknown flag: --location` | `azd up` doesn't accept `--location` | Use `azd env set AZURE_LOCATION <region>` before `azd up` |
| `no default response for prompt 'Enter a unique environment name'` | No azd environment created | Run `azd env new <name>` FIRST |
| `no default response for prompt 'Enter a value for the 'environmentName'` | Environment variables not set | Run `azd env set AZURE_ENV_NAME <name>` |
| `Invalid resource group location '<loc>'. The Resource group already exists in location '<other>'` | RG exists in different region | Check RG location first with `az group show`, use that region or new env name |
| `expecting only '1' resource tagged with 'azd-service-name: web', but found '2'` | Multiple resources with same tag **in the same RG** | Delete duplicate or rename service |
| `Could not find a part of the path 'infra\main.bicep'` | Missing infrastructure files | Generate infra/ folder before `azd up` |
| Not authenticated | Azure login expired | `azd auth login` |
| Provision failed | Bicep template errors | Check detailed error in output |
| Deploy failed | Build or Docker errors | Check build logs |
| Package failed | Missing Dockerfile or deps | Verify Dockerfile exists and dependencies |
| Quota exceeded | Subscription limits | Request increase or change region |

> ℹ️ **Pre-flight validation**: Run `azure-validate` before deployment to catch these errors early. See [pre-deploy-checklist.md](../pre-deploy-checklist.md).

## Retry

After fixing the issue:
```bash
azd up --no-prompt
```

## Cleanup (DESTRUCTIVE)

```bash
azd down --force --purge
```

⚠️ Permanently deletes ALL resources including databases and Key Vaults.
