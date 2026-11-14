# What is Azure Observability Skill Plugin?

Azure Observability Skill Plugin is an experimental GitHub Copilot plugin for
investigating existing Azure web applications, APIs, and Microsoft Foundry
agents. It connects six skills into a guided troubleshooting journey while
keeping each specialist independently usable.

Azure Monitor is the operational foundation. Foundry is an optional branch for
agent, model, and tool questions, not a requirement for web/API investigation.

## Choose the next useful stage

Start with the question you need to answer, not a required sequence.

| Stage | What Copilot helps you do |
|---|---|
| Connect your application | Confirm the deployment, telemetry association, and task-specific access. |
| Detect health issues | Assess bounded evidence and rank findings and coverage gaps. |
| Investigate the affected path | Follow a named symptom or a finding you select, without repeating health assessment. |
| Guide an approved fix | Review an evidence-backed change, its risks, verification criteria, and rollback plan. |
| Validate recovery | Compare supplied original and post-change evidence after an actual approved change. |

A slow request can go directly to investigation. A general health question can
start with assessment. You select which ranked finding to investigate.
Conceptual questions don't require onboarding, and general creation or coding
tasks don't start an observability journey without that purpose.

For explicit instrumentation, collection, or alert design, Copilot can identify
relevant guidance before deployment. That selection doesn't authorize setup or
configuration changes.

## How the plugin works

The developer confirms the target, selects meaningful choices, and approves
applicable actions. Copilot selects and loads instructions, interprets evidence,
and proposes the next bounded step. Existing tools execute operations. The host
manages tool invocation, credentials, and approval controls.

Handoffs retain the confirmed application, source association, UTC window,
evidence provenance, selected finding, remaining budgets, approvals, and declines.
Moving to another skill doesn't renew permissions or start a new query budget.

The package includes instructions and optional local helpers. It doesn't include
a telemetry backend, an MCP server, or automatic production remediation.
See the [included skills](../README.md#included-capabilities).

## Use the smallest sufficient capability

Copilot first compares the question with supplied evidence and existing
authorized operations. Scenario fit, tool availability, source eligibility,
schema, and access are separate checks. A documented capability isn't proof
that a connected tool can execute it.

### Trace Store and distributed traces

For missing parent spans, disconnected handoffs, or other material trace
retrieval gaps, Copilot compares the current retrieval with relevant exposed
Trace Store operations before proposing more evidence collection.
You don't need to ask for a particular MCP server.

Microsoft documents two alternatives:

- Azure MCP Server's Monitor route with Trace Store operations.
- A local Azure Monitor trace MCP server with its own operation contract.

A separate server isn't required for the Monitor route. Feature parity,
including dedicated critical-path or top-attribute analysis, isn't assumed.
Sufficient authorized KQL or an equivalent API remains a valid choice.

New-source reads require applicable approval. Source/schema facts can be reused
when still valid. An Application Insights operation ID is only a candidate
Trace Store trace ID until identity and correlation evidence establish a match.
Additional retrieved parents don't prove those spans were absent from the
earlier source.

See [trace capability routing](../skills/troubleshoot-observability/references/trace-capabilities.md)
and [Query Azure Monitor traces with an MCP server](https://learn.microsoft.com/azure/azure-monitor/app/traces-mcp-server).

### Existing connected SRE Agent

Copilot may recommend reviewing an existing SRE Agent only when verified
connection, relevant configured coverage, and a specific advantage support
its use for an unresolved investigation question. Tool visibility, a running
agent, incident complexity, or denied telemetry alone isn't enough.

The choice is **Review SRE option / Continue direct**. Accepting review opens
plan review only; it grants no new reads, delegation, service execution,
thread creation, evidence transfer, or persistence.

Before any service execution, the actual operations, identity, access, effective
action restrictions, and exact data handling must be verified. Unknown or
unenforceable controls block execution. A read-only prompt isn't a permission
sandbox. Copilot retains the direct path when sufficient, declined, or blocked;
it doesn't provision an agent or create connections to make the option fit.

See the [shared SRE contract](../skills/troubleshoot-observability/references/specialists.md#optional-existing-sre-agent).

### Other optional capabilities

| Capability | When it can help | Boundary |
|---|---|---|
| AppLens or Resource Health | An affected platform or availability question remains. | Inspect the actual operation, scope, access, and side effects. |
| Instrumentation or collection guidance | You request design/setup or evidence establishes a collection gap. | Empty or denied results alone don't establish a gap. Changes need approval. |
| Inline evidence view or Azure Managed Grafana | You want to visualize existing findings. | Rendering, saves, datasource queries, and dashboard writes retain applicable approvals. |
| Foundry evaluation and lifecycle workflows | You explicitly request an eligible task. | Analysis of existing results doesn't authorize new jobs, invocation, or deployment. |

These capabilities aren't all bundled or verified integrations. A blocked option
doesn't prevent useful analysis of evidence you provide.

## Understand permissions

Read-only investigation is the default instruction path. It doesn't enforce
service permissions or replace host controls. Keep tool approvals and
least-privilege access enabled.

Approval for one category doesn't authorize another:

- Bounded metadata or telemetry reads.
- Sensitive trace, prompt, or response content.
- Setup, dependency installation, sign-in, or a new connection.
- Local scripts, edits, or file persistence.
- Agent invocation, evaluation jobs, or synthetic traffic.
- Deployment, capacity, infrastructure, alert, or collection changes.
- External investigation creation, evidence transfer, and server-side persistence.

Reviewing a fix plan isn't permission to edit. A local edit isn't deployment.
A deployment success isn't proof of recovery. The recovery skill compares
supplied evidence; it doesn't collect telemetry, deploy, or run evaluations.

## Interpret results

Reports should identify the source, UTC interval, units, denominators, sampling,
completeness, and known gaps. Metadata access doesn't establish telemetry access.
Missing, denied, empty, stale, failed, throttled, and partial results must remain
distinguishable.

Insufficient required evidence yields **INCONCLUSIVE**. Health and recovery
claims require relevant outcome evidence and agreed criteria, not quiet alerts
or successful HTTP responses alone. Correlation isn't causation.

## Current support

Version **0.3.38** follows the Awesome Copilot in-repository source composition
layout. It is not a published marketplace entry or an officially supported
Microsoft product. Receiving-repository validation and license acceptance remain
release gates.

| Evidence | What it establishes |
|---|---|
| Offline package and fixture tests | File integrity, local links, instruction contracts, and mocked helper behavior. |
| A supplied user-directed VS Code Trace Store lookup | Partial retrieval improved coverage for one matched operation. Aggregation failed; advanced analysis wasn't tested. |
| Fresh installed-candidate host checks | Still required for registration/loading, natural-language routing, handoffs, rendering, and an independent end-to-end journey. |

Natural Trace Store selection and proactive SRE recommendations aren't proven
by the directed retrieval observation or synthetic tests. SRE execution also
remains unverified. Test VS Code and Copilot CLI independently; portability isn't
verified compatibility.

The six skills include integrated contributed health assessment and two adapted
Microsoft specialists with retained resources and notices. See
[attribution and reuse](../README.md#attribution-and-reuse) and the dedicated
provenance records for source pins, permissions, and modifications.

## Next steps

- [Install and investigate a symptom in VS Code](quickstart-vscode.md).
- [Resolve installation, access, or evidence problems](troubleshoot.md).
- [Review host acceptance cases](../skills/troubleshoot-observability/references/host-tests.md).
