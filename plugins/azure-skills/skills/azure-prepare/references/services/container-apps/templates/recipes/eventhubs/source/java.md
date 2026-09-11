# Event Hubs with Java

Packages: `com.azure:azure-messaging-eventhubs`,
`com.azure:azure-messaging-eventhubs-checkpointstore-blob`, `com.azure:azure-storage-blob`,
`com.azure:azure-identity`.

```java
TokenCredential credential = new DefaultAzureCredentialBuilder()
    .managedIdentityClientId(System.getenv("AZURE_CLIENT_ID"))
    .build();
BlobContainerAsyncClient checkpointContainer = new BlobContainerClientBuilder()
    .endpoint(System.getenv("CHECKPOINT_STORAGE_URL") + "/checkpoints")
    .credential(credential)
    .buildAsyncClient();
EventProcessorClient processor = new EventProcessorClientBuilder()
    .fullyQualifiedNamespace(System.getenv("EVENTHUB_FQDN"))
    .eventHubName(System.getenv("EVENTHUB_NAME"))
    .consumerGroup(System.getenv("EVENTHUB_CONSUMER_GROUP"))
    .credential(credential)
    .checkpointStore(new BlobCheckpointStore(checkpointContainer))
    .processEvent(context -> {
        handle(context.getEventData());
        context.updateCheckpoint();
    })
    .processError(context -> logger.error("Event Hubs", context.getThrowable()))
    .buildEventProcessorClient();
processor.start();
Runtime.getRuntime().addShutdownHook(new Thread(processor::stop));
```
