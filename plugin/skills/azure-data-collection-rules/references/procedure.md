# DCR Authoring Procedure

Full step-by-step workflow for creating or modifying a Data Collection Rule.

## Step 1: Gather Requirements

Collect from the user:

1. **New or existing DCR?** If existing, retrieve via [get-dcr.ps1](../scripts/get-dcr.ps1) and ask what modifications they want. If new, proceed.
2. **Ingestion method:** agent-based (AMA on VM) or direct ingestion (Log Ingestion API from app/script)?
3. **Data source type(s):** syslog, windowsEventLogs, performanceCounters, logFiles (JSON/text), iisLogs (agent-based), or custom JSON payload (direct)
4. **What the user wants to achieve** (in their own words): e.g., "filter noisy logs", "extract fields from JSON", "reduce volume", "drop PII", "aggregate counters". Do NOT require the user to specify processors or stages, but inform them that it is possible to assign certain processors manually if needed.
5. **Destination:** standard table (e.g., Syslog, Event) or custom table (`*_CL`)
6. **Split / copy:** does the same data need to go to multiple tables (copy), or different subsets to different tables (split)?
7. **Target subscription, resource group, workspace resource ID**.

## Step 2: Determine DCR Kind

Consult the [DCR kinds guide](./dcr-kinds.md) to select `Linux`, `Windows`, `Direct`, or `WorkspaceTransforms` based on the ingestion method from Step 1. This determines what transformation capabilities are available in Step 3.

## Step 3: Design Transformation Pipeline

Using the DCR kind from Step 2 and the user's intent from Step 1, follow the design order in the [DCR kinds guide](./dcr-kinds.md) to build the transformation pipeline. For agent-based processor selection, consult [processor heuristics](./processor-heuristics.md).

Present the recommended pipeline to the user for confirmation:

```
Recommended pipeline:
  Native filters: logLevels = ["Warning", "Error", "Critical", "Alert", "Emergency"]
  Client-side: header.Syslog → filter.Basic (Message contains "failed") → map.Drop (ProcessId, HostIP)
  Ingestion-side: (none needed)
  Destination: Microsoft-Syslog → Syslog table
```

If the user's intent doesn't map cleanly to a heuristic, fall back to asking which processors they want.

## Step 4: Design and Author the DCR

1. **Identify streams and destination table** — consult [destination routing rules](./destination-routing.md):
   - Standard stream (`Microsoft-*`) if output matches standard table schema
   - Custom stream (`Custom-*`) if schema changes or routing to a custom table
   - Whether the target standard table accepts custom streams (see supported table list)
2. **Define custom stream schemas** in `streamDeclarations` if needed
3. **Author data sources** with collection settings and optional client-side `transform` reference
4. **Author transformations** in the `transformations` section (multi-stage) or use `transformKql` inline (single-stage)
5. **Define data flows** routing streams to destinations with optional ingestion-side transforms
6. **Define destinations** with workspace resource ID

**If split or copy is involved:** consult [Split/Copy Cost Optimization](./processor-heuristics-staging.md#splitcopy-cost-optimization). Key rules:
- All destinations Analytics: pipeline-side preferred (transforms free, single network send)
- Any destination Auxiliary: evaluate per-flow processing charges vs. network cost
- Copy + split combined: MUST use pipeline-side (client-side filtering breaks the copy path)
- Multi-workspace: AMA-only. Prefer separate DCRs per workspace. Single DCR with multiple destinations is possible but only use if the user explicitly requests it.

**Output the final DCR JSON** per [DCR schema](./dcr-schema.md). See [example DCRs](../examples/) for reference.

## Step 5: Validate

Before deploying, validate:

1. Every `transform` reference in dataSources/dataFlows points to a named transformation in `transformations`
2. Every custom stream in `streams` arrays has a matching `streamDeclarations` entry
3. Every destination referenced in `dataFlows` exists in `destinations`
4. `transform` and `transformKql` are not both present on the same data flow
5. Header processors match their context (client-side headers for data sources, ingestion-side headers for data flows)
6. Output schema of processors is compatible with the target stream/table
7. **Limits compliance** (see [limits.md](./limits.md)):
   - Data sources ≤ 10, data flows ≤ 10, streams ≤ 20, LA destinations ≤ 10
   - `transformKql` ≤ 15,360 characters
   - Perf counter specifiers ≤ 100, syslog facilities ≤ 20, xPathQueries ≤ 100
   - Stream column names: start with letter, alphanumeric + underscore only, ≤ 60 chars, ≤ 1,000 columns
   - Column types: only `string`, `int`, `long`, `real`, `boolean`, `dynamic`, `datetime` (no `guid`)
   - Direct DCR name: 3–30 chars, alphanumeric + hyphens (DNS-safe)

Run [validate-dcr.ps1](../scripts/validate-dcr.ps1) for automated checks (includes all limits validation).

## Step 6: Deploy and Prepare Tables

Deploy with [put-dcr.ps1](../scripts/put-dcr.ps1):

```powershell
.\put-dcr.ps1 -SubscriptionId "{sub}" -ResourceGroupName "{rg}" -DcrName "{name}" -DcrFilePath "dcr.json"
```

Use [get-dcr.ps1](../scripts/get-dcr.ps1) to retrieve an existing DCR for editing.

**Prepare destination tables** before deploying the DCR:

1. **Custom tables:** create with [create-custom-table.ps1](../scripts/create-custom-table.ps1). See [LA tables](./la-tables.md).
2. **Standard tables with extra columns:** add them with `_CF` suffix before deploying.
3. **Schema verification:** compare transform output against table schema ([get-table-schema.ps1](../scripts/get-table-schema.ps1)). Mismatches cause silent data loss.

See [destination routing](./destination-routing.md) (rules 8-9) for details.

## Step 7: Verify

After deployment:

1. Check DCR validation status in Azure portal or via GET on the DCR resource
2. Query the destination table in Log Analytics to confirm data arrives
3. Check for ingestion errors in the `_LogOperation` table
