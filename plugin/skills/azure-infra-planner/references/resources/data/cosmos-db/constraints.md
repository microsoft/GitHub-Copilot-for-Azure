## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Multi-region writes** | `consistencyPolicy.defaultConsistencyLevel` cannot be `Strong` when `enableMultipleWriteLocations: true`. |
| **Strong consistency** | Strong consistency with regions >5000 miles apart is blocked by default (requires support ticket to enable). Strong and Bounded Staleness reads cost 2× RU/s compared to Session/Consistent Prefix/Eventual. |
| **Serverless** | Cannot combine `EnableServerless` capability with multi-region writes or analytical store. Serverless is single-region only — cannot add regions. No shared throughput databases. Cannot provision throughput (auto-managed; settings return error). Merge partitions not available for serverless accounts. |
| **Free tier** | Only one free-tier account per subscription. Cannot combine with multi-region writes. |
| **VNet** | Set `isVirtualNetworkFilterEnabled: true` and configure `virtualNetworkRules[]` with subnet IDs. Subnets need `Microsoft.AzureCosmosDB` service endpoint. |
| **Private Endpoint** | Set `publicNetworkAccess: 'Disabled'` when using private endpoints exclusively. One Private DNS Zone record per DNS name — multiple private endpoints in different regions need separate Private DNS Zones. |
| **Key Vault (CMK)** | Requires `keyVaultKeyUri` in encryption config. Key Vault must be in same region. |
| **Merge Partitions** | Not available for serverless or multi-region write accounts. Single-region provisioned throughput only. |
