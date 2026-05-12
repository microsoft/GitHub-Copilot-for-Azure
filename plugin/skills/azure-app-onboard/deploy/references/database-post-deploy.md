# Database Post-Deploy Verification

Run schema migrations on AppOnboard-created databases (listed in `prepare-plan.json.services[]`) before health checks. The app must be running first — if it's crashing, fix that before attempting migrations.

**Discover the migration command** from the codebase (check in order):

| Signal | Command | Working directory |
|--------|---------|-------------------|
| `alembic.ini` exists | `alembic upgrade head` | Directory containing `alembic.ini` |
| Django `manage.py` exists | `python manage.py migrate` | Directory containing `manage.py` |
| `prisma/schema.prisma` exists | `npx prisma migrate deploy` | Project root |
| EF `Migrations/` directory | `dotnet ef database update` | Project root |
| Rails `db/migrate/` directory | `rails db:migrate` | Project root |
| Sequelize `migrations/` + `.sequelizerc` | `npx sequelize-cli db:migrate` | Project root |

## Execute via the Deployed Environment

### App Service (Linux only)

```powershell
az webapp ssh -n {app} -g {rg} --subscription {sub}
# Then run the migration command interactively
```

### Container Apps

```powershell
az containerapp exec -n {ca} -g {rg} --subscription {sub} --command "{migration_command}"

# If the app's WORKDIR differs from migration tool location:
az containerapp exec -n {ca} -g {rg} --subscription {sub} --command "cd /app/backend && alembic upgrade head"
```

## Error Handling

If the migration command fails, classify as `IAC_ERROR` and check based on the database type:
- DB unreachable → check firewall rules (PostgreSQL: `AllowAllAzureServicesAndResourcesWithinAzureIps`, SQL: server firewall, MySQL: similar)
- Extension/feature missing → check DB-specific config (PostgreSQL: `azure.extensions`, SQL: compatibility level, MySQL: `require_secure_transport`)
- Module not found → verify the runtime includes the migration tool

> ⛔ **`{pass}` MUST be the same password passed to `az deployment sub create --parameters pgAdminPassword={value}`.** See deploy SKILL.md § "Generate secrets ONCE — reuse everywhere." Mismatched passwords cause silent auth failures on migrations and connectivity checks.

## PostgreSQL-Specific Checks

Run BEFORE migrations when `services[]` includes PostgreSQL Flexible Server:

1. **Firewall connectivity:** `az postgres flexible-server execute -n {pg} -g {rg} -u {admin} -p {pass} -d postgres --querytext "SELECT 1"` — if this fails, the firewall rule is missing or RBAC propagation hasn't completed. Check `AllowAllAzureServicesAndResourcesWithinAzureIps` exists, wait 60s, retry
2. **Extension availability:** `az postgres flexible-server parameter show -g {rg} -n {pg} --name azure.extensions --query value -o tsv` — verify the extensions the app needs (e.g., `uuid-ossp` for Alembic/Django UUID fields) are in the allow-list. If missing, the Bicep module should have set them — check `infra/modules/postgresql.bicep`
