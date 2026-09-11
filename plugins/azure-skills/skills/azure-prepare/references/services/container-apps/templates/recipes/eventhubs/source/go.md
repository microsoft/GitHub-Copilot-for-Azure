# Event Hubs with Go

Packages: `github.com/Azure/azure-sdk-for-go/sdk/azidentity` and
`github.com/Azure/azure-sdk-for-go/sdk/messaging/azeventhubs/v2`,
`github.com/Azure/azure-sdk-for-go/sdk/messaging/azeventhubs/v2/checkpoints`, and
`github.com/Azure/azure-sdk-for-go/sdk/storage/azblob`.

```go
credential, err := azidentity.NewDefaultAzureCredential(nil)
if err != nil { return err }
blobClient, err := azblob.NewClient(
    os.Getenv("CHECKPOINT_STORAGE_URL"), credential, nil)
if err != nil { return err }
store, err := checkpoints.NewBlobStore(
    blobClient.ServiceClient().NewContainerClient("checkpoints"), nil)
if err != nil { return err }
consumer, err := azeventhubs.NewConsumerClient(
    os.Getenv("EVENTHUB_FQDN"),
    os.Getenv("EVENTHUB_NAME"),
    os.Getenv("EVENTHUB_CONSUMER_GROUP"),
    credential, nil)
if err != nil { return err }
defer consumer.Close(ctx)

processor, err := azeventhubs.NewProcessor(consumer, store, nil)
if err != nil { return err }
go func() {
    if err := processor.Run(ctx); err != nil {
        log.Printf("Event Hubs processor stopped: %v", err)
    }
}()
for {
    partition := processor.NextPartitionClient(ctx)
    if partition == nil { break }
    go consumePartition(ctx, partition)
}
```

In `consumePartition`, defer `partition.Close`, receive batches with `ReceiveEvents`, process
them, then call `UpdateCheckpoint` with the last successfully handled event.
