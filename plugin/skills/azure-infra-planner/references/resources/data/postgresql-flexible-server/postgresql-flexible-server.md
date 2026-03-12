# PostgreSQL Flexible Server

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.DBforPostgreSQL/flexibleServers` |
| Bicep API Version | `2024-08-01` |
| CAF Prefix | `psql` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

PostgreSQL Flexible Server does not use `kind`.

## SKU Names

See [skus.md](skus.md) for the complete list of SKU names and tiers.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 3 |
| Max Length | 63 |
| Allowed Characters | Lowercase letters, numbers, and hyphens. Cannot start or end with hyphen. |
| Scope | Global (must be globally unique as DNS name `{name}.postgres.database.azure.com`) |
| Pattern | `psql-{workload}-{env}-{instance}` |
| Example | `psql-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | VM SKU | See Common SKU Names table |
| `sku.tier` | SKU tier | `Burstable`, `GeneralPurpose`, `MemoryOptimized` |
| `properties.version` | PostgreSQL version | `13`, `14`, `15`, `16`, `17`, `18` |
| `properties.administratorLogin` | Admin username | String |
| `properties.administratorLoginPassword` | Admin password | String (secure) |
| `properties.createMode` | Creation mode | `Default`, `PointInTimeRestore`, `GeoRestore`, `Replica`, `ReviveDropped` |
| `properties.storage.storageSizeGB` | Storage size in GiB | `32` to `32768` |
| `properties.storage.autoGrow` | Auto-grow storage | `Enabled`, `Disabled` |
| `properties.backup.backupRetentionDays` | Backup retention | `7` to `35` |
| `properties.backup.geoRedundantBackup` | Geo-redundant backup | `Enabled`, `Disabled` |
| `properties.highAvailability.mode` | HA mode | `Disabled`, `ZoneRedundant`, `SameZone` |
| `properties.network.delegatedSubnetResourceId` | VNet subnet | Resource ID (delegated subnet) |
| `properties.network.privateDnsZoneArmResourceId` | Private DNS zone | Resource ID |
| `properties.authConfig.activeDirectoryAuth` | Entra ID auth | `Enabled`, `Disabled` |
| `properties.authConfig.passwordAuth` | Password auth | `Enabled`, `Disabled` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Databases | `Microsoft.DBforPostgreSQL/flexibleServers/databases` | Individual databases |
| Configurations | `Microsoft.DBforPostgreSQL/flexibleServers/configurations` | Server parameter settings |
| Firewall Rules | `Microsoft.DBforPostgreSQL/flexibleServers/firewallRules` | Public access IP allow rules |
| Administrators | `Microsoft.DBforPostgreSQL/flexibleServers/administrators` | Azure AD administrators |

## References

- [Bicep resource reference (2024-08-01)](https://learn.microsoft.com/azure/templates/microsoft.dbforpostgresql/flexibleservers?pivots=deployment-language-bicep)
- [PostgreSQL Flexible Server overview](https://learn.microsoft.com/azure/postgresql/flexible-server/overview)
- [Azure naming rules — DBforPostgreSQL](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftdbforpostgresql)
- [Compute and storage options](https://learn.microsoft.com/azure/postgresql/flexible-server/concepts-compute-storage)
