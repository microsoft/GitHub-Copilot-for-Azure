# Redis with Java

Packages: `com.azure:azure-identity`, `io.lettuce:lettuce-core`.

Acquire `https://redis.azure.com/.default` with `DefaultAzureCredential`. Configure a
`RedisURI` with SSL, the UAMI object ID as username, and the token as password:

```java
AccessToken token = credential.getToken(
    new TokenRequestContext().addScopes("https://redis.azure.com/.default")).block();
RedisURI uri = RedisURI.Builder.redis(System.getenv("REDIS_HOSTNAME"), 6380)
    .withSsl(true)
    .withAuthentication(System.getenv("REDIS_USER_OID"), token.getToken())
    .build();
```

Refresh the connection before token expiry.
