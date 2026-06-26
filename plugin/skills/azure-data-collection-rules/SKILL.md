---
name: azure-data-collection-rules
description: "Author, edit, validate, and deploy Azure Monitor Data Collection Rules (DCRs), Log Analytics workspace tables, and KQL ingestion-time transformations. Covers single-stage and multi-stage transformation DCRs, client-side and ingestion-side processors, stream declarations, and custom table creation. Also covers direct ingestion DCRs for the Log Ingestion API. WHEN: create DCR, edit DCR, data collection rule, DCR JSON, add transformation, KQL transform, custom table, stream declaration, multi-stage transformation, processor, client-side transform, ingestion-time transform, parse JSON logs, filter syslog, aggregate events, custom log table, DCR schema, DCR authoring, rename columns, drop columns, CEF parsing, XML parsing, data collection, Log Ingestion API, direct ingestion, send custom logs, custom log ingestion, logs ingestion endpoint, DCR endpoint."
argument-hint: "Describe the data source type, desired transformations, and destination table"
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Data Collection Rules Skill

Author, validate, and deploy Azure Monitor Data Collection Rules with single-stage, multi-stage, or direct ingestion configurations.

## Quick Reference

| Property | Value |
|----------|-------|
| Skill name | `azure-data-collection-rules` |
| Scope | DCR authoring, validation, deployment, and Log Ingestion API |
| API version | `2025-05-11` (multi-stage), `2023-03-11` (single-stage) |
| Supported kinds | `Direct`, `Linux`, `Windows`, `WorkspaceTransforms` |
| Scripts | PowerShell (`.ps1`) and Bash (`.sh`) |

## When to Use This Skill

- User wants to **create a new DCR** (agent-based or direct ingestion)
- User wants to **edit an existing DCR** (add transforms, change routing, modify filters)
- User asks about **KQL ingestion-time transformations** (filter, parse, project, extend)
- User wants to **create a custom Log Analytics table** for ingestion
- User asks about **stream declarations**, **destination routing**, or **dataFlow configuration**
- User wants to **send custom logs** via Log Ingestion API
- User asks about **multi-stage transformations** (client-side processors + ingestion-side KQL)
- User wants to **validate a DCR** before deployment
- User asks about **DCR limits**, column constraints, or structure constraints
- User mentions **CEF parsing**, **XML parsing**, **JSON extraction**, or **syslog filtering** in DCR context

## MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_ser_monitor` | Query Azure Monitor resources, DCRs, and diagnostics |
| `mcp_azure_mcp_ser_subscription_list` | List available subscriptions |
| `mcp_azure_mcp_ser_group_list` | List resource groups in subscription |
| `mcp_azure_mcp_ser_group_resource_list` | List resources in a resource group |

## Procedure

Follow the [full procedure](./references/procedure.md):

1. **Gather requirements** — ingestion method, data source, intent, destination, split/copy needs
2. **Determine DCR kind** — per [DCR kinds guide](./references/dcr-kinds.md)
3. **Design transformation pipeline** — native filters, processors, or `transformKql`
4. **Author the DCR** — per [DCR schema](./references/dcr-schema.md) and [routing rules](./references/destination-routing.md)
5. **Validate** — run [validate-dcr.ps1](./scripts/validate-dcr.ps1) or [validate-dcr.sh](./scripts/validate-dcr.sh)
6. **Deploy** — run [put-dcr.ps1](./scripts/put-dcr.ps1) or [put-dcr.sh](./scripts/put-dcr.sh), prepare tables via [create-custom-table.ps1](./scripts/create-custom-table.ps1)
7. **Verify** — query destination table, check `_LogOperation` for errors

## Error Handling

| Error | Cause | Remediation |
|-------|-------|-------------|
| `StreamDeclarationMissing` | Custom stream not declared in `streamDeclarations` | Add stream declaration for direct ingestion / logFiles DCRs |
| `InvalidOutputStreamName` | `outputStream` doesn't match `Custom-*_CL` or `Microsoft-*` | Fix the outputStream to use correct prefix and table name |
| `TransformKqlSyntaxError` | KQL parse error in `transformKql` | Check KQL syntax; ensure `source` is first; validate operator support |
| `DestinationNotFound` | DataFlow references undefined destination name | Ensure destination `name` in `destinations` matches the reference |
| `TableNotFound` | Custom table doesn't exist in workspace | Create the table first via `create-custom-table.ps1` or CLI |
| `SchemaColumnMismatch` | Transform output doesn't match destination table schema | Ensure final `project` includes all required columns with correct types |
| `TransformTooLong` | `transformKql` exceeds 15,360 characters | Simplify KQL or split into multiple dataFlows |

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
