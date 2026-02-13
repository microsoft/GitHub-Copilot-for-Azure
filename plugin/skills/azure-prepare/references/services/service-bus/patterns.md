# Service Bus - Messaging Patterns

## Point-to-Point (Queue)

```
Producer → Queue → Consumer
```

Use for: Work distribution, command processing

## Pub/Sub (Topic + Subscriptions)

```
Publisher → Topic → Subscription A → Consumer A
                 → Subscription B → Consumer B
```

Use for: Event broadcasting, multiple consumers

## SDK Patterns

### Node.js

```javascript
const { ServiceBusClient } = require("@azure/service-bus");

const client = new ServiceBusClient(process.env.SERVICEBUS_CONNECTION_STRING);

// Send
const sender = client.createSender("orders");
await sender.sendMessages({ body: { orderId: "123" } });

// Receive
const receiver = client.createReceiver("orders");
const messages = await receiver.receiveMessages(10);
for (const message of messages) {
  await receiver.completeMessage(message);
}
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

## Dead Letter Handling

```javascript
const dlqReceiver = client.createReceiver("orders", {
    subQueueType: "deadLetter"
});
```
