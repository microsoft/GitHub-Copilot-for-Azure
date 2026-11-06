# Event Hubs — send batch (Azure SDK for Go)

> Shared ground rules (credential setup, client lifetime, URL app settings) → [README.md](./README.md).

```go
import "github.com/Azure/azure-sdk-for-go/sdk/messaging/azeventhubs"

var producer, _ = azeventhubs.NewProducerClient(
    os.Getenv("EVENTHUBS_FQDN"), "outhub", cred, nil)

batch, _ := producer.NewEventDataBatch(ctx, nil)
_ = batch.AddEventData(&azeventhubs.EventData{Body: payload}, nil)
err := producer.SendEventDataBatch(ctx, batch, nil)
```
