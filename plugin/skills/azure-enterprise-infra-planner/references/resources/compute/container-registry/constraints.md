## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **AKS** | AKS needs `acrPull` role assignment on the registry. Use managed identity (attach via `az aks update --attach-acr`). |
| **Container App** | Reference in `configuration.registries[]`. Use managed identity or admin credentials. |
| **ML Workspace** | Referenced as `containerRegistry` property. Used for custom training/inference images. |
| **Private Endpoint** | Premium SKU required. Set `publicNetworkAccess: 'Disabled'`. |
| **Geo-Replication** | Premium SKU required. Configure via child `replications` resource. |
| **CMK** | Premium SKU required. Needs user-assigned identity with Key Vault access. |
