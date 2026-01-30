# Cleanup

Delete all deployed resources.

## ⚠️ WARNING: DESTRUCTIVE

This permanently deletes ALL resources including:
- Databases and their data
- Storage accounts and their contents
- Key Vaults and their secrets

## Command

```bash
azd down --force --purge
```

## Flags

| Flag | Purpose |
|------|---------|
| `--force` | Skip confirmation prompt |
| `--purge` | Permanently delete Key Vaults (bypass soft-delete) |

## Selective Cleanup

To keep some resources, delete manually in Azure Portal or use:

```bash
az group delete --name <resource-group-name> --yes
```
