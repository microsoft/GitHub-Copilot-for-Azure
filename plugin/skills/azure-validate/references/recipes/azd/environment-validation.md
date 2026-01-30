# Environment Validation

Verify AZD environment is configured.

## Check Environment

```bash
azd env list
azd env get-values
```

## Required Values

| Variable | Purpose | Example |
|----------|---------|---------|
| `AZURE_ENV_NAME` | Environment name | `dev` |
| `AZURE_LOCATION` | Azure region | `eastus` |
| `AZURE_SUBSCRIPTION_ID` | Target subscription | `xxxxxxxx-xxxx-...` |

## Fix Missing Values

```bash
azd env set AZURE_LOCATION eastus
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>
```

## Common Errors

| Error | Fix |
|-------|-----|
| No environment selected | Run `azd env select <name>` |
| Missing AZURE_LOCATION | Run `azd env set AZURE_LOCATION <region>` |
| Missing subscription | Run `azd env set AZURE_SUBSCRIPTION_ID <id>` |
