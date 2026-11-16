---
name: troubleshoot-observability
description: "Coordinate read-only Azure application or agent troubleshooting, approved fixes, and recovery. WHEN: 'investigate end to end', 'troubleshoot observability', 'plan monitoring or alerting'."
license: MIT
metadata:
  author: Awesome Copilot Community
  version: "0.0.0-placeholder"
---

# Azure Observability Skill Plugin

Copilot chooses the next useful step; available tools execute approved operations.
This is instruction-guided routing, not a diagnostics engine or permission sandbox.

## Current-request intent gate

On every user turn, before any journey header, diagram, discovery, onboarding
question or read, confirm a current operational observability request. "My API
is slow", an actual failure (including a failed deployment), or explicit
instrumentation/collection/alert design qualifies, including before deployment.
Conceptual questions get direct answers. Generic coding, creation, deployment
readiness, cost and unrelated topic switches get no journey, tools or onboarding.
Prior context is not sticky; clarify only genuinely ambiguous operational intent
with one minimal question. Explicit specialist requests stay direct.
Read [intent details](references/intent.md) only for an ambiguous admission decision.

## Standalone availability gate

For an admitted task, check availability before reading any cross-skill reference
or loading a sibling. Individual installation may omit them.
Use available shared instructions unchanged in the bundle; their use below is conditional.
Unknown availability follows the missing-reference fallback.
Never download, install or attempt a mandatory missing sibling-file read.
Retain scope/window, evidence and budgets; report the precise handoff blocker and
smallest supported manual next step. Do not claim an absent specialist executed.

## Select one path

Load only the applicable guidance below, not every reference.

| Current need | Instructions to select |
|---|---|
| Find telemetry or resolve missing target/source | Available `connect-observability` |
| Broad health | Available `assess-observability-health` |
| Completed ranked health, no finding selected | Ask for selection; never auto-select rank 1 or reassess |
| Named alert, failure, slow operation or selected finding | Available `azure-diagnostics`; `microsoft-foundry` for AI-specific evidence |
| Missing scope/access or a live-read plan | [Scope and permissions](references/scope-permissions.md) |
| Specialist handoff or additional capability need | [Selection](references/selection.md), then only the relevant matching/setup/trace contract |
| Evidenced issue: what should I do? | [Next actions](references/next-actions.md): supported fix, mitigation, PR/config proposal or alert/collection prevention |
| Effective change: did it work? | Available `verify-observability-fix` with supplied comparable evidence |
| Recovery verdict: how do I keep watching? | [Monitoring follow-up](references/monitoring-follow-up.md) |
| Explicit setup/design | Applicable available specialist; no invented gap or implicit provisioning |

## Boundaries and presentation

Reuse confirmed source/schema, UTC window, selected findings and consumed/remaining
budgets. Supplied evidence needs no cloud, installation, scripts, jobs or saves.
Discover actual operations and access; no guessed tool names or topology.
Missing/denied/empty/stale/partial/failed/throttled evidence remains distinct;
insufficient evidence is INCONCLUSIVE, and correlation is not causation.
Reads, sensitive content, connections/sign-in, edits/persistence, jobs/traffic
and deployment/alert/infrastructure changes retain separate applicable approvals.
A "continue" retains only covered unexpired consent; honor stops and declines.

For an already coordinated journey, keep source bounds and actual **Using:** /
**Stage:** at the top; locally inspected guidance uses **Instructions read:** and
**host activation unverified**. Show **Discovered:** only for relevant capabilities
actually found; discovery/loading is not execution. Use the
[indicator](references/journey-indicator.md) only on entry or a meaningful transition.
Apply [next actions](references/next-actions.md) at a substantive result or plan
review: explain missing source or the exact next action and separate approval.
Report planned tools separately from actual outcomes, skips and fallback.

Remediate means options and a reviewed plan, not automatic changes. Validate
means recovery comparison first, then optional monitoring; dashboards, quiet
alerts, deployment success and better evaluation scores are not recovery proof.
No dashboard or monitoring setup is required. Runtime/host behavior remains
unverified by offline instruction tests.
