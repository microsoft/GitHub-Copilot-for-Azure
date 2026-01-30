# PostgreSQL Permission Templates

SQL templates for Entra ID authentication permission scenarios.

## Read-Only Access

```sql
GRANT CONNECT ON DATABASE <database> TO "<role-name>";
GRANT USAGE ON SCHEMA public TO "<role-name>";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO "<role-name>";
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO "<role-name>";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "<role-name>";
```

## Read-Write Access

```sql
GRANT CONNECT ON DATABASE <database> TO "<role-name>";
GRANT USAGE ON SCHEMA public TO "<role-name>";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "<role-name>";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "<role-name>";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "<role-name>";
```

## Full Admin Access

```sql
GRANT ALL PRIVILEGES ON DATABASE <database> TO "<role-name>";
GRANT ALL PRIVILEGES ON SCHEMA public TO "<role-name>";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "<role-name>";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "<role-name>";

-- Add to azure_pg_admin role (Azure PostgreSQL admin group)
GRANT azure_pg_admin TO "<role-name>";
```

---

### Application-Specific Access

For applications that need access to specific tables only.

```sql
-- Connect permission
GRANT CONNECT ON DATABASE <database> TO "<role-name>";
GRANT USAGE ON SCHEMA public TO "<role-name>";

-- Specific tables only
GRANT SELECT, INSERT, UPDATE ON <table1> TO "<role-name>";
GRANT SELECT, INSERT, UPDATE, DELETE ON <table2> TO "<role-name>";
GRANT SELECT ON <readonly_table> TO "<role-name>";

-- Specific sequences
GRANT USAGE, SELECT ON <table1>_id_seq TO "<role-name>";
GRANT USAGE, SELECT ON <table2>_id_seq TO "<role-name>";
```

---

### Schema-Specific Access

## Schema-Specific Access

```sql
GRANT CONNECT ON DATABASE <database> TO "<role-name>";
GRANT USAGE ON SCHEMA <schema-name> TO "<role-name>";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA <schema-name> TO "<role-name>";
ALTER DEFAULT PRIVILEGES IN SCHEMA <schema-name> GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "<role-name>";
```

## Quick Examples

```sql
-- User read-only
GRANT CONNECT ON DATABASE mydb TO "developer@company.com";
GRANT USAGE ON SCHEMA public TO "developer@company.com";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO "developer@company.com";

-- Managed identity read-write
GRANT CONNECT ON DATABASE mydb TO "my-app-identity";
GRANT USAGE ON SCHEMA public TO "my-app-identity";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "my-app-identity";
```

## Revoking Permissions

```sql
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "<role-name>";
REVOKE USAGE ON SCHEMA public FROM "<role-name>";
REVOKE CONNECT ON DATABASE <database> FROM "<role-name>";
DROP ROLE "<role-name>";
```

## Checking Permissions

```sql
\du  -- List all roles
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = '<role>';
SELECT * FROM pgaadauth_list_principals(false);  -- Entra-mapped roles
```