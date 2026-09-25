# PostgreSQL with Node.js / TypeScript

Packages: `pg`, `@azure/identity`.

```typescript
const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_CLIENT_ID,
});
const token = await credential.getToken(
  "https://ossrdbms-aad.database.windows.net/.default",
);
const client = new Client({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: token.token,
  ssl: { rejectUnauthorized: true },
});
```

Refresh credentials when the pool creates connections after token expiry.
