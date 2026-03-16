# Container Apps Environment

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.App/managedEnvironments` |
| Bicep API Version | `2025-01-01` |
| CAF Prefix | `cae` |

## Region Availability

**Category:** Strategic — demand-driven availability across regions; verify before planning.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

Container Apps Environment does not use `kind` in standard deployments.

## SKU Names

Container Apps Environment does not use a `sku` block. Billing is determined by **workload profiles** configured on the environment.

### Workload Profile Types

| Profile | Description |
|---------|-------------|
| `Consumption` | Serverless — auto-scales, pay-per-use. Default profile. |
| `D4` – `D32` | Dedicated general-purpose (4–32 vCPU) |
| `E4` – `E32` | Dedicated memory-optimized (4–32 vCPU) |

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 60 |
| Allowed Characters | Lowercase letters, numbers, and hyphens. Must start with a letter, end with alphanumeric. |
| Scope | Resource group |
| Pattern | `cae-{workload}-{env}-{instance}` |
| Example | `cae-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.appLogsConfiguration.destination` | Log destination | `log-analytics`, `azure-monitor`, `''` (none) |
| `properties.appLogsConfiguration.logAnalyticsConfiguration.customerId` | Log Analytics workspace ID | Workspace customer ID string |
| `properties.vnetConfiguration.infrastructureSubnetId` | VNet subnet | Resource ID — subnet must have minimum /23 prefix for Consumption-only or /27 for workload profiles |
| `properties.vnetConfiguration.internal` | Internal-only environment | `true`, `false` |
| `properties.zoneRedundant` | Zone redundancy | `true`, `false` |
| `properties.workloadProfiles[].workloadProfileType` | Workload profile type | `Consumption`, `D4`, `D8`, `D16`, `D32`, `E4`, `E8`, `E16`, `E32` |
| `properties.workloadProfiles[].name` | Profile name | String (use `Consumption` for the consumption profile) |
| `properties.workloadProfiles[].minimumCount` | Min instances (dedicated) | Integer |
| `properties.workloadProfiles[].maximumCount` | Max instances (dedicated) | Integer |
| `properties.peerAuthentication.mtls.enabled` | Mutual TLS | `true`, `false` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Certificates | `Microsoft.App/managedEnvironments/certificates` | TLS certificates for custom domains |
| Managed Certificates | `Microsoft.App/managedEnvironments/managedCertificates` | Azure-managed TLS certificates |
| Dapr Components | `Microsoft.App/managedEnvironments/daprComponents` | Dapr integration components |
| Storages | `Microsoft.App/managedEnvironments/storages` | Persistent storage mounts (Azure Files) |

## References

- [Bicep resource reference (2025-01-01)](https://learn.microsoft.com/azure/templates/microsoft.app/managedenvironments?pivots=deployment-language-bicep)
- [Container Apps environments overview](https://learn.microsoft.com/azure/container-apps/environment)
- [Azure naming rules — App](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftapp)
- [Workload profiles overview](https://learn.microsoft.com/azure/container-apps/workload-profiles-overview)
