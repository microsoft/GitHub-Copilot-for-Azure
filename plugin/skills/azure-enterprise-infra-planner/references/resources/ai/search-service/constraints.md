## Pairing Constraints

| Paired With | Constraint |
|-------------|------------|
| **Cognitive Services (AI Enrichment)** | For AI enrichment pipelines (skillsets), attach a Cognitive Services account. Must be `kind: 'CognitiveServices'` or `kind: 'AIServices'` and in the same region as the search service. |
| **Storage Account (Indexers)** | Indexer data sources support Blob, Table, and File storage. Storage must be accessible (same VNet or public). For managed identity access, assign `Storage Blob Data Reader` role. |
| **Cosmos DB (Indexers)** | Indexer data source for Cosmos DB. Requires connection string or managed identity with `Cosmos DB Account Reader Role`. |
| **SQL Database (Indexers)** | Indexer data source. Requires change tracking enabled on the source table. |
| **Private Endpoints** | When `publicNetworkAccess: 'Disabled'`, create shared private link resources for outbound connections to data sources. |
| **Managed Identity** | Assign system or user-assigned identity for secure connections to data sources. Use RBAC instead of connection strings. |
| **Semantic Search** | Requires `semanticSearch` property set to `free` or `standard`. Available on `basic` and above SKUs. |
