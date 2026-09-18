# Service Bus with C#

Packages: `Azure.Messaging.ServiceBus`, `Azure.Identity`.

```csharp
var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions {
    ManagedIdentityClientId = Environment.GetEnvironmentVariable("AZURE_CLIENT_ID")
});
await using var client = new ServiceBusClient(
    Environment.GetEnvironmentVariable("SERVICEBUS_FQDN"), credential);
ServiceBusProcessor processor = client.CreateProcessor(
    Environment.GetEnvironmentVariable("SERVICEBUS_QUEUE"));
```

Register message and error handlers before `StartProcessingAsync`. Complete a message only
after processing succeeds.
