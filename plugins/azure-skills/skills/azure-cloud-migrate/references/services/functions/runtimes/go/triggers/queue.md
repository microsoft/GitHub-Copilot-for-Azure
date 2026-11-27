# Queue Storage Trigger — Go

```go
import (
    "context"
    "github.com/azure/azure-functions-golang-worker/sdk"
    "github.com/azure/azure-functions-golang-worker/sdk/bindings"
)

func onQueue(ctx context.Context, msg bindings.QueueMessage) error {
    // msg.Id, msg.Body, msg.DequeueCount, msg.InsertionTime, ...
    return nil
}

app.Queue("queueFunc", onQueue,
    sdk.WithQueueName("myqueue-items"),
    sdk.WithConnection("AzureWebJobsStorage"),
)
```
