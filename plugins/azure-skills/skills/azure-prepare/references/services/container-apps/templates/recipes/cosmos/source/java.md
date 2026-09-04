# Cosmos DB with Java

Packages: `com.azure:azure-cosmos`, `com.azure:azure-identity`.

```java
TokenCredential credential = new DefaultAzureCredentialBuilder()
    .managedIdentityClientId(System.getenv("AZURE_CLIENT_ID"))
    .build();
CosmosClient client = new CosmosClientBuilder()
    .endpoint(System.getenv("COSMOS_ENDPOINT"))
    .credential(credential)
    .buildClient();
CosmosContainer container = client
    .getDatabase(System.getenv("COSMOS_DATABASE"))
    .getContainer("items");
```

Create the client as an application singleton and close it during shutdown.
