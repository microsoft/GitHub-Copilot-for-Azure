# Authentication Validation

Verify Azure authentication.

## Check AZD Auth

```bash
azd auth login --check-status
```

## Check Azure CLI Auth

```bash
az account show
```

## If Not Authenticated

```bash
azd auth login
az login
```

## Verify Correct Subscription

```bash
az account set --subscription <subscription-id>
```

## Common Errors

| Error | Fix |
|-------|-----|
| Not logged in | Run `azd auth login` and `az login` |
| Wrong subscription | Run `az account set --subscription <id>` |
| Token expired | Re-run `az login` |
