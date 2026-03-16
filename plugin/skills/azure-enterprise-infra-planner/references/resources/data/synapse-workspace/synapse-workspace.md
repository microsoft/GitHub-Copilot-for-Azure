# Azure Synapse Workspace

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Synapse/workspaces` |
| Bicep API Version | `2021-06-01` |
| CAF Prefix | `synw` |

## Region Availability

**Category:** Strategic — demand-driven availability across regions. Always verify target region supports Azure Synapse Analytics before planning.

## Subtypes (kind)

Does not use `kind`. Azure Synapse Workspace has no `kind` property — there is only one workspace type.

## SKU Names

Does not use `sku`. The workspace resource itself has no SKU. Compute costs are determined by child resources:

- **SQL Pools** (`workspaces/sqlPools`) — have DWU-based SKUs (e.g., `DW100c` through `DW30000c`)
- **Spark Pools** (`workspaces/bigDataPools`) — priced by node size and count

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 50 |
| Allowed Characters | Lowercase letters, numbers, and hyphens. Must start and end with a letter or number. Cannot contain `-ondemand`. |
| Scope | Global (must be globally unique) |
| Pattern (CAF) | `synw-{workload}-{env}-{region}-{instance}` |
| Example | `synw-analytics-prod-eastus2-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

See [properties.md](properties.md) for the complete list of key properties.

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Administrators | `Microsoft.Synapse/workspaces/administrators` | Workspace active directory admin |
| Auditing Settings | `Microsoft.Synapse/workspaces/auditingSettings` | SQL auditing configuration |
| Entra ID Only Auth | `Microsoft.Synapse/workspaces/azureADOnlyAuthentications` | Enforce Entra ID-only auth |
| Spark Pools | `Microsoft.Synapse/workspaces/bigDataPools` | Apache Spark pools |
| Dedicated SQL TLS | `Microsoft.Synapse/workspaces/dedicatedSQLminimalTlsSettings` | Minimum TLS version |
| Encryption Protector | `Microsoft.Synapse/workspaces/encryptionProtector` | CMK encryption protector |
| Extended Auditing | `Microsoft.Synapse/workspaces/extendedAuditingSettings` | Extended auditing settings |
| Firewall Rules | `Microsoft.Synapse/workspaces/firewallRules` | IP firewall rules |
| Integration Runtimes | `Microsoft.Synapse/workspaces/integrationRuntimes` | Integration runtimes |
| Keys | `Microsoft.Synapse/workspaces/keys` | Workspace encryption keys |
| Libraries | `Microsoft.Synapse/workspaces/libraries` | Spark pool libraries |
| Managed Identity SQL | `Microsoft.Synapse/workspaces/managedIdentitySqlControlSettings` | Managed identity SQL access |
| Private Endpoints | `Microsoft.Synapse/workspaces/privateEndpointConnections` | Private endpoint connections |
| Security Alerts | `Microsoft.Synapse/workspaces/securityAlertPolicies` | Security alert policies |
| SQL Administrators | `Microsoft.Synapse/workspaces/sqlAdministrators` | SQL admin configuration |
| SQL Pools | `Microsoft.Synapse/workspaces/sqlPools` | Dedicated SQL pools |
| Vulnerability Assessments | `Microsoft.Synapse/workspaces/vulnerabilityAssessments` | Vulnerability assessment settings |

## References

- [Bicep resource reference (2021-06-01)](https://learn.microsoft.com/azure/templates/microsoft.synapse/workspaces?pivots=deployment-language-bicep)
- [Azure Synapse Analytics overview](https://learn.microsoft.com/azure/synapse-analytics/overview-what-is)
- [Azure naming rules — Synapse](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftsynapse)
- [All Synapse resource types](https://learn.microsoft.com/azure/templates/microsoft.synapse/allversions)
