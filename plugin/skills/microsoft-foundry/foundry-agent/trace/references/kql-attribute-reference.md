# KQL Attribute Reference -- GenAI Trace Telemetry

Reference tables for GenAI OpenTelemetry attributes in Application Insights. Used alongside [KQL Templates](kql-templates.md).

## App Insights Table Mapping

| App Insights Table | GenAI Data |
|-------------------|------------|
| `dependencies` | GenAI spans: LLM inference (`chat`), tool execution (`execute_tool`), agent invocation (`invoke_agent`) |
| `requests` | Incoming HTTP requests to the agent endpoint. For hosted agents, also carries `gen_ai.agent.name` (Foundry name) and `azure.ai.agentserver.*` attributes -- **preferred entry point** for agent-name filtering |
| `customEvents` | GenAI evaluation results (`gen_ai.evaluation.result`) -- scores, labels, explanations |
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
| `gen_ai.agent.id` | Agent identifier | `asst_abc123` |
| `gen_ai.request.model` | Requested model | `gpt-4o` |
| `gen_ai.response.model` | Actual model used | `gpt-4o-2024-05-13` |
| `gen_ai.usage.input_tokens` | Input token count | `450` |
| `gen_ai.usage.output_tokens` | Output token count | `120` |
| `gen_ai.response.finish_reasons` | Stop reasons | `["stop"]`, `["tool_calls"]` |
| `error.type` | Error classification | `timeout`, `rate_limited`, `content_filter` |
| `gen_ai.provider.name` | Provider | `azure.ai.openai`, `openai` |
| `gen_ai.input.messages` | Full input messages (JSON array) -- on `invoke_agent` spans | `[{"role":"user","parts":[{"type":"text","content":"..."}]}]` |
| `gen_ai.output.messages` | Full output messages (JSON array) -- on `invoke_agent` spans | `[{"role":"assistant","parts":[{"type":"text","content":"..."}]}]` |

Stored in `customDimensions` on `customEvents` (name == `gen_ai.evaluation.result`):

| Attribute | Description | Example |
|-----------|-------------|---------|
| `gen_ai.evaluation.name` | Evaluator name | `Relevance`, `IntentResolution` |
| `gen_ai.evaluation.score.value` | Numeric score | `4.0` |
| `gen_ai.evaluation.score.label` | Human-readable label | `pass`, `fail`, `relevant` |
| `gen_ai.evaluation.explanation` | Free-form explanation | `"Response lacks detail..."` |
| `gen_ai.response.id` | Correlates to the evaluated span | `chatcmpl-123` |
| `gen_ai.conversation.id` | Correlates to conversation | `conv_5j66...` |

> **Correlation:** Eval results do NOT link via id-parentId. Use `gen_ai.conversation.id` and/or `gen_ai.response.id` to join with `dependencies` spans.

## Span Correlation

| Field | Purpose |
|-------|---------|
| `operation_Id` | Trace ID -- groups all spans in one request |
| `id` | Span ID -- unique identifier for this span |
| `operation_ParentId` | Parent span ID -- use with `id` to build span trees |

### Operation_Id Join (requests -> dependencies)

Use `requests` as the hosted-agent entry point, then carry `operation_Id` forward as the trace key when joining into `dependencies`, `traces`, or `customEvents`:

```kql
let agentRequests = materialize(
    requests
| where timestamp > ago(7d)
| extend
    foundryAgentName = coalesce(
        tostring(customDimensions["gen_ai.agent.name"]),
        tostring(customDimensions["azure.ai.agentserver.agent_name"])
    ),
    agentId = tostring(customDimensions["gen_ai.agent.id"]),
    agentNameFromId = tostring(split(agentId, ":")[0]),
    agentVersion = iff(agentId contains ":", tostring(split(agentId, ":")[1]), ""),
    conversationId = coalesce(
        tostring(customDimensions["gen_ai.conversation.id"]),
        tostring(customDimensions["azure.ai.agentserver.conversation_id"]),
        operation_Id
    )
| where foundryAgentName == "<foundry-agent-name>"
    or agentNameFromId == "<foundry-agent-name>"
| project operation_Id, conversationId, agentVersion
);
dependencies
| where timestamp > ago(7d)
| where isnotempty(customDimensions["gen_ai.operation.name"])
| join kind=inner agentRequests on operation_Id
| extend
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    model = tostring(customDimensions["gen_ai.request.model"])
| project timestamp, duration, success, operation, model, conversationId, agentVersion, operation_Id
| order by timestamp desc
```

## Hosted Agent Attributes

Stored in `customDimensions` on **both `requests` and `traces`** tables (NOT on `dependencies` spans):

| Attribute | Description | Example |
|-----------|-------------|---------|
| `azure.ai.agentserver.agent_name` | Hosted agent name | `hosted-agent-022-001` |
| `azure.ai.agentserver.agent_id` | Internal agent ID | `code-asst-xmwokux85uqc7fodxejaxa` |
| `azure.ai.agentserver.conversation_id` | Conversation ID | `conv_d7ab624de92d...` |
| `azure.ai.agentserver.response_id` | Response ID (caresp format) | `caresp_d7ab624de92d...` |

> **Important:** Use `requests` as the preferred entry point for agent-name filtering -- it has both `azure.ai.agentserver.agent_name` and `gen_ai.agent.name` with the Foundry-level name. To reach downstream spans and related telemetry, carry `operation_Id` forward from the filtered request set and join other tables on that trace key.

> **Version enrichment:** Some hosted-agent `requests` telemetry emits `gen_ai.agent.id` in `<foundry-agent-name>:<version>` format. When that delimiter is present, split on `:` to recover `agentVersion`; if it is absent, keep filtering on the requests-scoped name fields and leave version blank.

> **Warning:** `gen_ai.agent.name` means different things on different tables:
> - On `requests`: the **Foundry agent name** (user-visible) -> e.g., `hosted-agent-022-001`
> - On `dependencies`: the **code-level class name** -> e.g., `BingSearchAgent`
>
> **Always start from `requests`** when filtering by the Foundry agent name the user knows.

## Response ID Formats

| Agent Type | Prefix | Example |
|------------|--------|---------|
| Hosted agent (AgentServer) | `caresp_` | `caresp_d7ab624de92da637008Rhr4U4E1y9FSE...` |
| Prompt agent (Foundry Responses API) | `resp_` | `resp_4e2f8b016b5a0dad00697bd3c4c1b881...` |
| Azure OpenAI chat completions | `chatcmpl-` | `chatcmpl-abc123def456` |

When searching by response ID, use the appropriate prefix to narrow results. The `gen_ai.response.id` attribute appears on `dependencies` spans (for `chat` operations) and in `customEvents` (for evaluation results).

## OTel Reference Links

- [GenAI Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/)
- [GenAI Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/)
- [GenAI Events](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-events/)
- [GenAI Metrics](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-metrics/)
