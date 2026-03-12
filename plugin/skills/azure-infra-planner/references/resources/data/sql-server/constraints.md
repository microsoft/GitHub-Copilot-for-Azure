## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **SQL Database** | Databases are child resources — must reference this server as parent. |
| **Key Vault (TDE)** | Key Vault must have `enablePurgeProtection: true`. Must be in same Azure AD tenant. Server needs GET, WRAP KEY, UNWRAP KEY permissions on key. TDE protector setup fails if Key Vault soft-delete and purge-protection are not both enabled. |
| **Virtual Network** | Use `Microsoft.Sql/servers/virtualNetworkRules` to restrict access to specific subnets. Subnets need `Microsoft.Sql` service endpoint. |
| **Private Endpoint** | Set `publicNetworkAccess: 'Disabled'` when using private endpoints exclusively. |
| **Elastic Pool** | Databases using elastic pools reference `elasticPoolId` — server must host both pool and databases. Hyperscale elastic pools cannot be created from non-Hyperscale pools. |
| **Failover Group** | Both primary and secondary servers must exist. Databases to be replicated must belong to the primary server. Failover group from zone-redundant to non-zone-redundant Hyperscale elastic pool fails silently (geo-secondary shows "Seeding 0%"). |
