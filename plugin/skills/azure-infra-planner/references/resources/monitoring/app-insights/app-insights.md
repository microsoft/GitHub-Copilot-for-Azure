# Application Insights

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.Insights/components` |
| Bicep API Version | `2020-02-02` |
| CAF Prefix | `appi` |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

`kind` is a **required** free-form string. Typical values:

| Kind | Description |
|------|-------------|
| `web` | Web application — **most common** |
| `ios` | iOS application |
| `java` | Java application |
| `phone` | Phone application |
| `store` | Store application |
| `other` | Other application type |

> **Note:** `kind` is required but does not affect functionality significantly — it influences default dashboards in the portal.

## SKU Names

Application Insights does not use a `sku` block. Pricing is determined by the linked Log Analytics workspace.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 1 |
| Max Length | 260 |
| Allowed Characters | Any characters that are not: `%&\?/` or control characters |
| Scope | Resource group |
| Pattern | `appi-{workload}-{env}-{instance}` |
| Example | `appi-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `kind` | Application kind | `web`, `ios`, `java`, `phone`, `store`, `other` |
| `properties.Application_Type` | Application type | `web`, `other` |
| `properties.WorkspaceResourceId` | Log Analytics workspace ID | Resource ID (required for workspace-based) |
| `properties.RetentionInDays` | Data retention | `30`, `60`, `90`, `120`, `180`, `270`, `365`, `550`, `730` |
| `properties.IngestionMode` | Ingestion mode | `ApplicationInsights` (classic), `ApplicationInsightsWithDiagnosticSettings`, `LogAnalytics` |
| `properties.publicNetworkAccessForIngestion` | Public ingestion | `Disabled`, `Enabled` |
| `properties.publicNetworkAccessForQuery` | Public query | `Disabled`, `Enabled` |
| `properties.DisableIpMasking` | Show client IPs | `true`, `false` (default: `false`) |
| `properties.SamplingPercentage` | Sampling rate | `0` to `100` (default: `100`) |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

Application Insights does not have significant Bicep child resources.

## References

- [Bicep resource reference (2020-02-02)](https://learn.microsoft.com/azure/templates/microsoft.insights/components?pivots=deployment-language-bicep)
- [Application Insights overview](https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- [Azure naming rules — Insights](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftinsights)
- [Workspace-based App Insights](https://learn.microsoft.com/azure/azure-monitor/app/convert-classic-resource)
