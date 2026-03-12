## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Standard, Premium, and Dedicated SKUs support VNet service endpoints and private endpoints. |
| **Zone Redundancy** | Available in Standard (with ≥4 TU recommended) and Premium. |
| **Kafka** | Kafka protocol support available in Standard and Premium only (not Basic). |
| **Capture** | Event capture to Storage/Data Lake available in Standard and Premium only. |
| **Consumer Groups** | Basic: 1 consumer group. Standard: 20. Premium: 100. Dedicated: 1,000. |
| **Retention** | Basic: 1 day. Standard: 1–7 days. Premium: up to 90 days. |
| **Function App** | Event Hub trigger uses connection string or managed identity. Set `EventHubConnection` in app settings. |
