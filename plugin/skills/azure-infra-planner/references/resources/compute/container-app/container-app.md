# Container App

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.App/containerApps` |
| Bicep API Version | `2025-01-01` |
| CAF Prefix | `ca` |

## Region Availability

**Category:** Strategic — demand-driven availability across regions; verify before planning.

> Verify at plan time: `microsoft_docs_fetch` → `https://learn.microsoft.com/azure/reliability/availability-service-by-category`

## Subtypes (kind)

| Kind | Description |
|------|-------------|
| *(omitted)* | Standard container app — **default** |
| `functionapp` | Function App on Container Apps environment |
| `workflowapp` | Logic App (Standard) on Container Apps environment |

## SKU Names

Container Apps do not use a `sku` block. Billing is based on the Container Apps **Environment** workload profile.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 2 |
| Max Length | 32 |
| Allowed Characters | Lowercase letters, numbers, and hyphens. Must start with letter, end with alphanumeric. |
| Scope | Resource group |
| Pattern | `ca-{workload}-{env}-{instance}` |
| Example | `ca-datapipeline-prod-001` |

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.environmentId` | Container Apps Environment | Resource ID of `Microsoft.App/managedEnvironments` |
| `properties.template.containers[].image` | Container image | Registry/image:tag string |
| `properties.template.containers[].resources.cpu` | CPU cores | Decimal (e.g., `0.25`, `0.5`, `1`, `2`, `4`) |
| `properties.template.containers[].resources.memory` | Memory | String (e.g., `0.5Gi`, `1Gi`, `2Gi`, `4Gi`) |
| `properties.template.scale.minReplicas` | Min replicas | Integer (default: `0`) |
| `properties.template.scale.maxReplicas` | Max replicas | Integer (default: `10`) |
| `properties.configuration.ingress.external` | External ingress | `true`, `false` |
| `properties.configuration.ingress.targetPort` | Target port | Integer |
| `properties.configuration.ingress.transport` | Transport protocol | `auto`, `http`, `http2`, `tcp` |
| `properties.configuration.registries[].server` | Container registry | Registry FQDN |
| `properties.configuration.secrets[].name` | Secret name | String |
| `properties.configuration.activeRevisionsMode` | Revision mode | `Multiple`, `Single` |

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

Container Apps do not have significant Bicep child resources — configuration is inline.

### Related Resources (not children but required)

| Resource | ARM Type | Purpose |
|----------|----------|---------|
| Container Apps Environment | `Microsoft.App/managedEnvironments` | Hosting environment (required) |
| Environment Storage | `Microsoft.App/managedEnvironments/storages` | Persistent storage mounts |
| Dapr Components | `Microsoft.App/managedEnvironments/daprComponents` | Dapr integration |

## References

- [Bicep resource reference (2025-01-01)](https://learn.microsoft.com/azure/templates/microsoft.app/containerapps?pivots=deployment-language-bicep)
- [Container Apps overview](https://learn.microsoft.com/azure/container-apps/overview)
- [Azure naming rules — App](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftapp)
- [Container Apps environments](https://learn.microsoft.com/azure/container-apps/environment)
