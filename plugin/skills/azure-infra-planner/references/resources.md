# Resource Reference Index

Quick-lookup table mapping Azure resource types to their reference files. Each resource lives in a subdirectory containing the main file plus `bicep.md`, `constraints.md`, and optional `skus.md`/`properties.md`.

## Resource Categories (48 resources)

| Category | Count | Index |
|----------|-------|-------|
| Compute | 12 | [resources/compute/index.md](resources/compute/index.md) |
| Data | 9 | [resources/data/index.md](resources/data/index.md) |
| Networking | 17 | [resources/networking/index.md](resources/networking/index.md) |
| Messaging | 3 | [resources/messaging/index.md](resources/messaging/index.md) |
| Monitoring | 2 | [resources/monitoring/index.md](resources/monitoring/index.md) |
| AI & ML | 3 | [resources/ai/index.md](resources/ai/index.md) |
| Security | 2 | [resources/security/index.md](resources/security/index.md) |

## Region Categories

Categories from [Available services by region types and categories](https://learn.microsoft.com/azure/reliability/availability-service-by-category):

| Category | Region Availability |
|----------|---------------------|
| **Foundational** | Available in all recommended and alternate regions — no verification needed |
| **Mainstream** | Available in all recommended regions; demand-driven in alternate regions — verify if targeting alternate region |
| **Strategic** | Demand-driven across regions — always verify before planning |

> Only Mainstream and Strategic resources require region verification. Fetch via `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Usage

During Phase 2 (Plan Generation), for each resource being added to the plan:

1. Identify the resource category and load its category index (e.g., `resources/compute/index.md`)
2. Find the resource in the category table and load its main `.md` file
3. Use the file's **Identity** section for ARM type and API version
4. Use **Subtypes** and **SKU Names** to select valid `kind` and `sku` values
5. Use **Naming** to generate a compliant name
6. Load `bicep.md` from the same subdirectory for the Bicep template skeleton
7. Load `constraints.md` from the same subdirectory to validate against already-planned resources
8. Run verification checks from [verification.md](verification.md)

## Globally-Unique Names

These resources require globally unique names (DNS-based):

| Resource | DNS Pattern |
|----------|-------------|
| Storage Account | `{name}.blob.core.windows.net` |
| Key Vault | `{name}.vault.azure.net` |
| Cosmos DB | `{name}.documents.azure.com` |
| SQL Server | `{name}.database.windows.net` |
| Function App | `{name}.azurewebsites.net` |
| App Service | `{name}.azurewebsites.net` |
| Redis Cache | `{name}.redis.cache.windows.net` |
| Service Bus | `{name}.servicebus.windows.net` |
| Event Hub | `{name}.servicebus.windows.net` |
| Data Factory | `{name}.adf.azure.com` |
| Synapse Workspace | `{name}.dev.azuresynapse.net` |
| Container Registry | `{name}.azurecr.io` |
| AI Search | `{name}.search.windows.net` |
| API Management | `{name}.azure-api.net` |
| PostgreSQL Flexible Server | `{name}.postgres.database.azure.com` |
| MySQL Flexible Server | `{name}.mysql.database.azure.com` |

## Shared ARM Types

Some resource types share the same ARM type and are distinguished by `kind`:

| ARM Type | `kind` Value | Resource |
|----------|--------------|----------|
| `Microsoft.Web/sites` | `app` / `app,linux` | App Service |
| `Microsoft.Web/sites` | `functionapp` / `functionapp,linux` | Function App |
| `Microsoft.MachineLearningServices/workspaces` | _(omitted)_ / `Default` | ML Workspace |
| `Microsoft.MachineLearningServices/workspaces` | `Hub` | AI Foundry Hub |
| `Microsoft.MachineLearningServices/workspaces` | `Project` | AI Foundry Project |
| `Microsoft.MachineLearningServices/workspaces` | `FeatureStore` | Feature Store |
