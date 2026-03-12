## Pairing Constraints

| Paired With | Constraint |
|-------------|------------|
| **Storage Account** | Must be linked via `properties.storageAccount`. Cannot change after creation. Use `StorageV2` kind with standard SKU. |
| **Key Vault** | Must be linked via `properties.keyVault`. Cannot change after creation. Requires soft-delete enabled. |
| **Application Insights** | Linked via `properties.applicationInsights`. Should use workspace-based App Insights (backed by Log Analytics). |
| **Container Registry** | Optional but recommended for custom environments. Linked via `properties.containerRegistry`. |
| **Hub workspace (kind=Project)** | Must set `properties.hubResourceId` to the parent Hub's ARM resource ID. The Project inherits the Hub's linked resources. |
| **VNet Integration** | When `managedNetwork.isolationMode` is `AllowOnlyApprovedOutbound`, must configure outbound rules for all dependent services. |
