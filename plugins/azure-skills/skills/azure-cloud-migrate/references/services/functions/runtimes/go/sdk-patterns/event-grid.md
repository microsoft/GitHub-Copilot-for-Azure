# Event Grid — publish (Azure SDK for Go)

> Shared ground rules (credential setup, client lifetime, URL app settings) → [README.md](./README.md).

```go
import (
    "os"

    "github.com/Azure/azure-sdk-for-go/sdk/azcore/to"
    "github.com/Azure/azure-sdk-for-go/sdk/messaging/eventgrid/azeventgrid"
)

var eg, _ = azeventgrid.NewClient(os.Getenv("EVENTGRID_ENDPOINT"), cred, nil)

events := []azeventgrid.CloudEvent{{
    Source: to.Ptr("myapp"), Type: to.Ptr("order.created"),
    Data: order, DataContentType: to.Ptr("application/json"),
}}
_, err := eg.PublishCloudEvents(ctx, "mytopic", events, nil)
```
