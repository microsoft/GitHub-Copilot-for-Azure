# KQL Templates -- GenAI Trace Query Reference

Ready-to-use KQL templates for querying GenAI OpenTelemetry traces in Application Insights. For attribute definitions and table mappings, see [KQL Attribute Reference](kql-attribute-reference.md).

## Common Query Templates

### Overview - Conversations in last 24h
```kql
dependencies
| where timestamp > ago(24h)
| where isnotempty(customDimensions["gen_ai.operation.name"])
| summarize
    spanCount = count(),
    errorCount = countif(success == false),
    avgDuration = avg(duration),
    totalInputTokens = sum(toint(customDimensions["gen_ai.usage.input_tokens"])),
    totalOutputTokens = sum(toint(customDimensions["gen_ai.usage.output_tokens"]))
  by bin(timestamp, 1h)
| order by timestamp desc
```

### Error Rate by Operation
```kql
dependencies
| where timestamp > ago(24h)
| where isnotempty(customDimensions["gen_ai.operation.name"])
| summarize
    total = count(),
    errors = countif(success == false),
    errorRate = round(100.0 * countif(success == false) / count(), 1)
  by operation = tostring(customDimensions["gen_ai.operation.name"])
| order by errorRate desc
```

### Token Usage by Model
```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.operation.name"] == "chat"
| summarize
    calls = count(),
    totalInput = sum(toint(customDimensions["gen_ai.usage.input_tokens"])),
    totalOutput = sum(toint(customDimensions["gen_ai.usage.output_tokens"])),
    avgInput = avg(todouble(customDimensions["gen_ai.usage.input_tokens"])),
    avgOutput = avg(todouble(customDimensions["gen_ai.usage.output_tokens"]))
  by model = tostring(customDimensions["gen_ai.request.model"])
| order by totalInput desc
```

### Tool Call Details
```kql
dependencies
| where operation_Id == "<operation_id>"
| where customDimensions["gen_ai.operation.name"] == "execute_tool"
| project timestamp, duration, success,
    toolName = tostring(customDimensions["gen_ai.tool.name"]),
    toolType = tostring(customDimensions["gen_ai.tool.type"]),
    toolCallId = tostring(customDimensions["gen_ai.tool.call.id"]),
    toolArgs = tostring(customDimensions["gen_ai.tool.call.arguments"]),
    toolResult = tostring(customDimensions["gen_ai.tool.call.result"])
| order by timestamp asc
```

Key tool attributes:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `gen_ai.tool.name` | Tool function name | `remote_functions.bing_grounding`, `python` |
| `gen_ai.tool.type` | Tool type | `extension`, `function` |
| `gen_ai.tool.call.id` | Unique call ID | `call_db64aa6a004a...` |
| `gen_ai.tool.call.arguments` | JSON arguments passed | `{"query": "latest AI news"}` |
| `gen_ai.tool.call.result` | Tool output (may be truncated) | `<<ImageDisplayed>>` |

### Evaluation Results by Conversation
```kql
customEvents
| where timestamp > ago(24h)
| where name == "gen_ai.evaluation.result"
| extend
    evalName = tostring(customDimensions["gen_ai.evaluation.name"]),
    score = todouble(customDimensions["gen_ai.evaluation.score.value"]),
    label = tostring(customDimensions["gen_ai.evaluation.score.label"]),
    conversationId = tostring(customDimensions["gen_ai.conversation.id"])
| summarize
    evalCount = count(),
    avgScore = avg(score),
    failCount = countif(label == "fail" or label == "not_relevant" or label == "incorrect"),
    evaluators = make_set(evalName)
  by conversationId
| order by failCount desc
```

> For detailed eval queries by response ID or conversation ID, see [Eval Correlation](eval-correlation.md).

