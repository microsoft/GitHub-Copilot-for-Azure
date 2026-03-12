## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Event Subscriptions** | Subscriptions are child resources. Delivery endpoints include: Webhook, Azure Function, Event Hub, Service Bus Queue/Topic, Storage Queue, Hybrid Connection. |
| **Private Endpoint** | Only available with `Premium` SKU. Set `publicNetworkAccess: 'Disabled'` when using private endpoints exclusively. |
| **Managed Identity** | Required for dead-letter destinations and delivery to Azure resources that require authentication (Event Hub, Service Bus, Storage). |
| **Function App** | Use Event Grid trigger binding. Subscription endpoint type is `AzureFunction`. Function must have Event Grid extension registered. |
| **Event Hub** | Subscription endpoint type is `EventHub`. Provide the Event Hub resource ID. Requires managed identity or connection string. |
| **Storage Queue** | Subscription endpoint type is `StorageQueue`. Provide storage account ID and queue name. |
| **Dead Letter** | Dead-letter destination must be a Storage blob container. Requires managed identity or storage key for access. |
