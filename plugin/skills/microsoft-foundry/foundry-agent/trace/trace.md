# Foundry Agent Trace Analysis

Analyze production traces for Foundry agents using Application Insights and GenAI OpenTelemetry semantic conventions. This skill provides **structured KQL-powered workflows** for searching conversations, diagnosing failures, and identifying latency bottlenecks. Use this skill instead of writing ad-hoc KQL queries against App Insights manually.

## When to Use This Skill

USE FOR: analyze agent traces, search agent conversations, find failing traces, slow traces, latency analysis, trace search, conversation history, agent errors in production, debug agent responses, App Insights traces, GenAI telemetry, trace correlation, span tree, agent monitoring, production trace analysis.

> ⚠️ **DO NOT manually write KQL queries** for GenAI trace analysis **without reading this skill first.** This skill provides tested query templates with correct GenAI OTel attribute mappings, proper span correlation logic, and conversation-level aggregation patterns.

## Quick Reference

| Property | Value |
|----------|-------|
| Data source | Application Insights (App Insights) |
| Query language | KQL (Kusto Query Language) |
| Related skills | `azure-kusto` (KQL execution), `troubleshoot` (container logs) |
| OTel conventions | [GenAI Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/), [Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) |

## Entry Points

| User Intent | Start At |
|-------------|----------|
| "Search agent conversations" / "Find traces" | [Search Traces](references/search-traces.md) |
| "Why is my agent failing?" / "Find errors" | [Analyze Failures](references/analyze-failures.md) |
| "My agent is slow" / "Latency analysis" | [Analyze Latency](references/analyze-latency.md) |
| "Show me this conversation" / "Trace detail" | [Conversation Detail](references/conversation-detail.md) |
| "What KQL do I need?" | [KQL Templates](references/kql-templates.md) |

## Before Starting — Resolve App Insights Connection

1. Check `.env` for `APPLICATIONINSIGHTS_CONNECTION_STRING` or `AZURE_APPINSIGHTS_RESOURCE_ID`
2. If not found, use project connections to discover App Insights (same as [troubleshoot skill](../troubleshoot/troubleshoot.md) Step 4)
3. Confirm the App Insights resource with the user before querying
4. Delegate KQL execution to the `azure-kusto` skill

## Behavioral Rules

1. **Always show the KQL query.** Before running any query, show it to the user for review. This builds trust and helps users learn KQL patterns.
2. **Start broad, then narrow.** Begin with conversation-level summaries, then drill into specific conversations or spans on user request.
3. **Use time ranges.** Always scope queries with a time range (default: last 24 hours). Ask user for the range if not specified.
4. **Explain GenAI attributes.** When displaying results, translate OTel attribute names to human-readable labels (e.g., `gen_ai.operation.name` → "Operation").
5. **Link to conversation detail.** When showing search or failure results, offer to drill into any specific conversation.
