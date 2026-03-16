# Service Bus Namespace

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.ServiceBus/namespaces` |
| Bicep API Version | `2024-01-01` |
| CAF Prefix | `sbns` (namespace) / `sbq` (queue) / `sbt` (topic) |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Service Bus does not use `kind`.

## SKU Names

| SKU Name | SKU Tier | Description |
|----------|----------|-------------|
| `Basic` | `Basic` | Basic — queues only, no topics, 256 KB message size |
| `Standard` | `Standard` | Standard — queues + topics, 256 KB messages, shared capacity |
| `Premium` | `Premium` | Premium — dedicated capacity, 100 MB messages, VNet, zones |

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 6 |
| Max Length | 50 |
| Allowed Characters | Alphanumerics and hyphens. Must start with a letter, end with letter or number. |
| Scope | Global (must be globally unique as DNS name `{name}.servicebus.windows.net`) |
| Pattern | `sbns-{workload}-{env}-{instance}` |
| Example | `sbns-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | Pricing tier | `Basic`, `Standard`, `Premium` |
| `sku.tier` | Tier (matches name) | `Basic`, `Standard`, `Premium` |
| `sku.capacity` | Messaging units (Premium) | `1`, `2`, `4`, `8`, `16` |
| `properties.zoneRedundant` | Zone redundancy (Premium) | `true`, `false` |
| `properties.premiumMessagingPartitions` | Partitions (Premium) | `1`, `2`, `4` |
| `properties.minimumTlsVersion` | Minimum TLS | `1.0`, `1.1`, `1.2` |
| `properties.publicNetworkAccess` | Public access | `Disabled`, `Enabled`, `SecuredByPerimeter` |
| `properties.disableLocalAuth` | Disable SAS keys | `true`, `false` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Queues | `Microsoft.ServiceBus/namespaces/queues` | Message queues |
| Topics | `Microsoft.ServiceBus/namespaces/topics` | Pub/sub topics (Standard/Premium) |
| Auth Rules | `Microsoft.ServiceBus/namespaces/authorizationRules` | SAS access policies |
| Disaster Recovery | `Microsoft.ServiceBus/namespaces/disasterRecoveryConfigs` | Geo-DR config |
| Network Rules | `Microsoft.ServiceBus/namespaces/networkRuleSets` | Network access rules |

## References

- [Bicep resource reference (2024-01-01)](https://learn.microsoft.com/azure/templates/microsoft.servicebus/namespaces?pivots=deployment-language-bicep)
- [Service Bus overview](https://learn.microsoft.com/azure/service-bus-messaging/service-bus-messaging-overview)
- [Azure naming rules — ServiceBus](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftservicebus)
- [Service Bus tiers](https://learn.microsoft.com/azure/service-bus-messaging/service-bus-premium-messaging)
