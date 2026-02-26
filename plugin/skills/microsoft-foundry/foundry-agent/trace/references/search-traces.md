# Search Traces — Conversation-Level Search

Search agent traces at the conversation level. Returns summaries grouped by conversation or operation, not individual spans.

## Prerequisites

- App Insights resource resolved (see [trace.md](../trace.md) Before Starting)
- Time range confirmed with user (default: last 24 hours)

## Search by Conversation ID

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.conversation.id"] == "<conversation_id>"
| project timestamp, name, duration, resultCode, success,
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    model = tostring(customDimensions["gen_ai.request.model"]),
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"]),
    operation_Id, id, operation_ParentId
| order by timestamp asc
```

## Search by Response ID

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.response.id"] == "<response_id>"
| project timestamp, name, duration, resultCode, success, operation_Id
```

Then use the `operation_Id` to fetch the full conversation (see [Conversation Detail](conversation-detail.md)).

## Search by Agent Name

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.agent.name"] == "<agent_name>"
    or customDimensions["gen_ai.agent.id"] == "<agent_name>"
| summarize
    startTime = min(timestamp),
    endTime = max(timestamp),
    totalDuration = max(timestamp) - min(timestamp),
    spanCount = count(),
    errorCount = countif(success == false),
    totalInputTokens = sum(toint(customDimensions["gen_ai.usage.input_tokens"])),
    totalOutputTokens = sum(toint(customDimensions["gen_ai.usage.output_tokens"]))
  by conversationId = tostring(customDimensions["gen_ai.conversation.id"]),
     operation_Id
| order by startTime desc
| take 50
```

## Conversation Summary Table

Present results in this format:

| Conversation ID | Start Time | Duration | Spans | Errors | Input Tokens | Output Tokens |
|----------------|------------|----------|-------|--------|-------------|---------------|
| conv_abc123 | 2025-01-15 10:30 | 4.2s | 12 | 0 | 850 | 320 |
| conv_def456 | 2025-01-15 10:25 | 8.7s | 18 | 2 | 1200 | 450 |

Highlight rows with errors in the summary. Offer to drill into any conversation via [Conversation Detail](conversation-detail.md).

## Free-Text Search

When the user provides a general search term (e.g., agent name, error message):

```kql
union dependencies, requests, exceptions, traces
| where timestamp > ago(24h)
| where * contains "<search_term>"
| summarize count() by operation_Id
| order by count_ desc
| take 20
```
