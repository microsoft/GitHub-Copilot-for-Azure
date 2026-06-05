---
name: azure-data-collection-rules
description: "Author, edit, validate, and deploy Azure Monitor Data Collection Rules (DCRs), Log Analytics workspace tables, and KQL ingestion-time transformations. Covers single-stage and multi-stage transformation DCRs, client-side and ingestion-side processors, stream declarations, and custom table creation. Also covers direct ingestion DCRs for the Log Ingestion API. WHEN: create DCR, edit DCR, data collection rule, DCR JSON, add transformation, KQL transform, custom table, stream declaration, multi-stage transformation, processor, client-side transform, ingestion-time transform, parse JSON logs, filter syslog, aggregate events, custom log table, DCR schema, DCR authoring, rename columns, drop columns, CEF parsing, XML parsing, data collection, Log Ingestion API, direct ingestion, send custom logs, custom log ingestion, logs ingestion endpoint, DCR endpoint."
argument-hint: "Describe the data source type, desired transformations, and destination table"
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# DCR Authoring Skill

Author, validate, and deploy Azure Monitor Data Collection Rules with single-stage, multi-stage, or direct ingestion configurations.

## Procedure

Follow the [full procedure](./references/procedure.md):

1. **Gather requirements** — ingestion method, data source, intent, destination, split/copy needs
2. **Determine DCR kind** — per [DCR kinds guide](./references/dcr-kinds.md)
3. **Design transformation pipeline** — native filters, processors, or `transformKql`
4. **Author the DCR** — per [DCR schema](./references/dcr-schema.md) and [routing rules](./references/destination-routing.md)
5. **Validate** — run [validate-dcr.ps1](./scripts/validate-dcr.ps1)
6. **Deploy** — run [put-dcr.ps1](./scripts/put-dcr.ps1), prepare tables via [create-custom-table.ps1](./scripts/create-custom-table.ps1)
7. **Verify** — query destination table, check `_LogOperation` for errors

## References

- [Procedure](./references/procedure.md) — full step-by-step workflow
- [DCR kinds](./references/dcr-kinds.md) — kind selection, data source types, transformation sections
- [DCR schema](./references/dcr-schema.md) — top-level structure, column constraints, dataFlows, transformations, REST API
- [Stream declarations](./references/stream-declarations.md) — custom stream schemas (Direct + logFiles only)
- [Processors: headers](./references/processors-headers.md) — header processor types, stage availability, output columns
- [Processors: operations](./references/processors-operations.md) — filter, map, parse, aggregate, enrich, KQL syntax
- [Processor heuristics: filters](./references/processor-heuristics-filters.md) — native filter check, filtering intent map
- [Processor heuristics: transforms](./references/processor-heuristics-transforms.md) — parsing, schema, aggregation, enrichment, routing intent maps
- [Processor heuristics: staging](./references/processor-heuristics-staging.md) — stage placement, cost optimization, multi-processor chains
- [Destination routing](./references/destination-routing.md) — stream-to-table mapping
- [Supported tables](./references/supported-tables.md) — standard tables accepting custom streams
- [KQL transforms](./references/kql-transforms.md) — common KQL patterns
- [LA tables](./references/la-tables.md) — table creation, plans
- [Direct ingestion](./references/direct-ingestion.md) — Log Ingestion API DCRs
- [Decision guide](./references/decision-guide.md) — scenario routing table
- [Limits](./references/limits.md) — DCR structure limits, column constraints, API quotas
