# Blob Storage Trigger — Go (extension trigger)

```go
import (
    "context"
    "github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
    "github.com/azure/azure-functions-golang-worker/sdk"
    _ "github.com/azure/azure-functions-golang-worker/triggers/blob" // registers factory
    "github.com/azure/azure-functions-golang-worker/worker"
)

func onBlob(ctx context.Context, client *blob.Client) error {
    get, err := client.DownloadStream(ctx, nil)
    if err != nil { return err }
    defer get.Body.Close()
    // stream get.Body — supports GB-scale blobs without buffering through gRPC
    return nil
}

func main() {
    app := sdk.FunctionApp()
    app.Blob("processBlob", onBlob,
        sdk.WithPath("samples-workitems/{name}"),
        sdk.WithConnection("AzureWebJobsStorage"),
        sdk.WithSource("EventGrid"),
    )
    worker.Start(app)
}
```

> **`sdk.WithSource("EventGrid")` needs Flex Consumption infrastructure setup.** When the blob trigger uses EventGrid source on Flex Consumption (the only plan Go supports today), three additional IaC settings are required or events will not be delivered: `alwaysReady: [{ name: 'blob', instanceCount: 1 }]`, the `AzureWebJobsStorage__queueServiceUri` app setting, and an Event Grid subscription authored in Bicep/ARM rather than via the `az` CLI. Full Bicep + RBAC checklist: [lambda-to-functions.md — Flex Consumption + Blob Trigger with EventGrid Source](../../../lambda-to-functions.md#flex-consumption--blob-trigger-with-eventgrid-source).
