## Pairing Constraints

| Paired With | Constraint |
|-------------|------------|
| **Storage Account** | Linked service requires `Storage Blob Data Contributor` role on the storage account for the ADF managed identity. For ADLS Gen2, also requires `Storage Blob Data Reader` at minimum. |
| **Key Vault** | For CMK encryption, Key Vault must have `softDeleteEnabled: true` and `enablePurgeProtection: true`. ADF managed identity needs `Key Vault Crypto Service Encryption User` role or equivalent access policy. |
| **Managed VNet** | When `managedVirtualNetworks` is configured, all outbound connections must use managed private endpoints (`factories/managedVirtualNetworks/managedPrivateEndpoints`). |
| **Private Endpoint** | When `publicNetworkAccess: 'Disabled'`, must create private endpoint to `dataFactory` sub-resource for studio access and pipeline connectivity. |
| **Purview** | Requires Microsoft Purview instance resource ID. ADF managed identity must have `Data Curator` role in Purview. |
| **Integration Runtime** | Self-hosted IR requires network line-of-sight to on-premises sources. Azure IR regional choice affects data residency. |
