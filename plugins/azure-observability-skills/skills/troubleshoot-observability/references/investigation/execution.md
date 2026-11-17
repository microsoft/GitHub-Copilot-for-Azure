# 2. Choose the execution path explicitly

**Direct telemetry (default):** use supplied sanitized evidence or existing
authorized public tools. No Python, Azure CLI, authentication,
local save or new connection is required for supplied-evidence analysis.
An ordinary request to investigate selects this path and never authorizes
new external-service operations. Continue to step 3.

For material missing trace parents/handoffs, compare current filtered retrieval
with exposed Azure Monitor TraceStore operations using the shared
[trace capability reference](../trace-capabilities.md).
Propose the smallest applicable approved lookup from the symptom, without
waiting for MCP to be named or requiring advanced analysis/a separate server.
Fresh confirmed source/schema facts are reusable; no-query and declines stop
that branch. This does not select an optional service.

Explain the choice using scenario fit, sufficient operations, verified access
and side effects. If direct evidence answers the question, return that finding
without redundant service delegation. This does not suppress the chat-level
[next-action offer](../next-actions.md).
Optional service follow-up requires a real
unanswered question or explicit request. For an existing connected SRE Agent,
follow the shared [recommendation-only SRE contract](../specialists.md#optional-existing-sre-agent):
verified connected/source proof and a specific advantage may justify one chat
review offer, never automatic delegation. Review acceptance is not execution
approval; unknown controls block execution. Explicit requests enter review
without another recommendation prompt.
Preserve scope, evidence, declines and remaining budgets across any handoff.

Before any reads, state the selected instructions, chosen path, retained scope/window,
actual discovered operations, data limits and blockers. Afterward distinguish
instructions loaded, operations executed and fallback used. Never claim a
sibling skill loaded from a Markdown reference.
