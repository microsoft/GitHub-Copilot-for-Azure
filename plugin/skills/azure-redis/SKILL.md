---
name: azure-redis
description: Implement high-performance caching and real-time data solutions with Azure Cache for Redis for session state, leaderboards, and distributed caching
---

# Azure Data Services

## Services

| Service | Use When | MCP Tools | CLI |
|---------|----------|-----------|-----|
| Cosmos DB | NoSQL documents, global distribution, vector search | `azure__cosmos` | `az cosmosdb` |
| SQL Database | Relational data, ACID transactions, complex joins | `azure__sql` | `az sql` |
| Redis Cache | Caching, sessions, real-time leaderboards | `azure__redis` | `az redis` |
| PostgreSQL | Open source relational, PostGIS | `azure__postgres` | `az postgres` |
| MySQL | LAMP stack, WordPress | `azure__mysql` | `az mysql` |

## MCP Server (Preferred)

When Azure MCP is enabled, use these tools for data operations:

### Cosmos DB
- `azure__cosmos` with command `cosmos_account_list` - List Cosmos DB accounts
- `azure__cosmos` with command `cosmos_database_list` - List databases in account
- `azure__cosmos` with command `cosmos_container_list` - List containers

### SQL Database
- `azure__sql` with command `sql_server_list` - List SQL servers
- `azure__sql` with command `sql_database_list` - List databases on server
- `azure__sql` with command `sql_firewall_list` - List firewall rules

### Redis
- `azure__redis` with command `redis_cache_list` - List Redis caches

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.

## CLI Fallback

```bash
# Cosmos DB
az cosmosdb list --output table
az cosmosdb sql database list --account-name ACCOUNT -g RG

# SQL Database
az sql server list --output table
az sql db list --server SERVER -g RG

# Redis
az redis list --output table
```

## Choosing the Right Database

| If you need... | Use |
|----------------|-----|
| Global distribution, <10ms latency | Cosmos DB |
| Complex SQL queries, ACID transactions | SQL Database |
| Caching layer, session state | Redis Cache |
| PostgreSQL compatibility | Azure PostgreSQL |
| MySQL compatibility | Azure MySQL |

---

# Azure Cache for Redis

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
