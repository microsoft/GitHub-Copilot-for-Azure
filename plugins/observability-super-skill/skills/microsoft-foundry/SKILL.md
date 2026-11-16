---
name: microsoft-foundry
description: "Investigate existing Foundry agents using supplied evidence or approved bounded reads. WHEN: 'investigate agent traces', 'diagnose model or tool failures', 'review existing evaluation evidence'."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Microsoft Foundry Skill

## Current-request intent gate

Start only for current telemetry, monitoring, runtime failure, application latency
or recovery intent. "My agent is slow" qualifies in runtime context.
Answer conceptual questions directly without tools or onboarding.
Clarify genuinely ambiguous operational intent with one question before reads.
Unrelated creation/coding and topic switches end the wrapper; prior investigation
is not sticky. Explicit specialist use stays direct, without forcing a coordinator.
Instrumentation/design may precede deployment but grants no setup permission.
Explicit lifecycle tasks stay separate, without the wrapper.
Incidental loading is not selection.

## Standalone availability gate

Check availability before cross-skill reads; unknown means unavailable.
No mandatory missing sibling-file read. Stay local. Never install/download siblings.

## Core execution boundaries

Reuse the coordinator's confirmed target, agent/version/environment, sources,
UTC window, symptom, evidence and approvals. Analyze supplied sanitized evidence
in memory without tools: no Azure, no Python, installs, authentication, cache,
local writes or jobs. No dependency check or setup script runs on load.
Missing evidence is INCONCLUSIVE, not healthy. Observations are not causation.

Before live reads, state workflow, scope, discovered operation/schema, budgets,
access and blockers. Loading is not query approval.
Keep unsupported, missing, denied, empty, stale, throttled, failed, truncated and
partial results distinct. No identity changes, broad environment dumps, automatic
polling, invocation or fallback jobs. Sensitive content, traffic, persistence,
edits, deployment and every lifecycle action require separately approved tasks
and operation-specific approval; local edit approval never permits deployment.
These boundaries supersede conflicting automatic actions in retained examples.

## Select only the needed guidance

Load only the selected workflow/section, not every reference. Retain prerequisites
and inputs from reached steps; missing prerequisites block an operation:
- Existing trace evidence -> [trace](foundry-agent/trace/trace.md).
- Runtime symptoms -> [troubleshoot](foundry-agent/troubleshoot/troubleshoot.md).
- Existing evaluation results -> [analysis](foundry-agent/observe/references/analyze-results.md),
  never the full evaluation/optimization loop.
- Existing generated insights, when useful -> [insights](foundry-agent/insights/insights.md).
- Live operations -> selected [boundaries](references/execution-boundaries.md).
- Explicit lifecycle selection -> [workflows](references/lifecycle-navigation.md).

<a id="additional-resources"></a>
<a id="agent-agent-types"></a>
<a id="agent-common-project-context-resolution"></a>
<a id="agent-development-lifecycle"></a>
<a id="agent-foundry-workspace-standard"></a>
<a id="agent-setup-references"></a>
<a id="azd"></a>
<a id="azure-authentication"></a>
<a id="dependency-check-and-setup"></a>
<a id="evidence-first-entry"></a>
<a id="foundry-mcp"></a>
<a id="infrastructure-lifecycle"></a>
<a id="network-isolation-errors"></a>
<a id="pre-execution-requirements"></a>
<a id="step-1-discover-agent-roots-and-azd-context"></a>
<a id="step-2-resolve-environment-and-deployment-context"></a>
<a id="step-3-select-metadata-overlay-and-resolve-environment"></a>
<a id="step-4-resolve-evalyaml-local-evaluation-intent"></a>
<a id="step-5-resolve-common-configuration"></a>
<a id="step-6-write-metadata-overlay-createdeployobserve-only"></a>
<a id="step-7-collect-missing-values"></a>
<a id="sub-skills"></a>
<a id="tool-usage-conventions"></a>
<a id="workflow-guidance"></a>

- Details -> [entry guidance](references/entry-navigation.md).

## Conditional shared contracts

When present, use shared [trace capability selection](references/shared/trace-capabilities.md)
only for the selected trace question, [SRE review](references/shared/specialists.md#optional-existing-sre-agent)
only for a material unanswered operational question with existing connected/source
proof and a specific advantage, and [next actions](references/shared/next-actions.md)
after substantive findings or accepted plan review, including direct use.
Preserve coordinated presentation, approval limits, stops and declines.
An approved change permits offering supplied-evidence recovery comparison, not
claiming recovery. Missing shared guidance: stay local, expose gaps and offer the
smallest evidence or supported fix/rollback plan-review question. Skip SRE without
its contract; missing diagnostics/comparator guidance blocks handoff.
Distinguish host loads, executed operations and fallback.
