# Conversation Detail — Reconstruct Full Span Tree

> **Local query/privacy gate:** [Execution boundaries](../../../references/execution-boundaries.md)
> take precedence. Before any query, verify actual schema, retained target/source,
> exact UTC window and finite row/call limits, including ID-only drill-downs.
> Observed parent/span IDs establish tree edges; `operation_Id` alone is not
> conversation or agent identity. Missing spans mean a partial tree, not a
> complete reconstruction. Steps 3–4 (messages, prompts, responses, raw logs,
> custom dimensions and exception details) are **skipped by default** and need
> explicit sensitive-content access approval. Never save raw content automatically.
> Supplied sanitized evidence needs no tools, azd, cache or writes.

Reconstruct the complete span tree for a single conversation to see exactly what happened: every LLM call, tool execution, and agent invocation with timing, tokens, and errors.

## Step 1 — Fetch All Spans for a Conversation

Use `operation_Id` (trace ID) to get all spans in a single request:

```kql
dependencies
| where operation_Id == "<operation_id>"
| project timestamp, name, duration, resultCode, success,
    spanId = id,
    parentSpanId = operation_ParentId,
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    model = tostring(customDimensions["gen_ai.request.model"]),
    responseModel = tostring(customDimensions["gen_ai.response.model"]),
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"]),
    responseId = tostring(customDimensions["gen_ai.response.id"]),
    finishReason = tostring(customDimensions["gen_ai.response.finish_reasons"]),
    errorType = tostring(customDimensions["error.type"]),
    toolName = tostring(customDimensions["gen_ai.tool.name"]),
    toolCallId = tostring(customDimensions["gen_ai.tool.call.id"])
| order by timestamp asc
```

Also fetch the parent request:

```kql
requests
| where operation_Id == "<operation_id>"
| project timestamp, name, duration, resultCode, success, id, operation_ParentId
```

## Step 2 — Build Span Tree

Use `spanId` and `parentSpanId` to reconstruct the hierarchy:

```
invoke_agent (root) ─── 4200ms
├── chat (LLM call #1) ─── 1800ms, gpt-4o, 450→120 tokens
│   └── [output: "Let me check the weather..."]
├── execute_tool (get_weather) [tool: remote_functions.weather_api] ─── 200ms
│   └── [result: "rainy, 57°F"]
├── chat (LLM call #2) ─── 1500ms, gpt-4o, 620→85 tokens
│   └── [output: "The weather in Paris is rainy, 57°F"]
└── [total: 450+620=1070 input, 120+85=205 output tokens]
```

Present as an indented tree with:
- **Operation type** and name
- **Duration** (highlight if > P95 for that operation type)
- **Model** and token counts (for chat operations)
- **Error type** and result code (if failed, highlight in red)
- **Finish reason** (stop, length, content_filter, tool_calls)

## Step 3 — Optional Sensitive Content (separate explicit approval required)

The full input/output content lives on `invoke_agent` dependency spans in `gen_ai.input.messages` and `gen_ai.output.messages`. These JSON arrays contain the complete conversation (system prompt, user query, assistant response):

```kql
dependencies
| where operation_Id == "<operation_id>"
| where customDimensions["gen_ai.operation.name"] == "invoke_agent"
| project timestamp,
    inputMessages = tostring(customDimensions["gen_ai.input.messages"]),
    outputMessages = tostring(customDimensions["gen_ai.output.messages"])
| order by timestamp asc
```

Message structure: `[{"role": "user", "parts": [{"type": "text", "content": "..."}]}]`

Also check the `traces` table for additional GenAI log events:

```kql
traces
| where operation_Id == "<operation_id>"
| where message contains "gen_ai"
| project timestamp, message, customDimensions
| order by timestamp asc
```

## Step 4 — Check for Exceptions

```kql
exceptions
| where operation_Id == "<operation_id>"
| project timestamp, type, message, outerMessage,
    details = parse_json(details)
| order by timestamp asc
```

Present exceptions inline in the span tree at their position in the timeline.

## Step 5 — Fetch Evaluation Results

See [Eval Correlation](eval-correlation.md) for the full workflow to look up evaluation scores by response ID or conversation ID. Use `gen_ai.response.id` values from Step 1 spans to correlate.
