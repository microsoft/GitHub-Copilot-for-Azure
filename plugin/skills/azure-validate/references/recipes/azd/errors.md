# AZD Validation Errors

| Error | Fix |
|-------|-----|
| `Please run 'az login'` | `az login` |
| `No environment selected` | `azd env select <name>` |
| `Service not found` | Check service name in azure.yaml |
| `Invalid azure.yaml` | Fix YAML syntax |
| `Project path does not exist` | Fix service project path |
| `Cannot connect to Docker daemon` | Start Docker Desktop |

## Static Web App Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `language 'html' is not supported` | Invalid language value | Omit `language` for pure static sites |
| `language 'static' is not supported` | Invalid language value | Omit `language` for pure static sites |
| `dist folder not found` | Wrong dist path or missing build | Check `dist` is relative to `project`; add `language: js` if build needed |
| `LocationNotAvailableForResourceType` | SWA not in region | See [region-availability.md](../../../../../azure-prepare/references/region-availability.md) for valid regions |

## SWA Path Validation

Before deployment, verify:
1. `project` path exists and contains source files
2. For framework apps: `language: js` is set
3. `dist` is relative to `project` (not project root)
4. Bicep has `azd-service-name` tag matching service name

## Debug

```bash
azd <command> --debug
```

## Pre-Flight Checks

Before running `azd up`, verify:

```bash
# 1. Environment exists
azd env list

# 2. Environment variables set
azd env get-values

# 3. Resource group doesn't conflict
az group show --name rg-<env-name> 2>&1

# 4. No tag conflicts within target RG
az resource list --resource-group rg-<env-name> --tag azd-service-name=<service> --query "[].name" -o table
```
