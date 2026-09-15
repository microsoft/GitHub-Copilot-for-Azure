# Cosmos DB with C#

Packages: `Microsoft.Azure.Cosmos`, `Azure.Identity`.

```csharp
var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions {
    ManagedIdentityClientId = Environment.GetEnvironmentVariable("AZURE_CLIENT_ID")
});
var client = new CosmosClient(Environment.GetEnvironmentVariable("COSMOS_ENDPOINT"), credential);
var container = client
    .GetDatabase(Environment.GetEnvironmentVariable("COSMOS_DATABASE"))
    .GetContainer("items");
```

Register `CosmosClient` as a singleton and reuse it for connection pooling.

**Source:** [Azure identity with Cosmos DB](https://learn.microsoft.com/azure/cosmos-db/nosql/how-to-connect-role-based-access-control)
