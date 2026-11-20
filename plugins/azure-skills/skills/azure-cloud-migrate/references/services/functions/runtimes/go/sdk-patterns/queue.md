# Queue — send (Azure SDK for Go)

> Shared ground rules (credential setup, client lifetime, URL app settings) → [README.md](./README.md).

```go
import (
    "encoding/base64"
    "os"

    "github.com/Azure/azure-sdk-for-go/sdk/storage/azqueue"
)

var queue, _ = azqueue.NewQueueClient(
    os.Getenv("STORAGE_QUEUE_URI")+"/outqueue", cred, nil)

_, err := queue.EnqueueMessage(ctx, base64.StdEncoding.EncodeToString(payload), nil)
```

> Storage Queue messages must be Base64-encoded when written via SDK — the queue trigger binding does this for you, but the SDK does not.
