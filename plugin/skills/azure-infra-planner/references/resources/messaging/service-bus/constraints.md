## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Topics** | Only Standard and Premium SKUs support topics and subscriptions. Basic supports queues only. |
| **VNet** | Only Premium SKU supports VNet service endpoints and private endpoints. |
| **Zone Redundancy** | Only Premium SKU supports zone redundancy. |
| **Partitioning** | Premium messaging partitions cannot be changed after creation. |
| **Message Size** | Basic/Standard: max 256 KB. Premium: max 100 MB. Plan accordingly for large payloads. |
| **Function App** | Service Bus trigger uses connection string or managed identity. Set `ServiceBusConnection` in app settings. |
