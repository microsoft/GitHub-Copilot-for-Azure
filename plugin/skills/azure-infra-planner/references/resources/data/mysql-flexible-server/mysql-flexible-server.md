# MySQL Flexible Server

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.DBforMySQL/flexibleServers` |
| Bicep API Version | `2023-12-30` |
| CAF Prefix | `mysql` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

MySQL Flexible Server does not use `kind`.

## SKU Names

See [skus.md](skus.md) for the complete list of SKU names and tiers.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 3 |
| Max Length | 63 |
| Allowed Characters | Lowercase letters, numbers, and hyphens. Cannot start or end with hyphen. |
| Scope | Global (must be globally unique as DNS name `{name}.mysql.database.azure.com`) |
| Pattern | `mysql-{workload}-{env}-{instance}` |
| Example | `mysql-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | VM SKU | See Common SKU Names table |
| `sku.tier` | SKU tier | `Burstable`, `GeneralPurpose`, `MemoryOptimized` |
| `properties.version` | MySQL version | `5.7`, `8.0.21`, `8.4` |
| `properties.administratorLogin` | Admin username | String |
| `properties.administratorLoginPassword` | Admin password | String (secure) |
| `properties.createMode` | Creation mode | `Default`, `PointInTimeRestore`, `GeoRestore`, `Replica` |
| `properties.storage.storageSizeGB` | Storage size in GiB | `20` to `16384` |
| `properties.storage.autoGrow` | Auto-grow storage | `Enabled`, `Disabled` |
| `properties.storage.autoIoScaling` | Auto IO scaling | `Enabled`, `Disabled` |
| `properties.storage.iops` | Provisioned IOPS | Integer |
| `properties.backup.backupRetentionDays` | Backup retention | `1` to `35` |
| `properties.backup.geoRedundantBackup` | Geo-redundant backup | `Enabled`, `Disabled` |
| `properties.highAvailability.mode` | HA mode | `Disabled`, `ZoneRedundant`, `SameZone` |
| `properties.network.delegatedSubnetResourceId` | VNet subnet | Resource ID (delegated subnet) |
| `properties.network.privateDnsZoneResourceId` | Private DNS zone | Resource ID |
| `properties.replicationRole` | Replication role | `None`, `Source`, `Replica` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Databases | `Microsoft.DBforMySQL/flexibleServers/databases` | Individual databases |
| Configurations | `Microsoft.DBforMySQL/flexibleServers/configurations` | Server parameter settings |
| Firewall Rules | `Microsoft.DBforMySQL/flexibleServers/firewallRules` | Public access IP allow rules |
| Administrators | `Microsoft.DBforMySQL/flexibleServers/administrators` | Azure AD administrators |

## References

- [Bicep resource reference (2023-12-30)](https://learn.microsoft.com/azure/templates/microsoft.dbformysql/flexibleservers?pivots=deployment-language-bicep)
- [MySQL Flexible Server overview](https://learn.microsoft.com/azure/mysql/flexible-server/overview)
- [Azure naming rules — DBforMySQL](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftdbformysql)
- [Compute and storage options](https://learn.microsoft.com/azure/mysql/flexible-server/concepts-compute-storage)
