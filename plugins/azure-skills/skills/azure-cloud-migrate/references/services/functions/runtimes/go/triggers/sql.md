# SQL Trigger — Go (Change Tracking)

> Enable Change Tracking on the DB and table first
> (`ALTER DATABASE ... SET CHANGE_TRACKING = ON;` then
> `ALTER TABLE dbo.Products ENABLE CHANGE_TRACKING;`).

```go
type Product struct {
    ProductID int    `json:"ProductId"`
    Name      string `json:"Name"`
    Cost      int    `json:"Cost"`
}

func onSQL(ctx context.Context, changes []bindings.SQLChange) error {
    for _, c := range changes {
        var p Product
        if err := json.Unmarshal(c.Item, &p); err != nil { continue }
        _ = c.Operation // Insert | Update | Delete
    }
    return nil
}

app.SQL("productsChanged", onSQL,
    sdk.WithTable("dbo.Products"),
    sdk.WithConnection("AzureWebJobsSqlConnectionString"),
)
```
