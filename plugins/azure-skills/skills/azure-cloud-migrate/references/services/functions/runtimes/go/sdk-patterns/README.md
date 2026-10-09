# SDK Patterns for I/O — Ground Rules

The Go worker is triggers-only by design; non-HTTP output uses the Azure SDK for Go directly. All samples in this directory share the credential and client-lifetime rules below.

**Ground rules:**

- Use `DefaultAzureCredential`. On UAMI apps, always pass `ManagedIdentityClientID: os.Getenv("AZURE_CLIENT_ID")` — otherwise it tries SystemAssigned first and fails. See [global-rules.md](../../../global-rules.md).
- **Construct clients once at package init or in `main`**, not per invocation. The worker hosts many concurrent invocations on one process; per-invocation client construction defeats connection pooling and triggers repeated token acquisition.
- Point every service at its URL via an app setting (e.g., `STORAGE_BLOB_URI=https://myacct.blob.core.windows.net`) — never embed keys.

```go
import (
    "os"
    "github.com/Azure/azure-sdk-for-go/sdk/azidentity"
)

var cred = mustCred()

func mustCred() *azidentity.DefaultAzureCredential {
    c, err := azidentity.NewDefaultAzureCredential(&azidentity.DefaultAzureCredentialOptions{
        ManagedIdentityClientID: os.Getenv("AZURE_CLIENT_ID"),
    })
    if err != nil { panic(err) }
    return c
}
```

The `cred` variable above is shared by every SDK sample in this directory.

## Samples

| Service | Operations | Sample |
| --- | --- | --- |
| Blob | read & write | [blob.md](./blob.md) |
| Queue | send | [queue.md](./queue.md) |
| Table | read & upsert | [table.md](./table.md) |
| Cosmos DB | point read & upsert | [cosmos.md](./cosmos.md) |
| Service Bus | send | [service-bus.md](./service-bus.md) |
| Event Hubs | send batch | [event-hubs.md](./event-hubs.md) |
| Event Grid | publish | [event-grid.md](./event-grid.md) |
