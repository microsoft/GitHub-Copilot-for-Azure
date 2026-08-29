# Service Bus with Go

Packages: `github.com/Azure/azure-sdk-for-go/sdk/azidentity` and
`github.com/Azure/azure-sdk-for-go/sdk/messaging/azservicebus`.

```go
credential, err := azidentity.NewDefaultAzureCredential(nil)
if err != nil { return err }
client, err := azservicebus.NewClient(
    os.Getenv("SERVICEBUS_FQDN"), credential, nil)
if err != nil { return err }
receiver, err := client.NewReceiverForQueue(
    os.Getenv("SERVICEBUS_QUEUE"), nil)
```

Use a bounded context for receive calls and close the receiver and client during shutdown.
