# Cosmos DB with Node.js / TypeScript

Packages: `@azure/cosmos`, `@azure/identity`.

```typescript
const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_CLIENT_ID,
});
const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT!,
  aadCredentials: credential,
});
const container = client
  .database(process.env.COSMOS_DATABASE!)
  .container("items");
```

Create one client per process and reuse it.
