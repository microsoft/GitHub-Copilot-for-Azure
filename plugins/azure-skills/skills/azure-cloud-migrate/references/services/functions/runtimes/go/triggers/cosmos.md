# Cosmos DB Trigger — Go (Change Feed)

```go
func onChanges(ctx context.Context, docs []bindings.CosmosDocument) error {
    for _, d := range docs {
        _ = d.ID
        _ = d.Data // json.RawMessage — unmarshal into your struct
    }
    return nil
}

app.CosmosDB("docs", onChanges,
    sdk.WithDatabase("ToDoList"),
    sdk.WithContainer("Items"),
    sdk.WithConnection("CosmosDBConnection"),
    sdk.WithCreateLeaseContainerIfNotExists(true),
)
```
