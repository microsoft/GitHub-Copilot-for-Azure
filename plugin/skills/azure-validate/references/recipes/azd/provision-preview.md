# Provision Preview

Preview what infrastructure will be created.

## Command

```bash
azd provision --preview --no-prompt
```

## What It Checks

- Bicep templates compile without errors
- Resource names are available
- Permissions are sufficient
- No conflicts with existing resources
- Quota limits not exceeded

## Common Errors

| Error | Fix |
|-------|-----|
| Invalid Bicep syntax | Fix errors in `./infra/*.bicep` |
| Name already taken | Change resource naming in parameters |
| Quota exceeded | Request quota increase or change SKU |
| Permission denied | Check Azure RBAC roles |

## Debug Bicep Issues

```bash
# Validate Bicep directly
az bicep build --file ./infra/main.bicep

# Run what-if deployment
az deployment sub what-if \
  --location eastus \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```
