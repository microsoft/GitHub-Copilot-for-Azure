## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **SQL Server** | Must be deployed as child of the parent SQL Server. Location must match. |
| **Elastic Pool** | `elasticPoolId` must reference a pool on the same server. Cannot set `sku` when using elastic pool (it inherits pool SKU). |
| **Zone Redundancy** | Only available in `GeneralPurpose`, `BusinessCritical`, and `Hyperscale` tiers. Not available in DTU tiers. General Purpose zone redundancy is only available in selected regions. Hyperscale zone redundancy can only be set at creation — cannot modify after provisioning; must recreate via copy/restore/geo-replica. |
| **Serverless** | Only available in `GeneralPurpose` tier. SKU name uses `GP_S_Gen5_*` pattern. |
| **Hyperscale** | Reverse migration from Hyperscale to General Purpose is supported within 45 days of the original migration. Databases originally created as Hyperscale cannot reverse migrate. |
| **Hyperscale Elastic Pool** | Cannot be created from a non-Hyperscale pool. Cannot be converted to non-Hyperscale (one-way only). Named replicas cannot be added to Hyperscale elastic pools (`UnsupportedReplicationOperation`). Zone-redundant Hyperscale elastic pools require databases with ZRS/GZRS backup storage — cannot add LRS-backed databases. |
| **Failover Group** | Failover group from zone-redundant to non-zone-redundant Hyperscale elastic pool fails silently (geo-secondary shows "Seeding 0%"). |
| **Backup Redundancy** | `GeoZone` only available in select regions. `Local` not available in all regions. |
