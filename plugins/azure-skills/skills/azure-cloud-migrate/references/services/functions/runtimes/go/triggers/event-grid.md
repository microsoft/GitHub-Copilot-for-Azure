# Event Grid Trigger — Go

```go
func onEvent(ctx context.Context, e bindings.EventGridEvent) error {
    // e.Id, e.EventType, e.Subject, e.EventTime, e.Data (json.RawMessage)
    return nil
}

app.EventGrid("eventGridTrigger", onEvent)
```
