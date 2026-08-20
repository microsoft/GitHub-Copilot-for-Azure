# Service Bus Trigger — Go

```go
// Queue
func onSBQueue(ctx context.Context, msg bindings.ServiceBusMessage) error {
    // msg.MessageId, msg.Body, msg.DeliveryCount, msg.SessionId, ...
    return nil
}

app.ServiceBusQueue("queueFunc", onSBQueue,
    sdk.WithQueueName("input-queue"),
    sdk.WithConnection("ServiceBusConnection"),
)

// Topic + Subscription
app.ServiceBusTopic("topicFunc", onSBQueue,
    sdk.WithTopicName("orders"),
    sdk.WithSubscriptionName("processor"),
    sdk.WithConnection("ServiceBusConnection"),
)
```
