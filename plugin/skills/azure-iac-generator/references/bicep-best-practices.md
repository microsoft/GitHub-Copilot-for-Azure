# Bicep Best Practices

Mandatory rules for all Bicep generation. Before generating any Bicep, also call the Bicep MCP server's `get_bicep_best_practices` tool for the latest guidance.

---

## Rules

| # | Rule | Detail |
|---|------|--------|
| 1 | No `name` on module statements | Omit the `name` field on `module` blocks; Bicep generates it automatically |
| 2 | User-defined types over open types | Avoid `array`, unless it is an array of strings, or `object` params; define typed structures |
| 3 | `.bicepparam` files | Always generate `.bicepparam`, never JSON parameter files |
| 4 | `parent` property for child resources | Never build child names with `/`; use `parent:` with a symbolic ref |
| 5 | `existing` resource for parent lookups | If parent is not in the same file, add an `existing` resource block |
| 6 | Symbolic references | Use `foo.id` / `foo.properties.x`, not `resourceId()` or `reference()` |
| 7 | `@secure()` on sensitive params | Always decorate passwords, keys, connection strings |
| 8 | `@description()` on params and types | Describe every parameter; describe type properties where context is unclear |
| 9 | Resource-derived types | Prefer `resourceInput<>` / `resourceOutput<>` over hand-written types |
| 10 | Minimal comments | Only add comments beyond what `@description()` says. No `// ====` banners. Do use comments for complicated operations or ternaries |
| 11 | Safe-dereference | Use `.?` and `??` for null handling, not ternaries or `!.` |

## Bicepparam Comment Guidelines

Keep comments to 1-3 lines per parameter. Cover:
- What the setting controls (plain language)
- 2-3 common alternatives with cost/capacity impact
- Security consequences where applicable

```bicep
// VM size — CPU, memory, cost.
//   Standard_B2s → 2 vCPU, 4 GB (~$30/mo) — dev/test
//   Standard_D4s_v5 → 4 vCPU, 16 GB (~$140/mo) — production
param vmSize = 'Standard_B2s'
```

## API Version Rule

Use the latest **stable** (non-preview) API version for each resource type. Call `get_az_resource_type_schema` to verify when uncertain.

## Bicepparam File Pattern

The `.bicepparam` file must include ALL parameter values with descriptive comments. Use `readEnvironmentVariable()` for secrets — never hardcode them.

```bicep
using 'main.bicep'

// Azure region. Options: eastus, westeurope, westus2
param location = 'eastus'

// VM size — cost, CPU, memory.
//   Standard_B2s    → 2 vCPU, 4 GB  (~$30/mo) — dev/test
//   Standard_D2s_v3 → 2 vCPU, 8 GB  (~$70/mo) — general
param vmSize = 'Standard_B2s'

// SQL admin password — reads from env var at deploy time.
param sqlAdminPassword = readEnvironmentVariable('SQLPASSWORD')
```

## Private Endpoint groupIds by Target

| Target Resource | groupIds |
|---|---|
| App Service | `['sites']` |
| Storage (Blob) | `['blob']` |
| Storage (File) | `['file']` |
| SQL Server | `['sqlServer']` |
| Cosmos DB | `['Sql']` |
| Key Vault | `['vault']` |
| Redis | `['redisCache']` |
