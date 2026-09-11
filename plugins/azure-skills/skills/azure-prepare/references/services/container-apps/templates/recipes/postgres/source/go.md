# PostgreSQL with Go

Packages: `github.com/Azure/azure-sdk-for-go/sdk/azidentity`,
`github.com/jackc/pgx/v5`, and `github.com/jackc/pgx/v5/pgxpool`.

```go
credential, err := azidentity.NewDefaultAzureCredential(nil)
if err != nil { return err }
token, err := credential.GetToken(ctx, policy.TokenRequestOptions{
    Scopes: []string{"https://ossrdbms-aad.database.windows.net/.default"},
})
if err != nil { return err }
config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
if err != nil { return err }
config.ConnConfig.Password = token.Token
pool, err := pgxpool.NewWithConfig(ctx, config)
```

Set `sslmode=require` in `DATABASE_URL` and refresh pools before token expiry.
