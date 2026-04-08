# Azure Cache for Redis Recipe — REFERENCE ONLY

Adds Azure Cache for Redis integration to an App Service base template.

## Overview

This recipe composes with a Web API or Web App base template to add distributed caching with Azure Cache for Redis. Uses managed identity for passwordless access.

## Integration Type

| Aspect | Value |
|--------|-------|
| **Service** | Azure Cache for Redis |
| **Auth** | Managed identity (Entra ID access policy) |
| **SKU** | Basic C0 (dev) / Standard C1+ (production) |
| **Protocol** | Redis 6.0+ with TLS |
| **Local Auth** | Disabled — Entra ID only |

## Composition Steps

Apply these steps AFTER `azd init -t <base-template>`:

| # | Step | Details |
|---|------|---------|
| 1 | **Add IaC module** | Add Redis Bicep module to `infra/app/` |
| 2 | **Wire into main** | Add module reference in `main.bicep` |
| 3 | **Add app settings** | Add Redis host name + port settings |
| 4 | **Add source code** | Add cache client setup from examples below |
| 5 | **Add packages** | Add Redis client packages |

## App Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `REDIS_HOST` | `{name}.redis.cache.windows.net` | Redis host name |
| `REDIS_PORT` | `6380` | TLS port |

### Bicep App Settings Block

```bicep
appSettings: [
  { name: 'REDIS_HOST', value: redis.outputs.hostName }
  { name: 'REDIS_PORT', value: '6380' }
]
```

> **Note:** With managed identity, no access key is needed. The Redis client uses `DefaultAzureCredential` to obtain a token.

## RBAC Roles Required

| Role | GUID | Scope | Purpose |
|------|------|-------|---------|
| **Redis Cache Contributor** | `e0f68234-74aa-48ed-b826-c38b57376e17` | Redis cache | Manage cache |

> For data plane access with Entra ID, configure the Redis access policy to grant the managed identity `Data Owner` or `Data Contributor` access.

## Resources Created

| Resource | Type | Purpose |
|----------|------|---------|
| Redis Cache | `Microsoft.Cache/redis` | Distributed cache |
| Access Policy | `Microsoft.Cache/redis/accessPolicyAssignments` | MI data access |
| Private Endpoint | `Microsoft.Network/privateEndpoints` | VNet-only access (conditional) |

## Source Code Examples

### C# (ASP.NET Core)

```csharp
// NuGet: Microsoft.Extensions.Caching.StackExchangeRedis, Azure.Identity

using Azure.Identity;
using StackExchange.Redis;

var redisHost = builder.Configuration["REDIS_HOST"];
var configOptions = ConfigurationOptions.Parse($"{redisHost}:6380");
configOptions.Ssl = true;
configOptions.AbortOnConnectFail = false;

await configOptions.ConfigureForAzureWithTokenCredentialAsync(
    new DefaultAzureCredential());

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.ConfigurationOptions = configOptions;
    options.InstanceName = "app:";
});
```

### Python (FastAPI)

```python
# pip: redis, azure-identity

import os
import redis
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
token = credential.get_token("https://redis.azure.com/.default")

cache = redis.StrictRedis(
    host=os.environ["REDIS_HOST"],
    port=int(os.environ.get("REDIS_PORT", 6380)),
    ssl=True,
    password=token.token,
    decode_responses=True,
)
```

### Node.js

```javascript
// npm: ioredis, @azure/identity

const Redis = require("ioredis");
const { DefaultAzureCredential } = require("@azure/identity");

async function createRedisClient() {
  const credential = new DefaultAzureCredential();
  const token = await credential.getToken("https://redis.azure.com/.default");

  return new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6380"),
    tls: { servername: process.env.REDIS_HOST },
    password: token.token,
  });
}
```

## Networking (when VNET_ENABLED=true)

| Component | Details |
|-----------|---------|
| **Private endpoint** | Redis → App Service VNet subnet |
| **Private DNS zone** | `privatelink.redis.cache.windows.net` |

## References

- [Azure Cache for Redis overview](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-overview)
- [Use Entra ID with Redis](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-azure-active-directory-for-authentication)
- [Redis + App Service tutorial](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-web-app-howto)
