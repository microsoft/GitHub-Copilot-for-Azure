# Event Hubs Trigger — Go

```go
func onEventHub(ctx context.Context, e bindings.EventHubMessage) error {
    // e.Body, e.SequenceNumber, e.Offset, e.EnqueuedTimeUtc, e.PartitionKey
    return nil
}

app.EventHub("eventHubTrigger", onEventHub,
    sdk.WithEventHubName("input-hub"),
    sdk.WithConnection("EventHubConnection"),
    sdk.WithConsumerGroup("$Default"),
)
```
