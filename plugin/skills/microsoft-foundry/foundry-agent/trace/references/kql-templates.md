# KQL Templates — GenAI Trace Query Reference

Ready-to-use KQL templates for querying GenAI OpenTelemetry traces in Application Insights.

## App Insights Table Mapping

| App Insights Table | GenAI Data |
|-------------------|------------|
| `dependencies` | GenAI spans: LLM inference (`chat`), tool execution (`execute_tool`), agent invocation (`invoke_agent`) |
| `requests` | Incoming HTTP requests to the agent endpoint |
| `traces` | Log events, including GenAI events (input/output messages) |
| `exceptions` | Error details with stack traces |

## Key GenAI OTel Attributes

Stored in `customDimensions` on `dependencies` spans:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `gen_ai.operation.name` | Operation type | `chat`, `invoke_agent`, `execute_tool`, `create_agent` |
| `gen_ai.conversation.id` | Conversation/session ID | `conv_5j66UpCpwteGg4YSxUnt7lPY` |
| `gen_ai.response.id` | Response ID | `chatcmpl-123` |
| `gen_ai.agent.name` | Agent name | `my-support-agent` |
| `gen_ai.agent.id` | Agent unique ID | `asst_abc123` |
| `gen_ai.request.model` | Requested model | `gpt-4o` |
| `gen_ai.response.model` | Actual model used | `gpt-4o-2024-05-13` |
| `gen_ai.usage.input_tokens` | Input token count | `450` |
| `gen_ai.usage.output_tokens` | Output token count | `120` |
| `gen_ai.response.finish_reasons` | Stop reasons | `["stop"]`, `["tool_calls"]` |
| `error.type` | Error classification | `timeout`, `rate_limited`, `content_filter` |
| `gen_ai.provider.name` | Provider | `azure.ai.openai`, `openai` |

## Span Correlation

| Field | Purpose |
|-------|---------|
| `operation_Id` | Trace ID — groups all spans in one request |
| `id` | Span ID — unique identifier for this span |
| `operation_ParentId` | Parent span ID — use with `id` to build span trees |

## Common Query Templates

### Overview — Conversations in last 24h
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

## OTel Reference Links

- [GenAI Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/)
- [GenAI Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/)
- [GenAI Events](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/)
- [GenAI Metrics](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/)
