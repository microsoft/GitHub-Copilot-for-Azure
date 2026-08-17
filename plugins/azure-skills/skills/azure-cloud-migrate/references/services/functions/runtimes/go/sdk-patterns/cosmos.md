# Cosmos DB — point read & upsert (Azure SDK for Go)

> Shared ground rules (credential setup, client lifetime, URL app settings) → [README.md](./README.md).

```go
import "github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"

var cosmos, _    = azcosmos.NewClient(os.Getenv("COSMOS_ENDPOINT"), cred, nil)
var container, _ = cosmos.NewContainer("mydb", "Items")

// Point read
pk := azcosmos.NewPartitionKeyString("electronics")
resp, err := container.ReadItem(ctx, pk, "sku-42", nil)

// Upsert
raw, _ := json.Marshal(item)
_, err = container.UpsertItem(ctx, pk, raw, nil)
```
