---
name: azure-storage
description: Azure Storage - Blob, File Shares, Queue, Table, Data Lake for object storage and messaging.
---

# Azure Storage

## MCP Tools

`azure__storage` - `storage_account_list`, `storage_container_list`, `storage_blob_list/get/put`

**Setup:** `/azure:setup` or `/mcp`

## CLI Fallback

```bash
az storage account list --output table
az storage container list --account-name ACCOUNT --output table
az storage blob list --account-name ACCOUNT --container-name CONTAINER --output table
az storage blob upload --account-name ACCOUNT --container-name CONTAINER --name BLOB --file PATH
```

## Blob Access Tiers

| Tier | Use | Cost |
|------|-----|------|
| Hot | Frequent access | High storage, low access |
| Cool | 30+ days | Lower storage |
| Archive | 180+ days | Lowest (rehydration needed) |

## Redundancy

| Type | Use |
|------|-----|
| LRS | Dev/test |
| ZRS | Regional HA |
| GRS/GZRS | Disaster recovery |

## References

[Blob Storage](https://learn.microsoft.com/azure/storage/blobs/storage-blobs-overview) · [Files](https://learn.microsoft.com/azure/storage/files/storage-files-introduction)
