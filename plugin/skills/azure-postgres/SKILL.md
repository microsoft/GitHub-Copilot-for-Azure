---
name: azure-postgres
description: Work with Azure Database for PostgreSQL Flexible Server - create, configure, manage, and connect to PostgreSQL databases with passwordless authentication using Microsoft Entra ID
---

# Azure Database for PostgreSQL

Comprehensive guidance for working with Azure Database for PostgreSQL Flexible Server, including database operations, Entra ID authentication setup, and best practices.

---

## MCP Tools (Preferred)

When Azure MCP is enabled, use these tools for PostgreSQL operations:

- `azure__postgres` with command `postgres_server_list` - List PostgreSQL servers
- `azure__postgres` with command `postgres_database_list` - List databases on a server
- `azure__postgres` with command `postgres_database_query` - Execute SQL queries
- `azure__postgres` with command `postgres_server_param_get` - Get server parameters
- `azure__postgres` with command `postgres_server_param_set` - Set server parameters

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.

## CLI Commands

```bash
az postgres flexible-server list --output table
az postgres flexible-server db list --server-name SERVER -g RG
az postgres flexible-server show --name SERVER -g RG
```

---

## Quick Reference

| Property | Value |
|----------|-------|
| CLI prefix | `az postgres flexible-server` |
| MCP tools | `azure__postgres` |
| Best for | Relational data, PostgreSQL compatibility, PostGIS |
| Engine versions | PostgreSQL 11, 12, 13, 14, 15, 16 |

---

## Common Use Cases

### 1. Basic Database Operations

**List servers:**
```bash
az postgres flexible-server list --output table
```

**Create database:**
```bash
az postgres flexible-server db create \
  --server-name SERVER \
  --resource-group RG \
  --database-name mydb
```

**Execute queries (via MCP):**
```javascript
await azure__postgres({
  command: "postgres_database_query",
  parameters: {
    server: "myserver",
    database: "mydb",
    query: "SELECT * FROM users LIMIT 10"
  }
});
```

---

### 2. Microsoft Entra ID Authentication Setup

**For passwordless authentication using Azure identities, see:**

**[Microsoft Entra ID RBAC Setup Guide →](references/rbac-setup/OVERVIEW.md)**

This comprehensive guide covers:
- Setting up Entra ID authentication for developers
- Configuring managed identity access for applications
- Group-based access control
- Troubleshooting authentication issues
- Migration from password-based authentication

**Quick setup patterns:**
- [Developer User Access](./references/rbac-setup/OVERVIEW.md#pattern-1-developer-user-access)
- [Managed Identity for Apps](./references/rbac-setup/OVERVIEW.md#pattern-2-managed-identity-for-applications)
- [Group-Based Access](./references/rbac-setup/OVERVIEW.md#pattern-3-group-based-access-control)
- [Troubleshooting](./references/rbac-setup/TROUBLESHOOTING.md)

---

### 3. Connection Strings

**Password-based:**
```
postgresql://username:password@server.postgres.database.azure.com:5432/database?sslmode=require
```

**Entra ID (passwordless):**
```bash
# Get access token
TOKEN=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)

# Connect with psql
psql "host=server.postgres.database.azure.com port=5432 dbname=mydb user=user@domain.com sslmode=require password=$TOKEN"
```

---

## Compute Tiers

| Tier | vCores | Memory | Use Case |
|------|--------|--------|----------|
| Burstable | 1-20 | 0.5-4 GB/vCore | Dev/test, low traffic |
| General Purpose | 2-64 | 4 GB/vCore | Most production workloads |
| Memory Optimized | 2-64 | 8 GB/vCore | High-memory workloads |

---

## High Availability

| Feature | Description | RPO/RTO |
|---------|-------------|---------|
| Zone-redundant HA | Standby replica in different AZ | RPO: 0, RTO: 60-120s |
| Geo-replication | Read replicas in other regions | Async replication |
| Point-in-time restore | Restore to any point in retention | Up to 35 days |

**Enable HA:**
```bash
az postgres flexible-server update \
  --name SERVER -g RG \
  --high-availability Enabled \
  --standby-availability-zone 2
```

---

## Performance Optimization

### Query Performance Insights

Enable Query Store for performance analysis:
```bash
az postgres flexible-server parameter set \
  --server-name SERVER -g RG \
  --name pg_qs.query_capture_mode \
  --value TOP
```

### Indexing Best Practices

```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_user_email ON users(email);

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

### Connection Pooling

Use PgBouncer for connection pooling:
```bash
az postgres flexible-server parameter set \
  --server-name SERVER -g RG \
  --name pgbouncer.enabled \
  --value true
```

---

## Extensions

Popular PostgreSQL extensions supported:

| Extension | Use Case |
|-----------|----------|
| `postgis` | Geospatial data |
| `pg_stat_statements` | Query performance monitoring |
| `pgcrypto` | Cryptographic functions |
| `uuid-ossp` | UUID generation |
| `hstore` | Key-value storage |

**Enable extension:**
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

## Security Best Practices

1. ✅ **Use Entra ID authentication** - See [RBAC Setup Guide](references/rbac-setup/OVERVIEW.md)
2. ✅ **Enable SSL/TLS** - Always use `sslmode=require`
3. ✅ **Private endpoints** - Restrict network access
4. ✅ **Firewall rules** - Limit IP allowlist
5. ✅ **Audit logging** - Enable `pgaudit` extension
6. ✅ **Encryption at rest** - Enabled by default with customer-managed keys optional

---

## Backup and Restore

**Automated backups:** Retained for 7-35 days (configurable)

**Point-in-time restore:**
```bash
az postgres flexible-server restore \
  --name NEW-SERVER \
  --resource-group RG \
  --source-server SOURCE-SERVER \
  --restore-time "2024-01-15T10:30:00Z"
```

**Geo-restore:**
```bash
az postgres flexible-server geo-restore \
  --name NEW-SERVER \
  --resource-group RG \
  --source-server SOURCE-SERVER \
  --location westus2
```

---

## Migration from Other Databases

### From PostgreSQL on-premises

**Option 1: pg_dump/pg_restore**
```bash
# Export
pg_dump -h localhost -U postgres -d mydb -f mydb.sql

# Import
psql -h server.postgres.database.azure.com -U admin -d mydb -f mydb.sql
```

**Option 2: Azure Database Migration Service**
- Supports minimal-downtime migrations
- Handles schema and data migration
- Built-in validation

### From MySQL/SQL Server

Consider using:
- Azure Data Migration Assistant
- Manual schema conversion
- ETL tools for data transformation

---

## Monitoring

### Key Metrics to Track

```bash
az monitor metrics list \
  --resource /subscriptions/.../resourceGroups/RG/providers/Microsoft.DBforPostgreSQL/flexibleServers/SERVER \
  --metric "cpu_percent,memory_percent,io_consumption_percent"
```

| Metric | Alert Threshold |
|--------|-----------------|
| CPU usage | > 80% |
| Memory usage | > 85% |
| Storage usage | > 85% |
| Connection count | > 80% of max |
| Failed connections | > 10/min |

---

## Troubleshooting

### Connection Issues

1. **Check firewall rules:**
```bash
az postgres flexible-server firewall-rule list --name SERVER -g RG
```

2. **Verify server status:**
```bash
az postgres flexible-server show --name SERVER -g RG --query state
```

3. **Test connectivity:**
```bash
psql "host=server.postgres.database.azure.com port=5432 dbname=postgres user=admin sslmode=require"
```

### Performance Issues

1. Check slow queries:
```sql
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

2. Check locks:
```sql
SELECT * FROM pg_locks WHERE NOT granted;
```

### Authentication Issues

**For Entra ID authentication issues, see:**
[Troubleshooting Guide](references/rbac-setup/TROUBLESHOOTING.md)

---

## Cost Optimization

1. **Right-size compute** - Start with Burstable tier for dev/test
2. **Use reserved capacity** - Save up to 65% with 1-3 year commitment
3. **Stop/start servers** - Stop non-production servers when not in use
4. **Optimize storage** - Start small, autoscale as needed
5. **Connection pooling** - Reduce connection overhead

---

## References

- [Microsoft Entra ID RBAC Setup](references/rbac-setup/OVERVIEW.md) - Complete passwordless authentication guide
- [SQL Functions](references/rbac-setup/SQL-FUNCTIONS.md) - Entra ID role management functions
- [Permission Templates](references/rbac-setup/PERMISSION-TEMPLATES.md) - Common permission patterns
- [Troubleshooting](references/rbac-setup/TROUBLESHOOTING.md) - Connection and auth issues
