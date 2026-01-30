# Initialize AZD Environment

Set up the Azure Developer CLI environment.

## Initialize Project

```bash
azd init
```

This creates `.azure/` directory for environment configuration.

## Create Environment

```bash
azd env new dev
```

Common environments: `dev`, `staging`, `prod`

## Set Required Values

```bash
azd env set AZURE_LOCATION eastus
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>
```

## Verify Environment

```bash
azd env get-values
```

Expected output:
```
AZURE_ENV_NAME="dev"
AZURE_LOCATION="eastus"
AZURE_SUBSCRIPTION_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Environment Files

| File | Purpose |
|------|---------|
| `.azure/dev/.env` | Environment variables |
| `.azure/dev/config.json` | Environment configuration |
| `.azure/config.json` | Default environment selection |

## Output

- `.azure/` directory created
- Environment configured with required values
