---
name: azure-sql-database
description: Build enterprise applications with Azure SQL Database, a fully managed relational database with built-in intelligence, ACID transactions, and high availability
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

# Azure SQL Database

## Quick Reference

| Property | Value |
|----------|-------|
| CLI prefix | `az sql` |
| MCP tools | `azure__sql` (commands: `sql_server_list`, `sql_database_list`, `sql_firewall_list`) |
| Best for | Relational data, ACID transactions, T-SQL |

## Service Tiers

| Tier | Use Case | vCores | Storage |
|------|----------|--------|---------|
| Basic | Dev/test | Shared | 2 GB |
| Standard | Small production | Shared | 250 GB |
| Premium | High IOPS | Dedicated | 4 TB |
| Hyperscale | Large databases | Dedicated | 100 TB |
| Serverless | Variable workloads | Auto-scale | 4 TB |

## DTU vs vCore

**DTU model:** Bundled compute/storage/IO - simpler pricing
**vCore model:** Separate compute/storage - more control

Use vCore for:
- Existing SQL Server licenses (Azure Hybrid Benefit)
- Fine-grained resource control
- Reserved capacity pricing

## High Availability

| Option | SLA | Use Case |
|--------|-----|----------|
| Zone redundant | 99.995% | Regional HA |
| Geo-replication | RPO <5s | Disaster recovery |
| Auto-failover groups | Automatic | Multi-region HA |

## Security Best Practices

1. Enable Azure AD authentication (avoid SQL auth)
2. Use private endpoints
3. Enable TDE (Transparent Data Encryption) - default on
4. Configure auditing to Log Analytics
5. Use Always Encrypted for sensitive columns
6. Enable Advanced Threat Protection

## Performance Optimization

1. **Automatic tuning** - Let Azure optimize indexes
2. **Query performance insights** - Identify slow queries
3. **Elastic pools** - Share resources across databases
4. **Read replicas** - Offload read workloads

## Common Operations

```bash
# List servers
az sql server list --output table

# List databases
az sql db list --server SERVER -g RG --output table

# Check firewall rules
az sql server firewall-rule list --server SERVER -g RG --output table

# Create firewall rule
az sql server firewall-rule create \
  --server SERVER -g RG \
  --name AllowMyIP \
  --start-ip-address IP --end-ip-address IP
```

## Migration from SQL Server

1. **Assessment** - Use Data Migration Assistant
2. **Schema migration** - Generate scripts or use tools
3. **Data migration** - DMS, bacpac, or replication
4. **Cutover** - Switch connection strings
5. **Validation** - Verify data integrity
