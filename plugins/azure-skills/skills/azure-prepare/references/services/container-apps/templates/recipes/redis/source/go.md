# Redis with Go

Packages: `github.com/Azure/azure-sdk-for-go/sdk/azidentity` and
`github.com/redis/go-redis/v9`.

```go
credential, err := azidentity.NewDefaultAzureCredential(nil)
if err != nil { return err }
token, err := credential.GetToken(ctx,
    policy.TokenRequestOptions{Scopes: []string{"https://redis.azure.com/.default"}})
if err != nil { return err }
client := redis.NewClient(&redis.Options{
    Addr: os.Getenv("REDIS_HOSTNAME") + ":" + os.Getenv("REDIS_PORT"),
    Username: os.Getenv("REDIS_USER_OID"), Password: token.Token,
    TLSConfig: &tls.Config{MinVersion: tls.VersionTLS12},
})
```

Refresh the connection before token expiry.
