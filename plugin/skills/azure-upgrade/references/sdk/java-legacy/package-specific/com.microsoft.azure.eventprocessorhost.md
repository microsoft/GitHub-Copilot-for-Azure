# com.microsoft.azure.eventprocessorhost

## Code Samples

### EventProcessorHost with InMemoryCheckpointManager / InMemoryLeaseManager

Modern EventProcessorClient doesn't provide implementation of `InMemoryCheckpointManager` or `InMemoryLeaseManager`, due to production issues.
If they are used in legacy code, you should replace their usage to [BlobCheckpointStore](https://github.com/Azure/azure-sdk-for-java/blob/main/sdk/eventhubs/azure-messaging-eventhubs-checkpointstore-blob/src/main/java/com/azure/messaging/eventhubs/checkpointstore/blob/BlobCheckpointStore.java).

Also, add a comment where it's replaced, pointing to [SampleCheckpointStore](https://github.com/Azure/azure-sdk-for-java/blob/main/sdk/eventhubs/azure-messaging-eventhubs/src/samples/java/com/azure/messaging/eventhubs/SampleCheckpointStore.java) if user wants the legacy behavior.

Legacy code:
```java
InMemoryCheckpointManager checkpointManager = new InMemoryCheckpointManager();
InMemoryLeaseManager leaseManager = new InMemoryLeaseManager();
EventProcessorHost host = new EventProcessorHost(
    hostName, eventHubName, consumerGroupName,
    eventHubConnectionString, checkpointManager, leaseManager);
host.registerEventProcessor(MyEventProcessor.class).get();
```

Migrated code — replace with `BlobCheckpointStore` backed by Azure Blob Storage:
```java
BlobContainerAsyncClient blobContainerClient = new BlobContainerClientBuilder()
    .connectionString(storageConnectionString)
    .containerName(storageContainerName)
    .buildAsyncClient();

// BlobCheckpointStore replaces InMemoryCheckpointManager/InMemoryLeaseManager.
// For an in-memory alternative (not recommended for production), see:
// https://github.com/Azure/azure-sdk-for-java/blob/main/sdk/eventhubs/azure-messaging-eventhubs/src/samples/java/com/azure/messaging/eventhubs/SampleCheckpointStore.java
EventProcessorClient eventProcessorClient = new EventProcessorClientBuilder()
    .connectionString(eventHubConnectionString, eventHubName)
    .consumerGroup(consumerGroupName)
    .checkpointStore(new BlobCheckpointStore(blobContainerClient))
    .processEvent(eventContext -> {
        // Process event and checkpoint
        eventContext.updateCheckpoint();
    })
    .processError(errorContext -> {
        System.err.printf("Error in partition %s: %s%n",
            errorContext.getPartitionContext().getPartitionId(),
            errorContext.getThrowable().getMessage());
    })
    .buildEventProcessorClient();

eventProcessorClient.start();
```

> ⚠️ **Warning:** Add dependency `com.azure:azure-messaging-eventhubs-checkpointstore-blob` to the project when using `BlobCheckpointStore`.

### EventProcessorHost with Azure Storage checkpoint/lease

Legacy code using the built-in storage-backed checkpoint/lease:
```java
EventProcessorHost host = EventProcessorHost.EventProcessorHostBuilder
    .newBuilder(hostName, consumerGroupName)
    .useAzureStorageCheckpointLeaseManager(storageConnectionString, storageContainerName, null)
    .useEventHubConnectionString(eventHubConnectionString, eventHubName)
    .build();
host.registerEventProcessor(MyEventProcessor.class).get();
```

Migrated code:
```java
BlobContainerAsyncClient blobContainerClient = new BlobContainerClientBuilder()
    .connectionString(storageConnectionString)
    .containerName(storageContainerName)
    .buildAsyncClient();

EventProcessorClient eventProcessorClient = new EventProcessorClientBuilder()
    .connectionString(eventHubConnectionString, eventHubName)
    .consumerGroup(consumerGroupName)
    .checkpointStore(new BlobCheckpointStore(blobContainerClient))
    .processEvent(eventContext -> {
        // Process event and checkpoint
        eventContext.updateCheckpoint();
    })
    .processError(errorContext -> {
        System.err.printf("Error in partition %s: %s%n",
            errorContext.getPartitionContext().getPartitionId(),
            errorContext.getThrowable().getMessage());
    })
    .buildEventProcessorClient();

eventProcessorClient.start();
```

### Required imports for migrated code

```java
import com.azure.messaging.eventhubs.EventProcessorClient;
import com.azure.messaging.eventhubs.EventProcessorClientBuilder;
import com.azure.messaging.eventhubs.checkpointstore.blob.BlobCheckpointStore;
import com.azure.storage.blob.BlobContainerAsyncClient;
import com.azure.storage.blob.BlobContainerClientBuilder;
```

### Required dependencies

Add these dependencies when migrating from `com.microsoft.azure:azure-eventhubs-eph`:

| Legacy Artifact | Modern Artifact |
|---|---|
| `com.microsoft.azure:azure-eventhubs-eph` | `com.azure:azure-messaging-eventhubs` |
| (included in above) | `com.azure:azure-messaging-eventhubs-checkpointstore-blob` |
