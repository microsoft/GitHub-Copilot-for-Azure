# App Service

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Web/sites` |
| Bicep API Version | `2024-11-01` |
| CAF Prefix | `app` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

The `kind` property is a free-form string. Use these exact values for web apps:

| Kind | Description |
|------|-------------|
| `app` | Windows web app — **default** |
| `app,linux` | Linux web app |
| `app,linux,container` | Linux container web app |
| `app,container,windows` | Windows container web app |

> **Note:** For function apps, see [function-app.md](../function-app/function-app.md). `kind` distinguishes app types sharing the same ARM type.

## SKU Names

App Service inherits SKU from the parent **App Service Plan** (see [app-service-plan.md](../app-service-plan/app-service-plan.md)).

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 2 |
| Max Length | 60 |
| Allowed Characters | Alphanumerics and hyphens. Cannot start or end with hyphen. |
| Scope | Global (must be globally unique as DNS name `{name}.azurewebsites.net`) |
| Pattern | `app-{workload}-{env}-{instance}` |
| Example | `app-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.serverFarmId` | App Service Plan ID | Resource ID |
| `properties.siteConfig.linuxFxVersion` | Linux runtime stack | `DOTNETCORE\|8.0`, `NODE\|20-lts`, `PYTHON\|3.12`, `JAVA\|17-java17` |
| `properties.siteConfig.netFrameworkVersion` | .NET version (Windows) | `v6.0`, `v8.0` |
| `properties.siteConfig.javaVersion` | Java version (Windows) | `17`, `21` |
| `properties.siteConfig.nodeVersion` | Node.js version (Windows) | `~20`, `~22` |
| `properties.httpsOnly` | HTTPS only | `true` (recommended), `false` |
| `properties.virtualNetworkSubnetId` | VNet integration subnet | Resource ID |
| `properties.clientAffinityEnabled` | Session affinity (ARR) | `true`, `false` |
| `properties.siteConfig.alwaysOn` | Always On (prevent idle) | `true`, `false` (not available on Free/Shared) |
| `properties.siteConfig.minTlsVersion` | Minimum TLS | `1.0`, `1.1`, `1.2`, `1.3` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Config | `Microsoft.Web/sites/config` | Site configuration |
| Slots | `Microsoft.Web/sites/slots` | Deployment slots |
| VNet Connections | `Microsoft.Web/sites/virtualNetworkConnections` | VNet integration |
| Hybrid Connections | `Microsoft.Web/sites/hybridConnectionNamespaces/relays` | Hybrid connections |

## References

- [Bicep resource reference (2024-11-01)](https://learn.microsoft.com/azure/templates/microsoft.web/sites?pivots=deployment-language-bicep)
- [App Service overview](https://learn.microsoft.com/azure/app-service/overview)
- [Azure naming rules — Web](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftweb)
- [App Service plans](https://learn.microsoft.com/azure/app-service/overview-hosting-plans)
