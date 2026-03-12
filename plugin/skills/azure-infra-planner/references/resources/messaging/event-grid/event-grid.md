# Event Grid Topic

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.EventGrid/topics` |
| Bicep API Version | `2025-02-15` |
| CAF Prefix | `evgt` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

| Kind | Description |
|------|-------------|
| `Azure` | Standard Azure Event Grid topic — **default** |
| `AzureArc` | Event Grid on Azure Arc (Kubernetes) |

## SKU Names

| SKU Name | Description |
|----------|-------------|
| `Basic` | Basic — standard event routing, no private endpoints |
| `Premium` | Premium — adds private endpoints |

> **Note:** `sku` is set as `{ name: 'Basic' }` or `{ name: 'Premium' }`. No `tier` or `capacity` needed.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 3 |
| Max Length | 50 |
| Allowed Characters | Alphanumerics and hyphens. Must start with letter, end with alphanumeric. |
| Scope | Region (unique across all resource groups within the same region) |
| Pattern | `evgt-{workload}-{env}-{instance}` |
| Example | `evgt-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | Pricing tier | `Basic`, `Premium` |
| `properties.inputSchema` | Event schema | `EventGridSchema` (default), `CloudEventSchemaV1_0`, `CustomEventSchema` |
| `properties.publicNetworkAccess` | Public access | `Enabled`, `Disabled`, `SecuredByPerimeter` |
| `properties.disableLocalAuth` | Disable SAS/key auth | `true`, `false` |
| `properties.inboundIpRules` | IP allow list | Array of `{ ipMask: 'CIDR', action: 'Allow' }` |
| `properties.dataResidencyBoundary` | Data residency | `WithinGeopair`, `WithinRegion` |
| `identity.type` | Managed identity | `None`, `SystemAssigned`, `UserAssigned`, `SystemAssigned,UserAssigned` |

### Read-Only Properties

| Property | Description |
|----------|-------------|
| `properties.endpoint` | Topic endpoint URL for publishing events |
| `properties.provisioningState` | Deployment state |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Event Subscriptions | `Microsoft.EventGrid/topics/eventSubscriptions` | Event delivery subscriptions |
| Private Endpoint Connections | `Microsoft.EventGrid/topics/privateEndpointConnections` | Private link connections |

## References

- [Bicep resource reference (2025-02-15)](https://learn.microsoft.com/azure/templates/microsoft.eventgrid/topics?pivots=deployment-language-bicep)
- [Event Grid overview](https://learn.microsoft.com/azure/event-grid/overview)
- [Azure naming rules — EventGrid](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsofteventgrid)
- [Event Grid security and authentication](https://learn.microsoft.com/azure/event-grid/security-authentication)
