# Foundry Agent Trace Analysis

> **Local evidence-first override:** Read [execution boundaries](../../references/execution-boundaries.md).
> Supplied sanitized evidence needs no tools, azd, metadata or writes. All
> queries below are schema-dependent examples, not verified live contracts.

## Standalone availability gate

Check availability before reading either cross-skill shared reference below.
Use available shared guidance unchanged; never download, install or require a
missing sibling-file read. If absent, retain these local schemas, scope/window,
read/row caps and source-identity checks; use sufficient existing authorized
operations and report material trace gaps, not invented analysis or bulk
reconstruction. Without next-action guidance, return evidence and one smallest
supported fix/rollback plan-review question, or the smallest missing evidence.
Stops, budgets and separate approvals remain; no recovery claim or new service.

Before choosing retrieval/KQL, follow the shared
[trace capability reference](../../../trace-capabilities.md)
without requiring coordinator activation. An existing sufficient authorized
path remains valid. Apply its mandatory capability evaluation before nontrivial
distributed trace reconstruction and at truncation, missing/disconnected parents,
repeated joins or material source-identity gaps. For a material unresolved
cap/parent/correlation issue, show its concise **Trace capability decision**
before requesting the next evidence pass or budget: existing-path sufficiency,
candidate availability/eligibility uncertainty and bounded choice, once per
material issue. Do not defer that decision to cloud checks.
This does not require Trace MCP use or authorize cloud discovery. An authorized
server-side API can answer population latency, critical-path or top-attribute
questions; MCP is a transport, not proof of those operations. Retrieval-only
success can still leave a specific analysis gap. Offer the supported missing
capability as a candidate now; require eligibility/schema/access checks before
use, never bulk download, local
percentile/critical-path reconstruction or silent limit expansion. Confirm a
trace-enabled eligible Azure Monitor workspace only for its trace-store path;
App Insights existence is not that eligibility and need not be replaced when
already sufficient. Preserve sampling/count/filter/truncation/partial states,
no-query/no-save ceilings and remaining budgets. If this shared reference is
unavailable, keep these boundaries and disclose the missing resource.

Analyze Foundry traces using the smallest sufficient authorized source and GenAI
OpenTelemetry conventions. App Insights KQL remains valid when sufficient.
For material missing parents/handoffs, compare filtered-query coverage with
exposed Azure Monitor TraceStore operations before another evidence-budget
request, even when the developer names no tool. Explain the bounded retrieval
benefit and offer the smallest approved check/lookup; advanced analysis is not
a prerequisite. An exposed Monitor router needs no separate trace server.
Reuse fresh source/schema facts and approval; otherwise follow the shared
reference's association, identity and permission checks. These instructions
guide tools; they do not execute queries or establish current source access.

## When to Use This Skill

USE FOR: analyze agent traces, search agent conversations, find failing traces, slow traces, latency analysis, trace search, conversation history, agent errors in production, debug agent responses, App Insights traces, GenAI telemetry, trace correlation, span tree, production trace analysis, evaluation results, evaluation scores, eval run results, find by response ID, get agent trace by conversation ID, agent evaluation scores from App Insights.

> Read these instructions for Foundry GenAI attribute mappings and
> schema-dependent examples, then use the actual exposed Monitor/query tools.
> A skill guides tool selection; it does not replace Azure Monitor operations.

> ⚠️ **DO NOT manually write KQL queries** for GenAI trace analysis **without reading this skill first.** This skill provides tested query templates with correct GenAI OTel attribute mappings, proper span correlation logic, environment-aware scoping, and conversation-level aggregation patterns.

## Quick Reference

| Property | Value |
|----------|-------|
| Data source | Sufficient confirmed App Insights, eligible Azure Monitor TraceStore, or supported equivalent source |
| Query language | App Insights: KQL; TraceStore: discover the actual query contract |
| Related skills | `troubleshoot` (hosted-agent logs), `eval-datasets` (trace harvesting) |
| App Insights query route | `monitor_resource_log_query` (Azure MCP), only for the confirmed App Insights KQL path and actual schema |
| TraceStore query route | Exposed Azure MCP Monitor trace operations or local .NET trace server; alternatives with different contracts, see shared reference |
| OTel conventions | [GenAI Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/), [Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) |
| Local metadata | selected `.foundry/agent-metadata*.yaml` overlay/cache file |

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
| "Get automated insights" / "Pull generated agent insights" / "Show agent recommendations" | [Agent Insights](../insights/insights.md) (read existing findings, not a new analysis) |

For generated insights, follow [Agent Insights](../insights/insights.md) directly and skip the App Insights/KQL prerequisites below. Keep raw-trace investigation in this workflow.

## Before Starting — Resolve the selected source

For a sufficient selected server-side trace-analysis source, verify its actual
operations, agent/version association, schema, safe content projections and
approved bounds instead of forcing App Insights/KQL prerequisites. Return a
complete sufficient finding without redundant diagnostics/Obs/SRE delegation.
Use the following steps only for the App Insights query path.

1. Resolve the target agent root, environment, effective deployment context, and selected metadata overlay using [Common Project Context Resolution](../../SKILL.md#agent-common-project-context-resolution).
2. Reuse the confirmed App Insights resource ID and existing source association.
   Never dump `azd env get-values` or retrieve connection strings. Metadata is
   optional; inspect only approved nonsecret identifier fields when needed.
3. If the association is missing, propose a bounded metadata read through an
   actually discovered authorized operation. Do not initialize/persist metadata.
4. Confirm the selected App Insights resource and environment with the user before querying.
5. Discover the actual query operation and schema. The resource log query
   requires `resource-id`, `table`, and `query`; workspace operations and schemas
   differ. Verify table/field availability with a minimal approved noncontent
   schema/sample read, then adapt a bounded example to the retained UTC window.

| Metadata field | Purpose | Example |
|----------------|---------|---------|
| `environments.<env>.observability.applicationInsightsConnectionString` | App Insights connection string | `InstrumentationKey=...;IngestionEndpoint=...` |
| `environments.<env>.observability.applicationInsightsResourceId` | ARM resource ID | `/subscriptions/.../Microsoft.Insights/components/...` |

> Pass only parameters accepted by the discovered schema; do not assume a
> `subscription` parameter or omit the required `table`.

## Behavioral Rules

Retain table-specific schema evidence and a compact per-query result summary in
the conversation. Recover permitted previous outputs before asking for more
schema. If a new chat or lost context makes the result unavailable, disclose
that and propose one minimal schema-only recheck for approval; do not require
the developer to name internal columns or write KQL. `getschema` confirms
column types, not dynamic property keys or populated agent identity.

Keep schema reads separate from event-query outcomes in the execution summary.
Two schema reads plus two empty agent-name queries are not four empty queries.
Preserve candidate/project-linked/agent-associated provenance separately; a
resource-group selection never proves a project-to-component link. Unattributed
component records cannot establish the selected agent's latency or health.

If approved name filters match no records, explain the narrow result and
propose one justified identity/source check or bounded candidate summary,
not repeated guessed filters or mandatory developer-supplied trace engineering.
Removing an agent predicate broadens population even within the same component:
show that change and obtain the applicable approval, exclude content/full
property bags and retain candidates as unattributed.
When available results contain only unrelated/unattributed timing signals and
agent association cannot be established safely, summarize INCONCLUSIVE and
stop that query path. No arbitrary threshold defines relevance and no empty
portal view triggers invocation, evaluation or instrumentation changes.

1. **Always display the KQL query.** Before executing any KQL query, display it in a code block. Never run a query silently.
2. **Keep environment visible.** Include the selected environment and agent name in each search summary, and include the derived agent version when the query can recover it from telemetry.
3. **Start at the selected symptom/trace.** Retain known identifiers and scope;
   no automatic broadening or cross-source wildcard searches.
4. **Use the approved UTC start/end.** Example lookbacks are not defaults or
   approval. Propose a small window if missing; keep explicit row/call limits.
5. **Explain GenAI attributes.** When displaying results, translate OTel attribute names to human-readable labels (for example, `gen_ai.operation.name` -> "Operation").
6. **Link to conversation detail.** Include verified available detail links. Offer a specific drill-down only for an unanswered question; do not crowd the next-action decision with another question.
7. **Scope to the selected environment.** App Insights may contain traces from multiple agents or environments. Filter with the selected environment's agent name first, then add an environment tag filter if the telemetry emits one.
8. **Resolve hosted-agent identity from `requests` first.** For hosted agents, prefer `requests`-scoped `gen_ai.agent.name` or `azure.ai.agentserver.agent_name` as the Foundry-facing filter. When `gen_ai.agent.id` is emitted in `<agent-name>:<version>` format, parse it to surface `agentVersion`, but do not treat `dependencies.gen_ai.agent.name` as the top-level hosted-agent name.
9. **Use actual `operation_Id` to fan out hosted-agent traces.** After isolating
   requests, deduplicate observed trace IDs before joining other tables.
   A trace-key fallback is not a conversation ID: label it explicitly.
   Validate emitted names/versions rather than inferring identity from an ID.

## Complete the investigation

Apply [the result-to-next-action contract](../../../next-actions.md)
after trace analysis, including supplied-evidence analysis. State the stage and
use its implementation continuation after completed plan review: ask for missing
source or propose the exact minimal edit for separate approval. Otherwise name the
smallest supported change; ask one concise fix/rollback plan-review question
unless stopped/declined or already accepted. For unresolved material cause,
propose the smallest missing evidence instead. Do not auto-run optimization,
edits, evaluations or deployment. After an actual approved change, offer bounded
verification from existing supplied baseline/post-change evidence only.
