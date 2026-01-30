# Troubleshooting

This reference covers common errors encountered during Azure deployment with `azd` and how to resolve them.

## Missing Infrastructure Parameters

**Symptom:** Error message like `ERROR: prompting for value: no default response for prompt 'Enter a value for the '<param>' infrastructure parameter:'`

**Cause:** A Bicep parameter exists in your template but no corresponding environment variable is set.

**Example:** The `infra/main.bicep` has a parameter like:
```bicep
@description('SKU for the storage account.')
param storageAccountSku string
```

**Solution:**

1. Check `infra/main.parameters.json` for an existing mapping to this parameter.

2. **If a mapping exists** (e.g., `"value": "${STORAGE_SKU}"`), ask the user for the desired value and set the environment variable:
```bash
azd env set STORAGE_SKU <user-provided-value>
```

3. **If no mapping exists**, add one to `infra/main.parameters.json`:
```json
{
  "parameters": {
    "storageAccountSku": {
      "value": "${STORAGE_SKU}"
    }
  }
}
```

Then ask the user for the desired value and set the environment variable:
```bash
azd env set STORAGE_SKU <user-provided-value>
```

During `azd provision`, azd will substitute `${STORAGE_SKU}` with the value from the environment and will pass it to Bicep.

**Reference:** [Use environment variables in infrastructure files](https://learn.microsoft.com/azure/developer/azure-developer-cli/manage-environment-variables?tabs=bash#use-environment-variables-in-infrastructure-files)
