# Selected guidance: Sub-Skills

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

This skill retains all upstream workflows. Only the evidence-first paths above
are part of the coordinator journey. Create/train, resources/RBAC, deployment,
traffic/invocation, optimization, dataset harvesting, jobs, continuous evaluation
and CI/CD require an explicit new task/scope and operation-specific approval.
Read the relevant workflow only after selecting it; its steps remain subject
to the execution boundaries. Retention is not execution approval.

| Sub-Skill | When to Use | Reference |
|-----------|-------------|-----------|
| **deploy** | Deploy hosted agents to Foundry, smoke-test a deployment, create or update prompt agents, and manage agent versions and multi-environment deploys. | [deploy](../foundry-agent/deploy/deploy.md) |
| **cicd** | Set up a CI/CD deployment pipeline for a Foundry agent. | [cicd](../foundry-agent/cicd/cicd.md) |
| **invoke** | Send messages to an agent, single or multi-turn conversations | [invoke](../foundry-agent/invoke/invoke.md) |
| **routine** | Schedule or event-trigger Foundry agents with routines; use `azd` for CRUD, enable/disable, manual dispatch, and viewing past runs, or define routines in `azure.yaml`. | [routine](../foundry-agent/routine/routine.md) |
| **invocations-ws** | Build, deploy, and connect to custom Hosted agents that use developer-defined duplex real-time or media streams over `invocations_ws`. | [invocations-ws](../foundry-agent/invocations-ws/invocations-ws.md) |
| **observe** | Evaluate agent quality, run batch evals, analyze failures, optimize prompts, improve agent instructions, compare versions, set up CI/CD monitoring, and enable continuous production evaluation | [observe](../foundry-agent/observe/observe.md) |
| **insights** | Pull generated agent insights, evidence, and recommendations from an existing monitor; read-only retrieval, not a new analysis run | [insights](../foundry-agent/insights/insights.md) |
| **trace** | Query traces, analyze latency/failures, correlate eval results to specific responses via App Insights `customEvents` | [trace](../foundry-agent/trace/trace.md) |
| **troubleshoot** | View hosted agent logs, query telemetry, diagnose failures | [troubleshoot](../foundry-agent/troubleshoot/troubleshoot.md) |
| **validate** | Use only when the user explicitly asks to use this validation sub-skill or to validate Microsoft Foundry hosted-agent code against best practices. Never invoke it proactively or add it to another workflow. | [validate](../foundry-agent/validate/validate.md) |
| **create (quick start)** | Create a new hosted Foundry agent from scratch end-to-end — scaffold, provision or use an existing Foundry project, deploy, and smoke-test. Do not use for any work on existing code. For anything not covered by the quickstart, use **create**. | [create/quick-start-hosted.md](../foundry-agent/create/quick-start-hosted.md) |
