---
name: azure-redis
description: Implement high-performance caching and real-time data solutions with Azure Cache for Redis for session state, leaderboards, and distributed caching
---

# Azure Cache for Redis

## MCP Tools (Preferred)

When Azure MCP is enabled, use these tools for Redis operations:

- `azure__redis` with command `redis_cache_list` - List Redis caches

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.

## CLI Commands (Fallback)

```bash
az redis list --output table
az redis show -n CACHE -g RG
az redis list-keys -n CACHE -g RG
```

## Quick Reference

| Property | Value |
|----------|-------|
| CLI prefix | `az redis` |
| MCP tools | `azure__redis` (command: `redis_cache_list`) |
| Best for | Caching, sessions, real-time data |

## Tiers

| Tier | Features | Use Case |
|------|----------|----------|
| Basic | Single node, no SLA | Dev/test |
| Standard | Replicated, 99.9% SLA | Production |
| Premium | Clustering, VNet, persistence | High scale |
| Enterprise | Redis modules, 99.99% SLA | Enterprise features |

## Caching Patterns

### Cache-Aside (Lazy Loading)

```
1. Check cache first
2. If miss, query database
3. Store result in cache
4. Return data
```

### Write-Through

```
1. Write to cache
2. Cache writes to database
3. Ensures consistency
```

### Write-Behind

```
1. Write to cache
2. Async write to database
3. Better performance, eventual consistency
```

## Common Use Cases

| Use Case | Pattern |
|----------|---------|
| Session state | String/Hash with TTL |
| Page caching | String with cache-aside |
| Rate limiting | INCR with expiry |
| Leaderboards | Sorted sets |
| Pub/sub | Pub/sub channels |
| Distributed locks | SET NX with expiry |

## Best Practices

1. **Set appropriate TTLs** - Avoid stale data
2. **Use connection pooling** - Reuse connections
3. **Enable clustering** for scale-out
4. **Configure eviction policy** (allkeys-lru recommended)
5. **Monitor memory usage** - Avoid evictions

## Common Operations

```bash
# List Redis caches
az redis list --output table

# Get cache details
az redis show -n CACHE -g RG

# Get access keys
az redis list-keys -n CACHE -g RG

# Regenerate keys
az redis regenerate-keys -n CACHE -g RG --key-type Primary
```

## Connection String Format

```
CACHE.redis.cache.windows.net:6380,password=KEY,ssl=True,abortConnect=False
```

## Gotchas

1. **Connection limits** - Pool connections, don't create per-request
2. **Serialization** - Be consistent, consider MessagePack for performance
3. **Key naming** - Use prefixes to avoid collisions
4. **Memory management** - Monitor and configure maxmemory-policy
