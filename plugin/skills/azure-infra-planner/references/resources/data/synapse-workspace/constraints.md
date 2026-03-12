## Pairing Constraints

| Paired With | Constraint |
|-------------|------------|
| **ADLS Gen2 Storage Account** | **Required.** Storage account must have `isHnsEnabled: true` (hierarchical namespace / Data Lake Storage Gen2) and `kind: 'StorageV2'`. Synapse managed identity needs `Storage Blob Data Contributor` role on the storage account. |
| **Key Vault** | For CMK encryption, Key Vault must have `softDeleteEnabled: true` and `enablePurgeProtection: true`. Synapse managed identity needs `Get`, `Unwrap Key`, and `Wrap Key` permissions. |
| **Managed VNet** | When `managedVirtualNetwork: 'default'`, all outbound connections require managed private endpoints. Set at creation time — cannot be changed after. |
| **Private Endpoint** | When `publicNetworkAccess: 'Disabled'`, create private endpoints for sub-resources: `Dev` (Studio), `Sql` (dedicated SQL), `SqlOnDemand` (serverless SQL). |
| **Purview** | Requires Microsoft Purview resource ID. Synapse managed identity needs appropriate Purview roles. |
| **VNet (compute subnet)** | `virtualNetworkProfile.computeSubnetId` must reference an existing subnet. The subnet must be delegated to `Microsoft.Synapse/workspaces` if required by the deployment model. |
