## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Azure Functions** | Must use `StorageV2` or `Storage` kind. `BlobStorage`, `BlockBlobStorage`, `FileStorage` not supported (missing Queue/Table). |
| **Functions (Consumption plan)** | Cannot use network-secured storage (VNet rules). Only Premium/Dedicated plans support VNet-restricted storage. |
| **Functions (zone-redundant)** | Must use ZRS SKU (`Standard_ZRS`). LRS/GRS not sufficient. |
| **VM Boot Diagnostics** | Cannot use Premium storage or ZRS. Use `Standard_LRS` or `Standard_GRS`. Managed boot diagnostics (no storage account required) is also available. |
| **CMK Encryption** | Key Vault must have `softDeleteEnabled: true` AND `enablePurgeProtection: true`. |
| **CMK at creation** | Requires user-assigned managed identity (system-assigned only works for existing accounts). |
| **Geo-redundant failover** | Certain features (SFTP, NFS 3.0, etc.) block GRS/GZRS failover. |
