# com.microsoft.azure.eventprocessorhost

## Code Samples

### EventProcessorHost

Modern EventProcessorClient doesn't provide implementation of `InMemoryCheckpointManager` or `InMemoryLeaseManager`, due to production issues.
If they are used in legacy code, you should replace their usage to [BlobCheckpointStore](https://github.com/Azure/azure-sdk-for-java/blob/main/sdk/eventhubs/azure-messaging-eventhubs-checkpointstore-blob/src/main/java/com/azure/messaging/eventhubs/checkpointstore/blob/BlobCheckpointStore.java).

Also, add a comment where it's replaced, pointing to [SampleCheckpointStore](https://github.com/Azure/azure-sdk-for-java/blob/main/sdk/eventhubs/azure-messaging-eventhubs/src/samples/java/com/azure/messaging/eventhubs/SampleCheckpointStore.java) if user wants the legacy behavior.
