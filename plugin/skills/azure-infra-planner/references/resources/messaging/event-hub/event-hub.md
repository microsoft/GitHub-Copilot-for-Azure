# Event Hub Namespace

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.EventHub/namespaces` |
| Bicep API Version | `2024-01-01` |
| CAF Prefix | `evhns` (namespace) / `evh` (event hub) |

## Region Availability

**Category:** Foundational — available in all recommended and alternate Azure regions.

## Subtypes (kind)

Event Hub does not use `kind`.

## SKU Names

| SKU Name | SKU Tier | Description |
|----------|----------|-------------|
| `Basic` | `Basic` | Basic — 1 consumer group, 1-day retention, 100 brokered connections |
| `Standard` | `Standard` | Standard — 20 consumer groups, 7-day retention, 1000 connections |
| `Premium` | `Premium` | Premium — dedicated capacity, 90-day retention, VNet, zones |

> **Note:** Event Hubs Dedicated is a separate resource type (`Microsoft.EventHub/clusters`), not a SKU.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 6 |
| Max Length | 50 |
| Allowed Characters | Alphanumerics and hyphens. Must start with a letter, end with letter or number. |
| Scope | Global (must be globally unique as DNS name `{name}.servicebus.windows.net`) |
| Pattern | `evhns-{workload}-{env}-{instance}` |
| Regex | `^[a-zA-Z][a-zA-Z0-9-]{4,48}[a-zA-Z0-9]$` |
| Example | `evhns-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | Pricing tier | `Basic`, `Standard`, `Premium` |
| `sku.tier` | Tier (matches name) | `Basic`, `Standard`, `Premium` |
| `sku.capacity` | Throughput/processing units | Integer (Standard: `1`–`40`, Premium: `1`–`16`) |
| `properties.isAutoInflateEnabled` | Auto-inflate (Standard) | `true`, `false` |
| `properties.maximumThroughputUnits` | Max TU for auto-inflate | `1` to `40` |
| `properties.zoneRedundant` | Zone redundancy | `true`, `false` |
| `properties.minimumTlsVersion` | Minimum TLS | `1.0`, `1.1`, `1.2` |
| `properties.publicNetworkAccess` | Public access | `Disabled`, `Enabled`, `SecuredByPerimeter` |
| `properties.disableLocalAuth` | Disable SAS keys | `true`, `false` |
| `properties.kafkaEnabled` | Kafka protocol support | `true` (Standard/Premium), `false` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Event Hubs | `Microsoft.EventHub/namespaces/eventhubs` | Individual event hubs |
| Auth Rules | `Microsoft.EventHub/namespaces/authorizationRules` | SAS access policies |
| Consumer Groups | `Microsoft.EventHub/namespaces/eventhubs/consumergroups` | Consumer group definitions |
| Disaster Recovery | `Microsoft.EventHub/namespaces/disasterRecoveryConfigs` | Geo-DR config |
| Network Rules | `Microsoft.EventHub/namespaces/networkRuleSets` | Network access rules |
| Schema Groups | `Microsoft.EventHub/namespaces/schemagroups` | Schema registry |

## References

- [Bicep resource reference (2024-01-01)](https://learn.microsoft.com/azure/templates/microsoft.eventhub/namespaces?pivots=deployment-language-bicep)
- [Event Hubs overview](https://learn.microsoft.com/azure/event-hubs/event-hubs-about)
- [Azure naming rules — EventHub](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsofteventhub)
- [Event Hubs tiers](https://learn.microsoft.com/azure/event-hubs/event-hubs-quotas)
