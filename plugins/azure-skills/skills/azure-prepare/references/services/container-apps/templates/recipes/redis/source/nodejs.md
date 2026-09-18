# Redis with Node.js / TypeScript

Packages: `redis`, `@azure/identity`.

```typescript
const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_CLIENT_ID,
});
const token = await credential.getToken("https://redis.azure.com/.default");
const client = createClient({
  url: `rediss://${process.env.REDIS_HOSTNAME}:${process.env.REDIS_PORT ?? "6380"}`,
  username: process.env.REDIS_USER_OID,
  password: token.token,
});
await client.connect();
```

Reconnect with a fresh token before expiry.
