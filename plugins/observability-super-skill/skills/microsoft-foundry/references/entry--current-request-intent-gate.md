# Selected guidance: Current-request intent gate

> Reading grants no execution approval. Apply the entry's current-request
> intent and standalone availability gates. Analyze supplied evidence in
> memory: no Azure, Python, installs, auth, cache, writes or jobs required.
> Live reads require approved scope/window, verified operations/schemas and
> finite budgets; missing/denied/empty/partial evidence stays distinct and
> insufficient evidence is INCONCLUSIVE. Lifecycle actions, sensitive content,
> traffic, persistence, edits and deployment need separate explicit approval.
> These rules supersede conflicting automatic actions in retained examples.

[Execution boundaries](../references/execution-boundaries.md) apply; load only the boundary
section needed by the selected action, never every linked reference.

Before any journey header, diagram, discovery, onboarding question or read,
confirm a current observability, telemetry, monitoring, alerting, operational
health/failure diagnosis, application latency or incident-recovery request.
"My agent is slow" qualifies without tool names in a runtime context; generic
"fix"/"slow" outside application/operational context does not.
Answer conceptual observability questions directly, without onboarding or tools.
Explicit instrumentation/collection/alert setup or design is relevant before
deployment; select an applicable design/setup workflow rather than demanding a
deployed agent. No permission to provision, install or edit follows.
Resource/app/agent creation, model deployment, RBAC, subscription, cost and
general coding/docs do not start an observability journey absent explicit
observability intent or actual failure diagnosis.
If incidentally loaded, continue the normal task or appropriate available
workflow with normal approvals: no observability labels, stepper, tools/questions
or coordinator invocation. A topic switch ends presentation; prior investigation
is not sticky. Resume only on a relevant current request. Clarify only genuinely
ambiguous operational intent with one minimal question before presentation/reads.
An explicit specialist request stays direct; no forced coordinator.

The packaged discovery description intentionally advertises only observability.
All upstream lifecycle instructions and scripts remain available: an explicit
broader Foundry lifecycle/resource request may select the corresponding retained
workflow separately with normal operation-specific approvals, **without an
observability wrapper or coordinator**. The tables below are reference navigation,
not broad automatic triggers. Incidental loading is not lifecycle selection.

After this gate admits a task or the developer explicitly selects a retained
separate lifecycle workflow, read the
[execution boundaries](../references/execution-boundaries.md) before that workflow;
they supersede conflicting upstream MUST, automatic setup, persistence, polling,
invocation and deployment instructions throughout this directory. The
[provenance](../references/provenance.md) records the source and local adaptations.

