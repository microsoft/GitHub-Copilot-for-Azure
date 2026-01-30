---
name: azure-postgres
description: Configure Azure Database for PostgreSQL with passwordless Entra ID authentication. Setup developer access, managed identities, and group permissions.
---

# Azure PostgreSQL

Configure passwordless authentication with Microsoft Entra ID for PostgreSQL Flexible Server.

## MCP Tools

- `azure__postgres` with `postgres_server_list`, `postgres_database_list`, `postgres_database_query`, `postgres_server_param_get/set`

## CLI Fallback
```bash
az postgres flexible-server list --output table
az postgres flexible-server db list --server-name SERVER -g RG
```

## Setup Patterns

| Scenario | Guide |
|----------|-------|
| Developer Access | [Pattern 1](./references/ENTRA-RBAC-OVERVIEW.md#pattern-1-developer-user-access) |
| App Auth (Managed Identity) | [Pattern 2](./references/ENTRA-RBAC-OVERVIEW.md#pattern-2-managed-identity-for-applications) |
| Team/Group Access | [Pattern 3](./references/ENTRA-RBAC-OVERVIEW.md#pattern-3-group-based-access-control) |
| Migration from Passwords | [Pattern 5](./references/ENTRA-RBAC-OVERVIEW.md#pattern-5-migration-from-password-auth) |
| Connection Issues | [Troubleshooting](./references/TROUBLESHOOTING.md) |

## Common Issues

| Issue | Solution |
|-------|----------|
| `role does not exist` | Run `pgaadauth_create_principal` |
| `password authentication failed` | Get fresh token: `az account get-access-token --resource-type oss-rdbms` |
| `permission denied` | See [permission templates](./references/PERMISSION-TEMPLATES.md) |

## References

[Entra ID Setup](./references/ENTRA-RBAC-OVERVIEW.md) · [SQL Functions](./references/SQL-FUNCTIONS.md) · [Permissions](./references/PERMISSION-TEMPLATES.md)
