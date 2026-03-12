# Machine Learning Workspace

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.MachineLearningServices/workspaces` |
| Bicep API Version | `2025-06-01` |
| CAF Prefix | `mlw` (Default workspace), `hub` (Foundry Hub), `proj` (Foundry Project) |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions.

## Subtypes (kind)

The `kind` property is typed as `string` in the schema (not a strict enum). Known values from CAF and Microsoft Learn:

| Kind | Description | CAF Prefix |
|------|-------------|------------|
| *(omitted / Default)* | Standard ML workspace | `mlw` |
| `Hub` | Azure AI Foundry hub — central governance, shared resources | `hub` |
| `Project` | Azure AI Foundry project — child of a Hub, scoped work area | `proj` |
| `FeatureStore` | Feature store workspace for ML feature management | `mlw` |

> **Note:** When `kind` is `Project`, you **must** set `properties.hubResourceId` to the parent Hub's ARM resource ID.

## SKU Names

See [skus.md](skus.md) for the complete list of SKU names and tiers.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 3 |
| Max Length | 33 |
| Allowed Characters | Alphanumerics, hyphens, underscores |
| Pattern (regex) | `^[a-zA-Z0-9][a-zA-Z0-9_-]{2,32}$` |
| Scope | Resource group |
| Example | `mlw-datascience-prod-001` |

> Must start with an alphanumeric character. Hyphens and underscores allowed after the first character.

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

See [properties.md](properties.md) for the complete list of key properties.

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Computes | `Microsoft.MachineLearningServices/workspaces/computes` | Compute targets (clusters, instances) |
| Connections | `Microsoft.MachineLearningServices/workspaces/connections` | Service connections (Azure OpenAI, etc.) |
| Datastores | `Microsoft.MachineLearningServices/workspaces/datastores` | Data source references |
| Endpoints | `Microsoft.MachineLearningServices/workspaces/endpoints` | Inference endpoints |
| Online Endpoints | `Microsoft.MachineLearningServices/workspaces/onlineEndpoints` | Real-time inference endpoints |
| Batch Endpoints | `Microsoft.MachineLearningServices/workspaces/batchEndpoints` | Batch inference endpoints |
| Serverless Endpoints | `Microsoft.MachineLearningServices/workspaces/serverlessEndpoints` | Serverless model endpoints |
| Outbound Rules | `Microsoft.MachineLearningServices/workspaces/outboundRules` | Managed network rules |
| Schedules | `Microsoft.MachineLearningServices/workspaces/schedules` | Pipeline/job schedules |
| Private Endpoint Connections | `Microsoft.MachineLearningServices/workspaces/privateEndpointConnections` | Private networking |

## References

- [Bicep resource reference (2025-06-01)](https://learn.microsoft.com/azure/templates/microsoft.machinelearningservices/workspaces?pivots=deployment-language-bicep)
- [All API versions](https://learn.microsoft.com/azure/templates/microsoft.machinelearningservices/allversions)
- [Azure naming rules — ML Services](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftmachinelearningservices)
- [CAF abbreviations](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations)
