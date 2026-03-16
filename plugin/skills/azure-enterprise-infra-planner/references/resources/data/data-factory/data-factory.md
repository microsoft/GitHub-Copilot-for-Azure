# Azure Data Factory

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.DataFactory/factories` |
| Bicep API Version | `2018-06-01` |
| CAF Prefix | `adf` |

## Region Availability

**Category:** Mainstream — available in all recommended regions within 90 days of GA. Demand-driven in alternate regions.

## Subtypes (kind)

Does not use `kind`. Azure Data Factory has no `kind` property — there is only one factory type.

## SKU Names

Does not use `sku`. Azure Data Factory does not have SKU tiers — pricing is based on pipeline activity runs, data movement, and integration runtime hours.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 3 |
| Max Length | 63 |
| Allowed Characters | Alphanumerics and hyphens. Must start and end with alphanumeric. Every dash must be preceded and followed by a letter or number. No consecutive dashes. |
| Pattern (ARM) | `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$` |
| Scope | Global (unique across all of Azure, case-insensitive) |
| Pattern (CAF) | `adf-{workload}-{env}-{region}-{instance}` |
| Example | `adf-etl-prod-eastus2-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

See [properties.md](properties.md) for the complete list of key properties.

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Change Data Capture | `Microsoft.DataFactory/factories/adfcdcs` | CDC configurations |
| Credentials | `Microsoft.DataFactory/factories/credentials` | Managed identity credentials |
| Data Flows | `Microsoft.DataFactory/factories/dataflows` | Mapping data flows |
| Datasets | `Microsoft.DataFactory/factories/datasets` | Dataset definitions |
| Global Parameters | `Microsoft.DataFactory/factories/globalParameters` | Factory-scoped parameters |
| Integration Runtimes | `Microsoft.DataFactory/factories/integrationRuntimes` | Azure, self-hosted, or SSIS runtimes |
| Linked Services | `Microsoft.DataFactory/factories/linkedservices` | Connection definitions |
| Managed VNets | `Microsoft.DataFactory/factories/managedVirtualNetworks` | Managed virtual networks |
| Managed Private Endpoints | `Microsoft.DataFactory/factories/managedVirtualNetworks/managedPrivateEndpoints` | Private endpoints within managed VNet |
| Pipelines | `Microsoft.DataFactory/factories/pipelines` | Data pipeline definitions |
| Private Endpoint Connections | `Microsoft.DataFactory/factories/privateEndpointConnections` | Inbound private endpoint connections |
| Triggers | `Microsoft.DataFactory/factories/triggers` | Schedule/event triggers |

## References

- [Bicep resource reference (2018-06-01)](https://learn.microsoft.com/azure/templates/microsoft.datafactory/factories?pivots=deployment-language-bicep)
- [Azure Data Factory overview](https://learn.microsoft.com/azure/data-factory/introduction)
- [Azure naming rules — DataFactory](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftdatafactory)
- [ADF naming rules](https://learn.microsoft.com/azure/data-factory/naming-rules)
- [All DataFactory resource types](https://learn.microsoft.com/azure/templates/microsoft.datafactory/allversions)
