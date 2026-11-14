# Microsoft Foundry agent troubleshooting

Foundry agents are commonly data-plane objects. Do not pass an agent name directly
to Azure Resource Graph and assume it is an ARM resource.

## Resolution flow

These are only necessary approved existing reads, not a mandatory checklist.
Retain Foundry's existing AI-specific evidence and hand off only the unresolved
application/dependency question to this workflow; never bounce between specialists.
Discover actual operations and schemas first; names below are source examples,
not host tool bindings. No new evaluation, monitor, invocation or connection is
authorized. Supplied-evidence mode does not execute this resolution flow.

1. Resolve the Foundry project endpoint and agent with the Foundry tools.
2. Read project connections, scheduled evaluation definitions/runs, and Agent
   Insights when its monitor exists.
3. Query `gen_ai.evaluation.result` and agent/model/tool spans in the linked
   Application Insights component.
4. Correlate evaluations and the developer-selected tool path by trace ID.
5. When a Foundry conversation ID is available, use it to resolve one
   representative Application Insights event. Capture the event `itemId`,
   `operation_Id`, timestamp, and source table, then run
   the shared health transaction-link helper described in
   [portal links](portal-links.md) to create the end-to-end
   transaction link. Do not put the conversation ID directly into a guessed
   portal route.
6. Expand into Azure Monitor dependency and infrastructure evidence only for
   the selected path.
7. Retain agent/project identifiers, existing evaluation context and separate
   correlation IDs so investigation remains scoped to the requested agent.

Useful read-only capabilities include:

- Foundry `agent_get` and `agent_insights_get`;
- Foundry evaluation definition and run retrieval;
- Foundry `project_connection_list` and `project_connection_get`;
- Azure Monitor resource log queries, metrics, activity logs, and alerts.

## Triage evidence

Inspect failed and slow runs, exceptions, downstream dependencies, model and tool
calls, correlated traces, latency, token signals, throttling, content-safety
outcomes, and recent project/agent configuration changes. Use telemetry timestamps
or the user's described incident time.

If no linked Application Insights component or other Azure Monitor telemetry can
be resolved, continue with supplied Foundry-specific and generic Azure
Diagnostics evidence and report the telemetry gap. Do not create a connection.

`agent_insights_get` can report that no Agent Insights monitor exists. Treat that
as a non-fatal **Insights** coverage gap and continue with scheduled evaluation
runs and linked Application Insights result events. Do not misclassify it as
missing evaluation coverage. Never use broad Function/App Service app-settings
enumeration as a configuration shortcut because it can return secrets; prefer
deployment source, runtime evidence, or a targeted redacted read.

Some Function surfaces require resource-group read permission before accepting a
known site name. If that prerequisite is denied, do not repeat the lookup:
preserve the exact Function ARM ID, report the permission gap, and use correlated
workspace telemetry for the runtime investigation.
