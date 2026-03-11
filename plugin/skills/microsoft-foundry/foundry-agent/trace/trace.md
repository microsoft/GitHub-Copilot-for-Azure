# Foundry Agent Trace Analysis

Analyze production traces for Foundry agents using Application Insights and GenAI OpenTelemetry semantic conventions. This skill provides structured KQL-powered workflows for a selected agent root and environment: searching conversations, diagnosing failures, and identifying latency bottlenecks.

## When to Use This Skill

USE FOR: analyze agent traces, search agent conversations, find failing traces, slow traces, latency analysis, trace search, conversation history, agent errors in production, debug agent responses, App Insights traces, GenAI telemetry, trace correlation, span tree, production trace analysis, evaluation results, evaluation scores, eval run results, find by response ID, get agent trace by conversation ID, agent evaluation scores from App Insights.

> **USE THIS SKILL INSTEAD OF** `azure-monitor` or `azure-applicationinsights` when querying Foundry agent traces, evaluations, or GenAI telemetry. This skill has correct GenAI OTel attribute mappings and tested KQL templates that those general tools lack.

> ⚠️ **DO NOT manually write KQL queries** for GenAI trace analysis **without reading this skill first.** This skill provides tested query templates with correct GenAI OTel attribute mappings, proper span correlation logic, environment-aware scoping, and conversation-level aggregation patterns.

## Quick Reference

| Property | Value |
|----------|-------|
| Data source | Application Insights (App Insights) |
| Query language | KQL (Kusto Query Language) |
| Related skills | `troubleshoot` (container logs), `eval-datasets` (trace harvesting) |
| Preferred query tool | `monitor_resource_log_query` (Azure MCP) - use for App Insights KQL queries |
| OTel conventions | [GenAI Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/), [Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) |
| Local metadata | `.foundry/agent-metadata.yaml` |

## Entry Points

| User Intent | Start At |
|-------------|----------|
| "Search agent conversations" / "Find traces" | [Search Traces](references/search-traces.md) |
| "Tell me about response ID X" / "Look up response ID" | [Search Traces - Search by Response ID](references/search-traces.md#search-by-response-id) |
| "Why is my agent failing?" / "Find errors" | [Analyze Failures](references/analyze-failures.md) |
| "My agent is slow" / "Latency analysis" | [Analyze Latency](references/analyze-latency.md) |
| "Show me this conversation" / "Trace detail" | [Conversation Detail](references/conversation-detail.md) |
| "Find eval results for response ID" / "eval scores from traces" | [Eval Correlation](references/eval-correlation.md) |
| "What KQL do I need?" | [KQL Templates](references/kql-templates.md) |

## Before Starting — Resolve App Insights Connection

1. Resolve the target agent root and environment from `.foundry/agent-metadata.yaml`.
2. Check `environments.<env>.observability.applicationInsightsConnectionString` or `applicationInsightsResourceId` in the metadata.
3. If observability settings are missing, use `project_connection_list` to discover App Insights linked to the Foundry project, then persist the chosen resource back to the selected environment in `agent-metadata.yaml` before querying.
4. Confirm the selected App Insights resource and environment with the user before querying.
5. Use **`monitor_resource_log_query`** (Azure MCP tool) to execute KQL queries against the App Insights resource. This is preferred over delegating to the `azure-kusto` skill. Pass the App Insights resource ID and the KQL query directly.

| Field | Purpose | Example |
|-------|---------|---------|
| `applicationInsightsConnectionString` | App Insights connection string | `InstrumentationKey=...;IngestionEndpoint=...` |
| `applicationInsightsResourceId` | ARM resource ID | `/subscriptions/.../Microsoft.Insights/components/...` |

> ⚠️ **Always pass `subscription` explicitly** to Azure MCP tools like `monitor_resource_log_query` - they do not extract it from resource IDs.

## Behavioral Rules

1. **Always display the KQL query.** Before executing any KQL query, display it in a code block. Never run a query silently.
2. **Keep environment visible.** Include the selected environment and agent name in each search summary and explain which metadata entry is being used.
3. **Start broad, then narrow.** Begin with conversation-level summaries, then drill into specific conversations or spans on user request.
4. **Use time ranges.** Always scope queries with a time range (default: last 24 hours). Ask the user for the range if not specified.
5. **Explain GenAI attributes.** When displaying results, translate OTel attribute names to human-readable labels (for example, `gen_ai.operation.name` -> "Operation").
6. **Link to conversation detail.** When showing search or failure results, offer to drill into any specific conversation.
7. **Scope to the selected environment.** App Insights may contain traces from multiple agents or environments. Filter with the selected environment's agent name first, then add an environment tag filter if the telemetry emits one.
