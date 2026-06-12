# DCR Design Decision Guide

Quick scenario-to-approach mapping for common DCR configurations.

| Scenario | Approach |
|----------|----------|
| Simple KQL transform on ingestion | Use `transformKql` in dataFlows (single-stage, no `transformations` section needed) |
| Client-side filtering/parsing | Use `transformations` section with appropriate header + processors, reference from dataSource `transform` |
| Client-side + ingestion-side | Use `transformations` for both, reference from dataSource and dataFlow respectively |
| Same logs to multiple tables | Multiple dataFlows consuming the same stream with different filters and `outputStream` (split); or identical routing to multiple tables (copy) |
| Aggregation | Route aggregated data to a custom table (schema changes entirely) |
| Mix old and new style | Allowed; some dataFlows can use `transformKql`, others can use `transform` |
| Send custom data from app/script | Use direct ingestion DCR (`kind: "Direct"`, no `dataSources`). See [direct ingestion](./direct-ingestion.md) |
| API ingestion with schema mapping | Direct DCR with `transformKql` to map incoming JSON to destination table schema |
| API ingestion to standard table | Direct DCR with `outputStream: "Microsoft-{Table}"` and appropriate transform |
