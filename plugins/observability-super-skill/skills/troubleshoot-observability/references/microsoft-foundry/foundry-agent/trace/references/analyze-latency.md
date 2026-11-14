# Analyze Latency — Find and Diagnose Slow Traces

> **Local query gate:** [Execution boundaries](../../../references/execution-boundaries.md)
> take precedence. Schema-check actual duration units/fields and retain approved
> target/source, exact UTC window and row/call limits for every example.
> `sum(duration)` below is cumulative span time, not end-to-end latency: spans
> may overlap/nest. Use observed request duration for request latency, and label
> dependency percentiles separately. Token/latency correlation is not causation.
> Supplied sanitized evidence needs no tools, metadata or writes.
> Read the parent [trace workflow](../trace.md) first to select sufficient
> server-side population/critical-path/top-attribute operations. These KQL
> examples do not authorize bulk retrieval or local critical-path reconstruction.
> Preserve sampling/count/filter/truncation and partial-result coverage.
> For missing parents/handoffs, that workflow compares exposed TraceStore
> retrieval with current filtered KQL before another budget request, without
> requiring an advanced-analysis feature gap or the developer to name MCP.
> These App Insights templates do not override source-neutral operation routing.

Identify slow agent traces, find bottleneck spans, and correlate with token usage.

## Step 1 — Find Slow Conversations

> ⚠️ **Hosted agents:** `gen_ai.agent.name` on `dependencies` holds the **code-level class name** (e.g., `BingSearchAgent`), NOT the Foundry agent name. To scope by Foundry name, use the [Hosted Agent Variant](#hosted-agent-variant--latency) below.

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.operation.name"] == "invoke_agent"
| project timestamp, duration, success,
    agentName = tostring(customDimensions["gen_ai.agent.name"]),
    conversationId = tostring(customDimensions["gen_ai.conversation.id"]),
    operation_Id
| summarize
    totalDuration = sum(duration),
    spanCount = count(),
    hasErrors = countif(success == false) > 0
  by conversationId, operation_Id
| where totalDuration > 5000
| order by totalDuration desc
| take 50
```

> **Illustrative threshold only:** 5 seconds is not an agreed SLO. Ask for the
> user's threshold or report measurements without a pass/fail verdict.

## Step 2 — Latency Distribution (P50/P95/P99)

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.operation.name"] in ("chat", "invoke_agent")
| summarize
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99),
    avg = avg(duration),
    count = count()
  by operation = tostring(customDimensions["gen_ai.operation.name"]),
     model = tostring(customDimensions["gen_ai.request.model"])
| order by p95 desc
```

Present as:

| Operation | Model | P50 (ms) | P95 (ms) | P99 (ms) | Avg (ms) | Count |
|-----------|-------|---------|---------|---------|---------|-------|

## Step 3 — Bottleneck Breakdown

For a specific slow conversation, break down time spent per span type:

```kql
dependencies
| where operation_Id == "<operation_id>"
| extend operation = tostring(customDimensions["gen_ai.operation.name"])
| summarize
    totalDuration = sum(duration),
    spanCount = count(),
    avgDuration = avg(duration)
  by operation, name
| order by totalDuration desc
```

Common bottleneck patterns:
- **`chat` spans dominate** → LLM inference is slow (consider smaller model or caching)
- **`execute_tool` spans dominate** → Tool execution is slow (optimize tool implementation)
- **`invoke_agent` has long gaps** → Orchestration overhead (check agent framework)

## Step 4 — Token Usage vs Latency Correlation

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.operation.name"] == "chat"
| extend
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"])
| where isnotempty(inputTokens)
| project duration, inputTokens, outputTokens,
    model = tostring(customDimensions["gen_ai.request.model"]),
    operation_Id
| order by duration desc
| take 100
```

High token counts often correlate with high latency. If confirmed, suggest:
- Reduce system prompt length
- Limit conversation history window
- Use a faster model for simpler queries

## Hosted Agent Variant — Latency

For hosted agents, scope by Foundry agent name via `requests` then join to `dependencies`:

```kql
let reqIds = requests
| where timestamp > ago(24h)
| where customDimensions["gen_ai.agent.name"] == "<foundry-agent-name>"
| distinct operation_Id;
dependencies
| where timestamp > ago(24h)
| where operation_Id in (reqIds)
| where customDimensions["gen_ai.operation.name"] in ("chat", "invoke_agent")
| summarize
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99),
    avg = avg(duration),
    count = count()
  by operation = tostring(customDimensions["gen_ai.operation.name"]),
     model = tostring(customDimensions["gen_ai.request.model"])
| order by p95 desc
```
