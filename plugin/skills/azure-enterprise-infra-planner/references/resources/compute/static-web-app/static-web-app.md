# Static Web App

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Web/staticSites` |
| Bicep API Version | `2024-11-01` |
| CAF Prefix | `stapp` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

Static Web App does not use `kind` in standard deployments.

## SKU Names

| SKU Name | SKU Tier | Description |
|----------|----------|-------------|
| `Free` | `Free` | Free tier — hobby/personal projects, 2 custom domains, 500 MB total storage (250 MB per environment) |
| `Standard` | `Standard` | Standard tier — production workloads, 5 custom domains, 2 GB storage, SLA, private endpoints |

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 40 |
| Allowed Characters | Alphanumerics, hyphens. Cannot start or end with hyphen. |
| Scope | Resource group |
| Pattern | `stapp-{workload}-{env}-{instance}` |
| Example | `stapp-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `sku.name` | Pricing tier | `Free`, `Standard` |
| `sku.tier` | Tier (matches name) | `Free`, `Standard` |
| `properties.repositoryUrl` | Source repo URL | GitHub or Azure DevOps URL |
| `properties.branch` | Deployment branch | String (e.g., `main`) |
| `properties.repositoryToken` | Repo access token | String (secure — GitHub PAT) |
| `properties.buildProperties.appLocation` | App source path | String (e.g., `/`, `src/app`) |
| `properties.buildProperties.apiLocation` | API source path | String (e.g., `api`) |
| `properties.buildProperties.outputLocation` | Build output path | String (e.g., `dist`, `build`) |
| `properties.provider` | CI/CD provider | `GitHub`, `DevOps`, `Custom` |
| `properties.stagingEnvironmentPolicy` | Staging env policy | `Enabled`, `Disabled` |
| `properties.allowConfigFileUpdates` | Config file updates | `true`, `false` |
| `properties.enterpriseGradeCdnStatus` | Enterprise CDN | `Enabled`, `Disabled` |

### Read-Only Properties

| Property | Description |
|----------|-------------|
| `properties.defaultHostname` | Default hostname (e.g., `{name}.azurestaticapps.net`) |
| `properties.customDomains` | Configured custom domains |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Custom Domains | `Microsoft.Web/staticSites/customDomains` | Custom domain bindings |
| Config | `Microsoft.Web/staticSites/config` | App settings, function app settings |
| Linked Backends | `Microsoft.Web/staticSites/linkedBackends` | External API backend connections |
| Database Connections | `Microsoft.Web/staticSites/databaseConnections` | Database connection strings |
| User Provided Functions | `Microsoft.Web/staticSites/userProvidedFunctionApps` | Bring-your-own Function App |

## References

- [Bicep resource reference (2024-11-01)](https://learn.microsoft.com/azure/templates/microsoft.web/staticsites?pivots=deployment-language-bicep)
- [Static Web Apps overview](https://learn.microsoft.com/azure/static-web-apps/overview)
- [Azure naming rules — Web](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftweb)
- [Static Web Apps hosting plans](https://learn.microsoft.com/azure/static-web-apps/plans)
