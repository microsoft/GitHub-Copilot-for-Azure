# Function App

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Web/sites` |
| Bicep API Version | `2024-11-01` |
| CAF Prefix | `func` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

Use these exact `kind` values (comma-separated string, order matters):

| Kind | Description |
|------|-------------|
| `functionapp` | Windows Consumption or Dedicated |
| `functionapp,linux` | Linux Consumption or Dedicated |
| `functionapp,workflowapp` | Logic App (Standard) on Functions runtime |
| `functionapp,linux,container` | Linux container function app |
| `functionapp,linux,container,azurecontainerapps` | Function App on Container Apps |

## SKU Names

Function Apps inherit SKU from the parent **App Service Plan** (see [app-service-plan.md](../app-service-plan/app-service-plan.md)). Common hosting plans:

| Plan | Plan SKU | Description |
|------|----------|-------------|
| Consumption | `Y1` | Pay-per-execution, auto-scale, 5-min timeout default |
| Flex Consumption | `FC1` | Consumption with VNet, larger instances |
| Premium (EP) | `EP1`, `EP2`, `EP3` | Always-warm, VNet, no cold start |
| Dedicated | `B1`, `S1`, `P1v3`, etc. | Shared App Service Plan |

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 2 |
| Max Length | 60 |
| Allowed Characters | Alphanumerics and hyphens. Cannot start or end with hyphen. |
| Scope | Global (must be globally unique as DNS name `{name}.azurewebsites.net`) |
| Pattern | `func-{workload}-{env}-{instance}` |
| Example | `func-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.serverFarmId` | App Service Plan ID | Resource ID |
| `properties.siteConfig.linuxFxVersion` | Linux runtime stack | `DOTNET-ISOLATED\|8.0`, `Node\|20`, `Python\|3.11`, `Java\|17` |
| `properties.siteConfig.netFrameworkVersion` | .NET version (Windows) | `v6.0`, `v8.0` |
| `properties.siteConfig.appSettings` | Application settings | Array of name/value pairs |
| `properties.httpsOnly` | HTTPS only | `true`, `false` |
| `properties.virtualNetworkSubnetId` | VNet integration subnet | Resource ID |
| `properties.functionAppConfig.runtime.name` | Runtime name (Flex) | `dotnet-isolated`, `node`, `python`, `java`, `powershell` |
| `properties.functionAppConfig.runtime.version` | Runtime version (Flex) | String (e.g., `8.0`, `20`, `3.11`) |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Config | `Microsoft.Web/sites/config` | Site configuration (appSettings, connectionStrings, etc.) |
| Functions | `Microsoft.Web/sites/functions` | Individual function definitions |
| Slots | `Microsoft.Web/sites/slots` | Deployment slots |
| VNet Connections | `Microsoft.Web/sites/virtualNetworkConnections` | VNet integration |

## References

- [Bicep resource reference (2024-11-01)](https://learn.microsoft.com/azure/templates/microsoft.web/sites?pivots=deployment-language-bicep)
- [Azure Functions overview](https://learn.microsoft.com/azure/azure-functions/functions-overview)
- [Azure naming rules — Web](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftweb)
- [Functions hosting plans](https://learn.microsoft.com/azure/azure-functions/functions-scale)
