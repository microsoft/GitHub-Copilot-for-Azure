## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Container App** | Container Apps reference the environment via `properties.environmentId`. Apps and environment must be in the same region. |
| **Log Analytics Workspace** | Provide `customerId` and `sharedKey` in `appLogsConfiguration`. Workspace must exist before the environment. |
| **VNet / Subnet** | Subnet must have a minimum /23 prefix for Consumption-only environments or /27 for workload profiles environments. Subnet must be dedicated to the Container Apps Environment (no other resources). Workload Profiles: subnet must be delegated to `Microsoft.App/environments`. Consumption-only: subnet MUST NOT be delegated to any service. |
| **Zone Redundancy** | Requires VNet integration. Zone-redundant environments need a /23 subnet in a region with availability zones. |
| **Internal Environment** | When `internal: true`, no public endpoint is created. Requires custom DNS or Private DNS Zone and a VNet with connectivity to clients. |
| **Workload Profiles** | At least one `Consumption` profile must be defined when using workload profiles. Dedicated profiles require `minimumCount` and `maximumCount`. |
| **Workload Profiles vs Consumption-only** | UDR support, NAT Gateway egress, private endpoints, and remote gateway peering are only available with Workload Profiles environments — not Consumption-only. |
| **Network Immutability** | Network type (Workload Profiles vs Consumption-only) is immutable after creation. Cannot change between environment types. |
| **IPv6** | IPv6 is not supported for either Workload Profiles or Consumption-only environments. |
| **VNet Move** | VNet-integrated environments cannot be moved to a different resource group or subscription while in use. |
