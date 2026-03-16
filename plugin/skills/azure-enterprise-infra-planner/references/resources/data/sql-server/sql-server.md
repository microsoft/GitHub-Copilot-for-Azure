# SQL Server

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Sql/servers` |
| Bicep API Version | `2023-08-01` |
| CAF Prefix | `sql` |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

SQL Server `kind` is **read-only** — it is computed by Azure and cannot be set in Bicep.

## SKU Names

SQL Server (logical server) does not use SKU. SKU is configured on the child **databases**.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 63 |
| Allowed Characters | Lowercase letters, numbers, and hyphens. Can't start or end with hyphen. |
| Scope | Global (must be globally unique as DNS name `{name}.database.windows.net`) |
| Pattern | `sql-{workload}-{env}-{instance}` |
| Example | `sql-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.administratorLogin` | SQL admin username | String — **immutable** after creation |
| `properties.administratorLoginPassword` | SQL admin password | String — write-only, not returned by GET |
| `properties.administrators` | Azure AD admin config | Object with `azureADOnlyAuthentication`, `login`, `sid`, `tenantId` |
| `properties.minimalTlsVersion` | Minimum TLS version | `None`, `1.0`, `1.1`, `1.2`, `1.3` |
| `properties.publicNetworkAccess` | Public access | `Disabled`, `Enabled` |
| `properties.restrictOutboundNetworkAccess` | Outbound restrictions | `Disabled`, `Enabled` |
| `properties.version` | Server version | `2.0`, `12.0` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Databases | `Microsoft.Sql/servers/databases` | SQL databases (see [sql-database.md](../sql-database/sql-database.md)) |
| Elastic Pools | `Microsoft.Sql/servers/elasticPools` | Shared resource pools |
| Firewall Rules | `Microsoft.Sql/servers/firewallRules` | IP-based firewall rules |
| VNet Rules | `Microsoft.Sql/servers/virtualNetworkRules` | Subnet-based access control |
| Failover Groups | `Microsoft.Sql/servers/failoverGroups` | Geo-replication and failover |
| AAD Administrators | `Microsoft.Sql/servers/administrators` | Azure AD admin config |
| Audit Settings | `Microsoft.Sql/servers/auditingSettings` | Server-level auditing |

## References

- [Bicep resource reference (2023-08-01)](https://learn.microsoft.com/azure/templates/microsoft.sql/servers?pivots=deployment-language-bicep)
- [SQL Server overview](https://learn.microsoft.com/azure/azure-sql/database/sql-database-paas-overview)
- [Azure naming rules — SQL](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftsql)
- [SQL Server TDE with Key Vault](https://learn.microsoft.com/azure/azure-sql/database/transparent-data-encryption-byok-overview)
