# Service Bus — send (Azure SDK for Go)

> Shared ground rules (credential setup, client lifetime, URL app settings) → [README.md](./README.md).

```go
import "github.com/Azure/azure-sdk-for-go/sdk/messaging/azservicebus"

var sb, _     = azservicebus.NewClient(os.Getenv("SERVICEBUS_FQDN"), cred, nil)
var sender, _ = sb.NewSender("outqueue", nil) // or topic name

err := sender.SendMessage(ctx, &azservicebus.Message{Body: payload}, nil)
```
