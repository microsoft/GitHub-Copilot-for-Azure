# AZD Errors

## Common Errors and Resolutions

| Error | Cause | Resolution |
|-------|-------|------------|
| `unknown flag: --location` | `azd up` doesn't accept `--location` | Use `azd env set AZURE_LOCATION <region>` before `azd up` |
| `no default response for prompt 'Enter a unique environment name'` | No azd environment created | Run `azd env new <name>` FIRST |
| `no default response for prompt 'Enter a value for the 'environmentName'` | Environment variables not set | Run `azd env set AZURE_ENV_NAME <name>` |
| `Invalid resource group location '<loc>'. The Resource group already exists in location '<other>'` | RG exists in different region | Check RG location first with `az group show`, use that region or new env name |
| `expecting only '1' resource tagged with 'azd-service-name: web', but found '2'` | Duplicate tagged resources in subscription | Delete old resource or change its tags |
| `Could not find a part of the path 'infra\main.bicep'` | Missing infrastructure files | Generate infra/ folder before `azd up` |
| Not authenticated | Azure login expired | `azd auth login` |
| Provision failed | Bicep template errors | Check detailed error in output |
| Deploy failed | Build or Docker errors | Check build logs |
| Package failed | Missing Dockerfile or deps | Verify Dockerfile exists and dependencies |
| Quota exceeded | Subscription limits | Request increase or change region |

## Pre-Flight Checks to Avoid Errors

Before running `azd up`, verify:

```bash
# 1. Environment exists
azd env list

# 2. Environment variables set
azd env get-values

# 3. Resource group doesn't conflict
az group show --name rg-<env-name> 2>&1

# 4. No tag conflicts
az resource list --tag azd-service-name=<service> --query "[].{name:name,rg:resourceGroup}" -o table
```

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
