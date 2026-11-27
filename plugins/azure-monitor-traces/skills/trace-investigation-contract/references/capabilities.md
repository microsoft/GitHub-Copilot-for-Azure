# Azure MCP transport and capabilities

Use this plugin's discovered Monitor MCP router with `learn=true`, then its
returned command identifiers and schemas. Namespace execution requires `intent`.
Do not call the standalone server's `az_*` names or switch provider on denial.
Read [analysis parameters](analysis-commands.md) before top attributes or CPA.

## Workspace and query

Resolve an AMW ARM ID to `workspace` name, `resource-group` and subscription;
do not pass the ARM ID as a query account. `monitor traces account list` has
optional `subscription`, `tenant`, `resource-group`. If `areResultsTruncated`
is true, narrow discovery by group; absence from truncated inventory is unknown.
Known workspace access does not require reading its parent resource group.
The group parameter remains required. Preserve resolved identity and scope.

All workspace commands below also accept optional `subscription` and `tenant`.

| Command | Required | Optional |
|---|---|---|
| `monitor traces field list` | `workspace`, `resource-group` | Subscription/tenant |
| `monitor traces query run` | Workspace/group, `query` | `start-time`, `end-time`, `max-results`, `include-spans` |
| `monitor traces query resume` | Workspace/group, `operation-id` | `page-size`, `include-spans` |
| `monitor traces query cancel` | Workspace/group, `operation-id` | Subscription/tenant |

Set UTC windows explicitly: positive and at most 24 hours. Omission uses the
last 30 minutes. Run `max-results` defaults 100, clamps 1-1000; resume
`page-size` defaults 100, clamps 1-1000. These bound per-call collection,
not scan work or total operation coverage. Whole backend pages may exceed
the requested count. Each call collects for at most 180 seconds.
`include-spans` defaults true on run and resume; retain the chosen value.

`Running` returns an operation ID and collected payload. Save the first
payload and append every resumed page sequentially, including an empty final
page without discarding prior rows. Do not resubmit, replay or parallelize
resumes. Inspect final status, output-limit and payload coverage flags;
`Succeeded` alone does not prove complete backend coverage.
Cancel only when explicitly asked to stop that operation.

Example after discovery; use the actual returned router:

```javascript
({
  intent: "Inspect a bounded trace example",
  command: "monitor_traces_query_run",
  parameters: {
    workspace: "<workspace-name>",
    "resource-group": "<resource-group>",
    query: "Traces | project trace_id, duration_nano, error_rate",
    "start-time": "<utc-start>",
    "end-time": "<utc-end>",
    "max-results": 1000,
    "include-spans": false
  }
})
```

## Unavailable delivered capabilities

The version-matched standalone workflow uses capabilities not registered in
the reviewed merged Azure MCP Monitor contract. Do not approximate them.

| Missing capability | Result unavailable |
|---|---|
| PromQL query/range and label discovery | Metric-first RED/KPI ranking |
| Exact latency-cohort helper | Canonical distinct-trace percentile bands, counts and IDs |
| Exact impact helper | Verified selected/affected denominators and timing buckets |
| Independent statistics/attributes/CPA comparisons | Joined current/baseline/diff evidence |
| Portal URL builder | KPI, filtered Explorer and Details links |
| Structured/compact output and query-defined CPA switches | Those transport modes; inspect actual payload instead |

Keep supported queries, top attributes and ordinary CPA usable. Stop only the
required unavailable stage; explain its missing result and continue supported
example/evidence checks. No local reconstruction of the missing helpers,
unpaired comparison substitutes or fabricated URLs.

To enable a gated step later, first verify merged command registration and
the published package, then replace that step's gate with its discovered
schema and add a behavior eval. `@latest` alone is not capability evidence.
