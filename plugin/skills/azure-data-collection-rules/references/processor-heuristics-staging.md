# Processor Heuristics: Staging & Cost Optimization

Stage placement rules, split/copy billing optimization, and common multi-processor chains.

## Stage Decision Heuristics

When the user doesn't specify a stage, apply these rules in order:

1. **Security-sensitive data (PII, secrets)?** → Client-side `map.Drop` or `filter.Basic` (data never leaves the VM)
2. **Split/copy scenario?** → Consult "Split/Copy Cost Optimization" below. Do NOT filter client-side if a copy path exists from the same data source.
3. **Volume reduction possible early?** → Client-side (saves network, ingestion, and storage cost)
4. **Requires KQL string functions, regex, or computed columns?** → Ingestion-side `transform.KQL` (the only non-header processor available in the pipeline)
5. **Depends on standard table enrichment (e.g., _ResourceId)?** → Ingestion-side `transform.KQL`
6. **All non-KQL processors are client-side only.** Only `transform.KQL` (+ `header.StandardStream`/`header.CustomStream`) runs in the pipeline.
7. **Need to combine with existing `transformKql`?** → Keep in ingestion-side for consistency

## Split/Copy Cost Optimization

**Key billing facts:**
- **Analytics/Basic destinations:** Transformations are free (no processing charge regardless of how much data is filtered or added).
- **Auxiliary destinations:** Processing charge on ALL incoming data to the flow (full input volume), regardless of how much is dropped. Plus ingestion charge on output volume.
- **Client-side split (multiple data sources):** Each data source sends its subset independently. Same data may be sent multiple times in overlapping/copy scenarios.
- **Pipeline-side split (multiple dataFlows):** Each flow processes the full input stream. For N flows, processing charges are incurred N times on the input volume (relevant for Auxiliary).
- **Multi-workspace:** Only possible via AMA double-ingestion (separate data sources targeting different workspaces). Not available for direct ingestion DCRs.

**Optimal strategy by scenario:**

| Scenario | Optimal approach | Rationale |
|---|---|---|
| Copy → multiple Analytics tables | Pipeline-side (multiple dataFlows, same stream) | Transformations free. Single network send. |
| Copy → Analytics + Auxiliary | Pipeline-side | Auxiliary processing charge unavoidable. Single send saves network vs. double-ingestion. |
| Split → multiple Analytics tables | Pipeline-side | Transformations free regardless of drop ratio. Single network send. |
| Split → multiple Auxiliary tables | Client-side (separate data sources with native filters) | Each source sends only its subset, reducing per-flow processing volume. If native filters can't separate cleanly, pipeline-side is the only option (accept multiplied processing charges). |
| Copy + Split combined (full copy → Auxiliary, filtered subset → Analytics) | Pipeline-side only | Cannot filter client-side (would break the copy). Accept Auxiliary processing charge on full volume. Analytics flow is free. |
| Multi-workspace | AMA double-ingestion (separate data sources) | Only possible in AMA DCRs. Each workspace requires its own data source entry. |

**Critical rule:** When a copy path and a split path share the same data source, do NOT apply client-side filtering. Client-side filters reduce data before it reaches ALL streams, breaking the copy. Place split filters on the ingestion-side dataFlow only.

## Common Multi-Processor Chains

### Syslog: filter by message content + drop columns
```
Native: logLevels = ["Warning", "Error", "Critical", "Alert", "Emergency"] (severity filtering)
Client-side: header.Syslog → filter.Basic (Message contains "authentication") → map.Drop (ProcessId, HostIP)
```
Stage: client-side. Rationale: native `logLevels` handles severity; processor handles content filter and column drop.

### Windows Events: parse XML + extract fields + drop raw
```
header.WindowsEvents → parse.XmlPath (extract EventID, UserName from RawXml) → map.Drop (remove RawXml, RenderingInfo)
```
Stage: client-side. Rationale: extract needed fields, drop large raw XML.

### Text logs: parse JSON + rename + ingestion KQL
```
Client: header.TextLog → parse.JsonPath (extract structured fields from RawData) → map.Drop (RawData, FilePath)
Ingestion: header.CustomStream → transform.KQL (extend computed columns, filter)
```
Two-stage chain. Rationale: parse on VM, compute on ingestion.

### Performance counters: aggregate
```
header.WindowsPerformanceCounters → aggregate.Basic (5m window, avg/max/count by Host, CounterName)
```
Stage: client-side. Rationale: dramatic volume reduction. Must route to custom table.

### CEF security logs: parse + enrich
```
header.Syslog → parse.CEFAttribute (extract deviceAction, sourceAddress, destinationAddress) → enrich.DNSLookup (resolve sourceAddress)
```
Stage: client-side. Rationale: extract and enrich before send.
