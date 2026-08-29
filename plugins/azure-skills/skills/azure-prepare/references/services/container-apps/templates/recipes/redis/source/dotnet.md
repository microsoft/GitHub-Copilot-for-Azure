# Redis with C#

Packages: `StackExchange.Redis`, `Azure.Identity`.

Acquire `https://redis.azure.com/.default` with `DefaultAzureCredential`. Configure TLS,
use the UAMI object ID from `REDIS_USER_OID` as the Redis username, and use the access token
as the password. Re-authenticate before the token expires.

```csharp
var token = await credential.GetTokenAsync(
    new TokenRequestContext(["https://redis.azure.com/.default"]));
var options = ConfigurationOptions.Parse($"{host}:6380,ssl=true");
options.User = Environment.GetEnvironmentVariable("REDIS_USER_OID");
options.Password = token.Token;
var redis = await ConnectionMultiplexer.ConnectAsync(options);
```
