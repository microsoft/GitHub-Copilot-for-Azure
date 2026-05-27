# KQL Harvest Templates for Trace-to-Dataset Pipeline

Ready-to-use KQL templates for harvesting production traces into evaluation datasets. Used by the [Trace-to-Dataset Pipeline](trace-to-dataset.md) Step 1.

Select the appropriate KQL template based on user intent. These templates mirror common LangSmith "run rules" but offer more power through KQL's query language.

> [!] **Hosted agents:** The Foundry agent name (e.g., `hosted-agent-022-001`) only appears on `requests`, NOT on `dependencies`. For hosted agents, use the [Hosted Agent Harvest](#hosted-agent-harvest----two-step-join-pattern) template which joins via `requests.id` -> `dependencies.operation_ParentId`. The templates below work directly for **prompt agents** where `gen_ai.agent.name` on `dependencies` matches the Foundry name.

### Error Harvest -- Failed Traces

Captures all traces where the agent returned errors. Equivalent to LangSmith's `eq(error, True)` run rule.

```kql
dependencies
| where timestamp > ago(7d)
| where success == false
| where isnotempty(customDimensions["gen_ai.operation.name"])
| where customDimensions["gen_ai.agent.name"] == "<agent-name>"
| extend
    conversationId = tostring(customDimensions["gen_ai.conversation.id"]),
    responseId = tostring(customDimensions["gen_ai.response.id"]),
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    model = tostring(customDimensions["gen_ai.request.model"]),
    errorType = tostring(customDimensions["error.type"]),
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"])
| summarize
    errorCount = count(),
    errors = make_set(errorType, 5),
    firstSeen = min(timestamp),
    lastSeen = max(timestamp)
    by conversationId, responseId, operation, model
| order by lastSeen desc
| take 100
```

### Low-Eval Harvest -- Traces with Poor Evaluation Scores

Captures traces where evaluator scores fell below a threshold. Equivalent to LangSmith's `and(eq(feedback_key, "quality"), lt(feedback_score, 0.3))` run rule.

```kql
let lowEvalResponses = customEvents
| where timestamp > ago(7d)
| where name == "gen_ai.evaluation.result"
| extend
    score = todouble(customDimensions["gen_ai.evaluation.score.value"]),
    evalName = tostring(customDimensions["gen_ai.evaluation.name"]),
    responseId = tostring(customDimensions["gen_ai.response.id"]),
    conversationId = tostring(customDimensions["gen_ai.conversation.id"])
| where score < <threshold>
| project responseId, conversationId, evalName, score;
lowEvalResponses
| join kind=inner (
    dependencies
    | where timestamp > ago(7d)
    | where isnotempty(customDimensions["gen_ai.response.id"])
    | extend responseId = tostring(customDimensions["gen_ai.response.id"])
) on responseId
| extend
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    model = tostring(customDimensions["gen_ai.request.model"]),
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"])
| project timestamp, conversationId, responseId, evalName, score, operation, model, duration
| order by score asc
| take 100
```

> Tip: Replace `<threshold>` with the pass threshold from your evaluator config. Common values: `3.0` for 1-5 ordinal scales, `0.5` for 0-1 continuous scales.

### Latency Harvest -- Slow Responses

Captures traces where response latency exceeds a threshold. Equivalent to LangSmith's `gt(latency, 5000)` run rule.

```kql
dependencies
| where timestamp > ago(7d)
| where duration > <threshold_ms>
| where isnotempty(customDimensions["gen_ai.operation.name"])
| where customDimensions["gen_ai.agent.name"] == "<agent-name>"
| extend
    conversationId = tostring(customDimensions["gen_ai.conversation.id"]),
    responseId = tostring(customDimensions["gen_ai.response.id"]),
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    model = tostring(customDimensions["gen_ai.request.model"]),
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"])
| summarize
    avgDuration = avg(duration),
    maxDuration = max(duration),
    spanCount = count()
    by conversationId, responseId, operation, model
| order by maxDuration desc
| take 100
```

> Tip: Replace `<threshold_ms>` with the latency threshold in milliseconds. Common values: `5000` (5s), `10000` (10s), `30000` (30s).

### Combined Harvest -- Multi-Criteria Filter

Combines multiple filters in a single query. Equivalent to LangSmith's compound rule: `and(gt(latency, 2000), eq(error, true), has(tags, "prod"))`.

```kql
dependencies
| where timestamp > ago(7d)
| where customDimensions["gen_ai.agent.name"] == "<agent-name>"
| where isnotempty(customDimensions["gen_ai.operation.name"])
| where success == false or duration > <threshold_ms>
| extend
    conversationId = tostring(customDimensions["gen_ai.conversation.id"]),
    responseId = tostring(customDimensions["gen_ai.response.id"]),
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    model = tostring(customDimensions["gen_ai.request.model"]),
    errorType = tostring(customDimensions["error.type"]),
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"])
| summarize
    errorCount = countif(success == false),
    avgDuration = avg(duration),
    maxDuration = max(duration),
    spanCount = count()
    by conversationId, responseId, operation, model
| order by errorCount desc, maxDuration desc
| take 100
```

### Sampling -- Control Dataset Size

Add `| sample <N>` or `| take <N>` to any harvest query to control the number of traces extracted. Equivalent to LangSmith's `sampling_rate` parameter.

```kql
// Random sample of 50 traces from the harvest
... | sample 50

// Top 50 most recent traces
... | order by timestamp desc | take 50

// Stratified sample: 20 errors + 20 slow + 10 low-eval
// Run each harvest separately and combine
```

### Hosted Agent Harvest -- Two-Step Join Pattern

For hosted agents, the Foundry agent name lives on `requests`, not `dependencies`. Use this two-step pattern:

```kql
let reqIds = requests
| where timestamp > ago(7d)
| where customDimensions["gen_ai.agent.name"] == "<foundry-agent-name>"
| distinct id;
dependencies
| where timestamp > ago(7d)
| where operation_ParentId in (reqIds)
| where customDimensions["gen_ai.operation.name"] == "invoke_agent"
| extend
    conversationId = tostring(customDimensions["gen_ai.conversation.id"]),
    responseId = tostring(customDimensions["gen_ai.response.id"]),
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    model = tostring(customDimensions["gen_ai.request.model"]),
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"])
| project timestamp, duration, success, conversationId, responseId, operation, model, inputTokens, outputTokens
| order by timestamp desc
| take 100
```

> Tip: **When to use this pattern:** If the direct `dependencies` filter by `gen_ai.agent.name` returns no results, the agent is likely a hosted agent where `gen_ai.agent.name` on `dependencies` holds the code-level class name (e.g., `BingSearchAgent`), not the Foundry name. Switch to this `requests` -> `dependencies` join.

