# Cosmos DB with Go

Packages: `github.com/Azure/azure-sdk-for-go/sdk/azidentity` and
`github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos`.

```go
credential, err := azidentity.NewDefaultAzureCredential(nil)
if err != nil { return err }
client, err := azcosmos.NewClient(os.Getenv("COSMOS_ENDPOINT"), credential, nil)
if err != nil { return err }
container, err := client.NewContainer(os.Getenv("COSMOS_DATABASE"), "items")
```

Reuse the client and container for the process lifetime.
