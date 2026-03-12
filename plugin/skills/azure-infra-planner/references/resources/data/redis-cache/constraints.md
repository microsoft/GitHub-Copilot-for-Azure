## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **VNet** | Only Premium SKU supports VNet injection via `subnetId`. Basic/Standard use firewall rules only. |
| **VNet + Private Endpoint** | VNet injection and private endpoint are mutually exclusive — cannot use both on the same cache. |
| **Private Endpoint** | Available for Basic, Standard, Premium, and Enterprise tiers. Set `publicNetworkAccess: 'Disabled'` when using private endpoints. Premium with clustering supports max 1 private link; non-clustered supports up to 100. |
| **Clustering** | Only Premium SKU supports `shardCount`. Basic and Standard are single-node/two-node only. |
| **Persistence** | Only Premium SKU supports RDB/AOF persistence. Requires a storage account for RDB exports. |
| **Geo-replication** | Only Premium SKU. Primary and secondary must be Premium with same shard count. Passive geo-replication with private endpoints requires unlinking geo-replication first, adding private link, then re-linking. |
| **Zones** | Zone redundancy requires Premium SKU with multiple replicas. |
| **Tier Scaling** | Cannot scale down tiers (Enterprise → lower, Premium → Standard/Basic, Standard → Basic). Cannot scale between Enterprise and Enterprise Flash, or from Basic/Standard/Premium to Enterprise/Flash — must create a new cache. |
| **Enterprise/Flash** | Firewall rules and `publicNetworkAccess` flag are not available on Enterprise/Enterprise Flash tiers. |
| **Azure Lighthouse** | Azure Lighthouse + VNet injection is not supported. Use private links instead. |
