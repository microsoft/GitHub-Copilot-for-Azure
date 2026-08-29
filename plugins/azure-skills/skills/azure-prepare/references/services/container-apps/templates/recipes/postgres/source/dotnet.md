# PostgreSQL with C#

Packages: `Npgsql`, `Azure.Identity`, `Azure.Core`.

```csharp
var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions {
    ManagedIdentityClientId = Environment.GetEnvironmentVariable("AZURE_CLIENT_ID")
});
var token = await credential.GetTokenAsync(
    new TokenRequestContext(["https://ossrdbms-aad.database.windows.net/.default"]));
var cs = new NpgsqlConnectionStringBuilder {
    Host = Environment.GetEnvironmentVariable("PGHOST"),
    Database = Environment.GetEnvironmentVariable("PGDATABASE"),
    Username = Environment.GetEnvironmentVariable("PGUSER"),
    Password = token.Token,
    SslMode = SslMode.Require,
};
```

Use Npgsql's periodic password provider for pooled, long-running connections.
