---
name: azure-deploy
description: Deploy applications to Azure using Azure Developer CLI (azd). Use for "deploy to Azure", "azd up", "publish to Azure".
---

# Azure Deployment

Deploy applications using Azure Developer CLI (azd).

## Execution Flow

### 1. Check azure.yaml
If missing → Use `azure-create-app` skill first

### 2. Check Environment
```bash
azd env list
```
No environment? Ask user for name, then: `azd env new <name>`

### 3. Check Subscription
```bash
azd config get defaults    # Check for global defaults
azd env get-values         # Check AZURE_SUBSCRIPTION_ID
```
If not set → Use `azure__subscription_list` MCP tool, then: `azd env set AZURE_SUBSCRIPTION_ID <id>`

### 4. Check Location
If `AZURE_LOCATION` not set → `azd env set AZURE_LOCATION <region>`

### 5. Deploy
```bash
azd up --no-prompt
```
**Preview first:** `azd provision --preview`

### 6. Handle Errors
Use `azure__azd` MCP tool with `error_troubleshooting` command.

| Error | Fix |
|-------|-----|
| Not authenticated | `azd auth login` |
| azure.yaml invalid | Use azure-create-app |
| Provision failed | Check quotas/permissions |

## Post-Deployment

```bash
azd monitor --logs      # View logs
azd down --force --purge  # Cleanup (DESTRUCTIVE)
```

See [references/TROUBLESHOOTING.md](references/TROUBLESHOOTING.md) for details.
