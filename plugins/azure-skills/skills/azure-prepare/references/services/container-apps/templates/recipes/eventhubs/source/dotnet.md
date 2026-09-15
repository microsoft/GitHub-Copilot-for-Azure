# Event Hubs with C#

Packages: `Azure.Messaging.EventHubs.Processor`, `Azure.Storage.Blobs`, `Azure.Identity`.

```csharp
var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions {
    ManagedIdentityClientId = Environment.GetEnvironmentVariable("AZURE_CLIENT_ID")
});
var checkpoints = new BlobContainerClient(
    new Uri($"{Environment.GetEnvironmentVariable("CHECKPOINT_STORAGE_URL")}/checkpoints"),
    credential);
var processor = new EventProcessorClient(
    checkpoints,
    Environment.GetEnvironmentVariable("EVENTHUB_CONSUMER_GROUP"),
    Environment.GetEnvironmentVariable("EVENTHUB_FQDN"),
    Environment.GetEnvironmentVariable("EVENTHUB_NAME"),
    credential);
```

Register event and error handlers, then call `StartProcessingAsync`.
