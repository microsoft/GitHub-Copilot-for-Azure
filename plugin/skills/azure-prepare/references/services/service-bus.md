# Azure Service Bus

Messaging patterns and best practices for Azure Service Bus.

## When to Use

- Reliable message delivery
- Pub/sub messaging patterns
- Message ordering requirements
- Dead-letter handling
- Transaction support
- Enterprise integration

## Bicep Resource Pattern

```bicep
resource serviceBus 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '${resourcePrefix}-sb-${uniqueHash}'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
}

resource queue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBus
  name: 'orders'
  properties: {
    maxDeliveryCount: 10
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P14D'
    lockDuration: 'PT5M'
  }
}

resource topic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = {
  parent: serviceBus
  name: 'events'
  properties: {
    defaultMessageTimeToLive: 'P14D'
  }
}

resource subscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topic
  name: 'order-processor'
  properties: {
    maxDeliveryCount: 10
    deadLetteringOnMessageExpiration: true
    lockDuration: 'PT5M'
  }
}
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| None required | Service Bus is self-contained |
| Key Vault | Store connection strings |

## SKU Selection

| SKU | Features | Use Case |
|-----|----------|----------|
| Basic | Queues only, 256KB messages | Simple messaging |
| Standard | Topics, 256KB messages | Pub/sub patterns |
| Premium | 100MB messages, VNET, zones | Enterprise, high throughput |

## Messaging Patterns

### Point-to-Point (Queue)

```
Producer → Queue → Consumer
```

Use for: Work distribution, command processing

### Pub/Sub (Topic + Subscriptions)

```
Publisher → Topic → Subscription A → Consumer A
                 → Subscription B → Consumer B
```

Use for: Event broadcasting, multiple consumers

## Connection Patterns

### Node.js

```javascript
const { ServiceBusClient } = require("@azure/service-bus");

const client = new ServiceBusClient(process.env.SERVICEBUS_CONNECTION_STRING);
const sender = client.createSender("orders");

await sender.sendMessages({ body: { orderId: "123" } });
```

### Python

```python
from azure.servicebus import ServiceBusClient, ServiceBusMessage

client = ServiceBusClient.from_connection_string(
    os.environ["SERVICEBUS_CONNECTION_STRING"]
)
sender = client.get_queue_sender("orders")

with sender:
    sender.send_messages(ServiceBusMessage('{"orderId": "123"}'))
```

### .NET

```csharp
var client = new ServiceBusClient(
    Environment.GetEnvironmentVariable("SERVICEBUS_CONNECTION_STRING")
);
var sender = client.CreateSender("orders");

await sender.SendMessageAsync(new ServiceBusMessage('{"orderId": "123"}'));
```

## Message Processing

### Receive and Complete

```javascript
const receiver = client.createReceiver("orders");

const messages = await receiver.receiveMessages(10);
for (const message of messages) {
    // Process message
    await receiver.completeMessage(message);
}
```

### Dead Letter Handling

```javascript
const dlqReceiver = client.createReceiver("orders", {
    subQueueType: "deadLetter"
});
```

## Subscription Filters

### SQL Filter

```bicep
resource filterRule 'Microsoft.ServiceBus/namespaces/topics/subscriptions/rules@2022-10-01-preview' = {
  parent: subscription
  name: 'high-priority'
  properties: {
    filterType: 'SqlFilter'
    sqlFilter: {
      sqlExpression: 'priority = \'high\''
    }
  }
}
```

### Correlation Filter

```bicep
resource correlationRule 'Microsoft.ServiceBus/namespaces/topics/subscriptions/rules@2022-10-01-preview' = {
  parent: subscription
  name: 'orders-only'
  properties: {
    filterType: 'CorrelationFilter'
    correlationFilter: {
      label: 'order'
    }
  }
}
```

## Environment Variables

| Variable | Value |
|----------|-------|
| `SERVICEBUS_CONNECTION_STRING` | Connection string (Key Vault) |
| `SERVICEBUS_NAMESPACE` | Namespace name |
| `SERVICEBUS_QUEUE` | Queue name |

## Managed Identity Access

```bicep
resource serviceBusRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBus.id, principalId, 'Azure Service Bus Data Sender')
  scope: serviceBus
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39')
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
```
