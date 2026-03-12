## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **VNet (private access)** | Requires a dedicated subnet delegated to `Microsoft.DBforPostgreSQL/flexibleServers`. Subnet must have no other resources. |
| **Private DNS Zone** | For VNet-integrated (private access) servers, use the zone name `{name}.postgres.database.azure.com` (not `privatelink.*`). The `privatelink.postgres.database.azure.com` zone is used for Private Endpoint connectivity only. Provide `privateDnsZoneArmResourceId` and the DNS zone must be linked to the VNet. |
| **High Availability** | `ZoneRedundant` HA requires `GeneralPurpose` or `MemoryOptimized` tier. Not available with `Burstable`. |
| **Geo-Redundant Backup** | Not available in all regions. Cannot be enabled with VNet-integrated (private access) servers in some configurations. |
| **Storage Auto-Grow** | Storage can only grow, never shrink. Minimum increase is based on current size. |
| **Key Vault (CMK)** | Customer-managed keys require user-assigned managed identity and Key Vault with purge protection enabled. |
