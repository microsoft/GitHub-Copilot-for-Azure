## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **VNet (private access)** | Requires a dedicated subnet delegated to `Microsoft.DBforMySQL/flexibleServers`. Subnet must have no other resources. |
| **Private DNS Zone** | For VNet-integrated (private access) servers, use the zone name `{name}.mysql.database.azure.com` (not `privatelink.*`). The `privatelink.mysql.database.azure.com` zone is used for Private Endpoint connectivity only. Provide `privateDnsZoneResourceId` and the DNS zone must be linked to the VNet. |
| **High Availability** | `ZoneRedundant` HA requires `GeneralPurpose` or `MemoryOptimized` tier. Not available with `Burstable`. |
| **Geo-Redundant Backup** | Must be enabled at server creation time. Cannot be changed after creation. Not available in all regions. |
| **Storage Auto-Grow** | Storage can only grow, never shrink. Enabled by default. |
| **Read Replicas** | Source server must have `backup.backupRetentionDays` > 1. Replica count limit: up to 10 replicas. |
| **Key Vault (CMK)** | Customer-managed keys require user-assigned managed identity and Key Vault with purge protection enabled. |
