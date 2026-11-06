# Table — read & upsert (Azure SDK for Go)

> Shared ground rules (credential setup, client lifetime, URL app settings) → [README.md](./README.md).

```go
import "github.com/Azure/azure-sdk-for-go/sdk/data/aztables"

var tables, _    = aztables.NewServiceClient(os.Getenv("STORAGE_TABLE_URI"), cred, nil)
var products     = tables.NewClient("Products")

// Read one entity
resp, err := products.GetEntity(ctx, "electronics", "sku-42", nil)
var p Product
_ = json.Unmarshal(resp.Value, &p)

// Upsert
raw, _ := json.Marshal(p)
_, err = products.UpsertEntity(ctx, raw, nil)
```
