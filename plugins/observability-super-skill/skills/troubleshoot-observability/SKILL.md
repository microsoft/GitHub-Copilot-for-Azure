---
name: troubleshoot-observability
description: Coordinate Azure observability troubleshooting for application or agent health, runtime failures, operational latency, telemetry, monitoring, alerts, evidence-backed fixes and recovery. Use for an end-to-end observability investigation or explicit instrumentation, collection or alerting guidance. Not general resource/app/agent creation, model deployment, RBAC, cost or coding. Conceptual questions need no journey; explicit specialist requests stay direct. Actions require applicable approval.
license: MIT
metadata:
  version: "0.0.0-placeholder"
---

# Azure Observability Skill Plugin

This is the thin entry point for the observability journey, not a new diagnostics
engine, background monitor, or deterministic sibling-skill API. Specialists remain
independently usable. The host loads instructions and controls tool execution and
approvals. These instructions do not enforce permissions.

## Standalone availability gate

For an admitted task, check availability before reading any cross-skill reference
or loading a sibling. Individual installation may omit them. Use available
shared instructions unchanged in the bundle; their use below is conditional.
Unknown availability follows the missing-reference fallback.
Never download, install or attempt a mandatory missing sibling-file read.
If a required specialist is absent, preserve the confirmed scope/window,
selected evidence and remaining budgets, report the precise capability blocker
and offer the smallest permitted manual next step using current capabilities.
Do not invent a replacement specialist, reset onboarding or claim its execution.
This coordinator remains thin; no new standalone service or automatic reads,
setup, edits or recovery certification are implied.

## Current-request intent gate — before presentation or operations

Apply this gate on every user turn **before any journey header, diagram,
capability discovery, onboarding question or read**. Loading this skill does
not establish that the current task belongs to the observability journey.

- Enter only for a current request about observability, telemetry, monitoring,
  alerting, application/resource/agent health, diagnosis of an actual failure
  (including a failed deployment), operational application latency/performance,
  or recovery from an evidenced incident. Natural language such as "my API is
  slow" qualifies without tool names or the word observability. A generic "fix"
  or "slow" outside application/operational context does not.
- Explicit instrumentation, collection or alert setup/design is in scope even
  for a new application. Offer the relevant design/setup workflow without
  requiring a deployed target or inventing an existing gap. The request is not
  permission to provision, edit, install or enable anything.
- Answer conceptual observability questions directly. Do not start a journey,
  force application onboarding, discover tools or request resource identifiers
  merely to explain monitoring, tracing, alerts or instrumentation.
- Resource-group/resource creation, building a new app or Foundry agent, model
  deployment, RBAC, subscription, cost, general coding and documentation tasks
  do not qualify without an explicit observability purpose or actual diagnostic
  question. Do not turn routine deployment readiness into diagnosis.
- If incidentally loaded for an unrelated task, emit no observability **Using**,
  **Stage**, **Discovered**, journey stepper or observability questions/tools.
  Continue the normal task or let an appropriate available workflow handle it
  without invoking this coordinator. Preserve normal task/host approvals.
- Prior investigation context is not sticky: a topic switch ends journey
  presentation immediately. Resume only on a relevant current request; an
  unambiguous in-scope "continue" can retain the existing limits. Clarify only
  genuinely ambiguous operational intent with one minimal question, without
  a header, diagram or reads; do not interrogate every resource-creation task.
- Honor an explicit applicable specialist request directly. Do not load this
  coordinator just to add presentation or run a mandatory end-to-end sequence.

The presentation and routing rules below apply only after this gate admits an
actionable observability request and this coordinator is actually selected.

At the top of each substantive in-scope journey answer, show **Using:** with only the
actual host-loaded skills being followed for this step, plus **Stage:**.
Include relevant skills from other plugins or supported skill locations, not
just the six bundled skills. Do not list the history of every loaded skill.
If instructions were only read locally, use **Instructions read:** and
**host activation unverified**, not **Using:**. Loading is not tool execution.
Follow [capability discovery and approval](references/acquire-capability.md)
for a scenario-relevant **Discovered:** label and the next permission decision.
Keep this compact header above the journey indicator; neither proves execution.
Apply [result and plan presentation](references/next-actions.md) before the
substantive investigation result or accepted plan review, including when a
specialist answers within this already coordinated journey. Preserve evidence
depth and source bounds; do not leave the Remediate stage/indicator at the end.

Use these customer-facing stage labels while retaining the actual skill names
for loading instructions:

| Role / stage | Customer-facing name | Execution boundary |
|---|---|---|
| Foundation | Connect your application | Confirm deployment, telemetry association and task-specific access; not provisioning or instrumentation setup |
| Detect | Detect health issues | Assess existing signals or accept an existing alert/symptom; not a new continuous monitoring service |
| Investigate | Investigate the affected path | Follow relevant correlated application, dependency and infrastructure evidence; use Foundry only for applicable AI-specific work |
| Remediate | Guide an approved fix | Use an eligible existing change workflow with separate approvals for edits, jobs and deployment; no automatic production changes |
| Validate | Validate recovery | Compare customer-outcome and guardrail evidence after an actual change; deployment success or better evaluation scores alone are insufficient |

Azure Monitor is the operational observability foundation. Foundry is an
optional AI-specific branch, not a prerequisite for web/API or all AI workloads.
These stage labels do not add skills or rename identifiers. Enter the next
necessary stage; do not force every request through all four.

Read [the inline journey indicator](references/journey-indicator.md) for a
journey entry or meaningful stage/status transition. Show its compact rounded
Mermaid stepper in the response without requiring the developer to request it.
Use its text fallback when rendering is unavailable; presentation never
authorizes operations or implies completed stages.

Read [the handoff contract](references/handoff.md) and
[specialist selection](references/specialists.md) before delegating work. Use
[the journey coverage guide](references/journey-coverage.md) only for the affected path;
do not sweep every Azure service.

## 1. Choose the next necessary stage

Honor an explicit specialist request. Otherwise select from the user's intent
and retained evidence, not from a fixed sequence:

| Request or retained state | Next necessary stage |
|---|---|
| "Find this app's telemetry" or missing target/source for an admitted observability request | Connect your application using `connect-observability` |
| Current application/resource/agent health question | Detect health issues using an eligible existing health specialist |
| Completed ranked assessment with no finding selected for investigation | Ask the developer to choose a finding; retain the assessment instead of running health again |
| Developer-selected finding from a completed assessment | Investigate that finding using its retained specialist state, scope and evidence |
| Named operational alert, trace, runtime/tool failure, failed deployment diagnosis or slow application operation | Investigate the affected path directly after minimum scope/access checks |
| Explicit collection/instrumentation/alert setup or design request, or an established relevant gap | Select one applicable design/setup specialist; no deployed-target prerequisite for design and no implicit provisioning approval |
| Proposed fix or optimization tied to an observability finding | Guide an approved fix: review the evidenced hypothesis and use the applicable existing change workflow |
| "Did the fix work?" for a known incident/change | Validate recovery using `verify-observability-fix`; request missing evidence, not another deployment |

For "my agent is slow", do not automatically start evaluation, optimization,
deployment, instrumentation setup, or a broad health sweep. First identify the
customer-visible symptom and the narrow affected path.

For trace/population latency questions, follow
[operation-based trace selection](references/trace-capabilities.md). Prefer an
existing sufficient authorized server-side analysis; do not force a new MCP,
bulk retrieval or local percentile/critical-path reconstruction.
For missing parents/handoffs, compare filtered-query coverage with exposed
Azure Monitor TraceStore retrieval organically; no developer tool name,
standalone server or advanced-analysis gap is required. Offer only the smallest
applicable approved check/lookup and reuse fresh confirmed source/schema facts.
For a material unresolved trace cap/parent/correlation issue, show the shared
**Trace capability decision** before asking for the next evidence pass or budget.
Once per material issue, explain existing-path sufficiency, candidate availability/
eligibility uncertainty and the bounded choice; do not defer it to cloud checks.

## 2. Establish scope and permissions once

Make this a guided conversation, not a prompt-writing task. An ordinary symptom
or "end to end observability" request should be sufficient to begin once the
intent gate passes; neither is a guaranteed
host trigger. The developer supplies missing facts, meaningful choices and
approvals, not skill names, query recipes or repeated safety paragraphs.
Keep the current task, confirmed identifiers, association provenance, schema,
UTC window, consumed/remaining budgets and approval exclusions in conversation
across specialist handoffs. A short "continue" reuses only the existing unexpired
permission; it never grants new operations or expands scope.

When a lab/application workspace is open, inspect permitted nonsecret deployment
context before asking the developer to copy identifiers. Load available
`connect-observability` instructions for scope resolution and query routing;
do not assume its resources exist relative to this independently usable skill.
With no workspace or retained context, ask one plain-language target question.
Do not require the developer to paste a deployment manifest or a large prompt.

Propose one concise approval covering the next useful bounded read pass:
exact target/source, window, question, metadata/query/row limits, any allowed
single schema correction and exclusions. Count schema reads and failed queries
inside the query budget. Distinguish a corrected query from automatic transport
retries, but do not perform either when explicitly prohibited. If a stricter
approval disallows correction, ask only for that one missing permission.
Do not ask again for already approved in-scope operations, nor make the
developer restate the complete plan. Host tool approvals remain in force.

For a lab setup followed by investigation, retain the approved deployment
outputs and actual version in conversation so that the next stage does not
restart discovery. New provisioning, traffic, edits, deployment and cleanup
still need separate operation-specific approval. After identifying an affected
path, reuse known change context; if it is missing, ask whether a relevant
change occurred before proposing more telemetry reads. Local configuration is
an explanatory candidate, never proof of effective deployed settings or recovery.

Use plain language in developer questions: say "existing evidence with sensitive
details removed", not unexplained "sanitized evidence". Ask for the smallest
missing decision or fact, not a bundle of telemetry-engineering inputs.
When a live investigation is requested with approval before access, propose
the bounded read-plan path rather than ask the developer to choose it again.
Offer supplied evidence as an alternative when relevant; never treat that
default proposal as permission to discover schemas or execute reads.

Reuse confirmed application/environment, deployment/resource/source identifiers,
association provenance, approved identity, and unexpired evidence. Ask before
choosing between plausible targets. Names and repository hints are not deployment
proof. Revalidate changed resources or expired access without restarting all
onboarding.

Agree the observation window, expected activity, freshness, original symptom and
acceptance criteria where a verdict requires them. Unknown SLOs permit reporting
measurements, not invented pass/fail thresholds. Preserve tools-only mode when no
approved helper interpreter exists.

Separate consent for:

- bounded reads of the confirmed sources;
- sensitive trace/profile/snapshot or prompt content;
- new integrations, authentication changes or dependency installation;
- local edits and local persistence;
- evaluation jobs, agent/tool invocation or synthetic traffic;
- deployment, capacity, infrastructure, alert or collection changes;
- external-service investigation creation and server-side persistence.

Permission for one item is not permission for the others. If the user prohibits
Azure queries, use only permitted retained/user-supplied evidence. A resource ID
or "build this plugin" does not authorize reading that resource. Do not retry
denied access under another identity.

## 3. Select and load one applicable specialist

Use the eligibility and fallback rules in
[specialist selection](references/specialists.md). For conditional instrumentation,
collection, Grafana, design, trace-source or entity-health needs, Copilot follows
[capability matching](references/matching.md): establish the need, check fit and
availability separately, then explain the smallest permitted next action.
If the matching capability is missing, follow
[approved capability setup](references/acquire-capability.md): offer its reviewed
setup path and resume after approval and actual availability checks. For missing
Azure operations, load `connect-observability` for Azure MCP setup. Do not stop at
an inventory link when a supported next action is available. Setup is optional
and never implied by permission to investigate.
Before execution, state the
selected skill/workflow, planned operation categories, retained scope, and blockers
briefly. Inspect actual tool descriptions/schemas, access and dependency
requirements. Do not install a missing specialist or fetch upstream instructions
automatically.

Use the host's supported skill-loading mechanism when available. Resolve the
actual installed command/name; plugin prefixes can differ. If permitted local
instructions are readable but not host-loadable, read the complete entry point
and relevant resources and label the use **instructions read, host activation
unverified**. If neither is possible, stop that branch with its concrete
prerequisite. Skills from other enabled plugins or supported project/personal
locations can be selected; the six bundled skills are not a closed registry.
A name, registry entry, slash command written in prose or upstream link is not
execution. Skill loading adds guidance; it does not inherently create another
agent or authorize service delegation.

Return a completed sufficient finding without redundant delegation, then apply
[the result-to-next-action contract](references/next-actions.md). Explain
selection using scenario fit, required capability, verified access and side
effects. For an existing
connected SRE Agent, use the [shared recommendation-only contract](references/specialists.md#optional-existing-sre-agent):
verified connected/source proof plus a specific advantage for an unresolved
question may justify one review/continue choice, not service execution.
Review acceptance grants no new reads, transfer, thread or persistence.
Explicit SRE requests enter review directly; retain all scope, stops and budgets.

Use stable `assess-observability-health` for ordinary health: contributed guidance
and public-source routing are integrated into one assessment. Honor explicit
eligible external specialist requests; no automatic separate health preference.
Do not run competing assessments. Never call back into this coordinator merely
to select the same specialist. Return a result or a specific missing prerequisite.

## 4. Carry evidence through investigation and approved change

Keep the [handoff](references/handoff.md) in the conversation by default.
Preserve source/query labels, UTC times, units, denominators, sampling,
completeness, facts versus hypotheses, and actual correlation identifiers.
Do not assign evidence by completion order or invent topology.

For an existing health assessment, follow the [health continuation boundary](references/specialists.md#continue-from-an-existing-health-assessment).
Preserve the specialist's original finding rank/state and the developer's
selection. A recommendation or highest rank is not consent to investigate.
Do not run a second assessment to translate the first specialist's output.

Use the relevant specialist for a bounded investigation. If unavailable, explain
the gap and the next supported step; do not label a health summary as completed
RCA. A demonstrated downstream failure can be reported despite other gaps.
Coincident deployment/CPU changes are not proven cause.

After presenting material investigation evidence, follow
[the result-to-next-action contract](references/next-actions.md): name the
smallest supported change and offer plan review with one concise question.
After a completed supported plan, apply that contract's implementation step:
ask for missing source or propose the exact minimal edit for separate approval.
Do not jump from a plan or local edit to deployed recovery.
If cause remains materially unresolved, propose the smallest missing evidence
instead. A read-only diagnosis may offer planning, never execute a change;
explicit stop/no-follow-up and retained decisions govern continuation.
Optional [visual evidence](references/visual-evidence.md) must not compete with
that question; defer a new inline/Grafana offer. Honor an explicit visual request
at any stage and retain an existing choice/decline instead of repeating it.
Dashboard creation needs separately approved persistence/write access and a
confirmed existing AMG instance/datasource. Missing Grafana must not block
diagnosis, trigger provisioning or cause unrelated reads to fill panels.

For a proposed fix, identify the supporting evidence, target version, smallest
change, risks, acceptance criteria and rollback plan. Reuse existing Foundry
evaluation/optimization or application/deployment workflows where eligible.
Review their prerequisites and side effects before starting. Read-only remains
the default. Ask for the applicable approval before editing, creating a job,
generating traffic or deploying. Do not weaken evaluators or remove difficult
test cases to manufacture improvement.

## 5. Verify the customer outcome, then report

After an approved change has actually occurred, proactively offer bounded
comparison under [the result-to-next-action contract](references/next-actions.md).
Confirm the change is effective in the scope being verified: a local edit alone
cannot support deployed recovery; local-only fixes need no cloud deployment.
Reuse an already accepted verification request, otherwise ask one concise
question before comparison. A yes permits no new reads, jobs or traffic. Select
`verify-observability-fix` with the original symptom, changed version/time,
comparable evidence, agreed criteria, and existing deployment/evaluation results.
Do not rerun or create evaluations just to complete a report.
If only a plan exists, stay at Guide an approved fix. Missing/stale supplied
evidence requires the minimal missing input or separately approved collection,
not a fabricated recovery result.

Deployment success, HTTP 200, quiet alerts and a better evaluation score are
supporting facts, not sufficient recovery proof. Missing, stale, idle, partial,
noncomparable or denied required evidence yields INCONCLUSIVE. Report observed
failures without masking them behind unrelated missing evidence.

Return:

1. What is known about the customer's symptom and affected scope.
2. The current stage and evidence-backed finding/verdict, with explicit gaps.
3. What happened: instructions read/host-loaded, operations executed, retained
   evidence used, side effects approved, and fallback or skipped steps.
4. The next bounded action and any approval needed, or the recovery result.

Do not turn every answer into a contributor-credit table. Execution provenance
is for truthful reporting and debugging, not ceremony. Never claim all stages
ran when only instructions were read or offline fixtures were tested.

See [host acceptance tests](references/host-tests.md) and
[synthetic acceptance cases](references/acceptance.json). These are test
specifications, not evidence that a host has passed them.
