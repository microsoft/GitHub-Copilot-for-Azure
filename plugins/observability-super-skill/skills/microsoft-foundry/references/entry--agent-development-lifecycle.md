# Selected guidance: Agent Development Lifecycle

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

The retained lifecycle sequences below are optional planning references, **not
automatic action chains**. Each setup, job, traffic, write and deployment step
needs its own applicable approval; the evidence-first entry takes precedence.

Match user intent to the correct agent workflow. Read each sub-skill in order before executing.

| User Intent | Workflow (read in order) |
|-------------|------------------------|
| Create or develop a Voice Agent (Prompt Voice or Hosted Voice) | [dependency check and setup](entry--pre-execution-requirements-dependency-check-and-setup-w.md#dependency-check-and-setup) → [azd-guidance](../foundry-agent/azd-guidance/azd-guidance.md) → [create-voice](../foundry-agent/create/create-voice.md) → [deploy](../foundry-agent/deploy/deploy.md) → [invoke](../foundry-agent/invoke/invoke.md) |
| Create or develop an explicitly requested Managed Harness Agent / Copilot harness agent | [dependency check and setup](entry--pre-execution-requirements-dependency-check-and-setup-w.md#dependency-check-and-setup) → [azd-guidance](../foundry-agent/azd-guidance/azd-guidance.md) → [create-managed-harness](../foundry-agent/create/create-managed-harness.md) → [deploy](../foundry-agent/deploy/deploy.md) → [invoke](../foundry-agent/invoke/invoke.md) |
| Create a new hosted agent end-to-end (scaffold + deploy + test) | [dependency check and setup](entry--pre-execution-requirements-dependency-check-and-setup-w.md#dependency-check-and-setup) → [azd-guidance](../foundry-agent/azd-guidance/azd-guidance.md) → [quick-start-hosted](../foundry-agent/create/quick-start-hosted.md) (self-contained end-to-end) |
| Anything beyond the standard quickstart (existing code, migration, re-hosting, deployment customization, scaffold-time connections, A2A (Agent2Agent), recovery) | [dependency check and setup](entry--pre-execution-requirements-dependency-check-and-setup-w.md#dependency-check-and-setup) → [azd-guidance](../foundry-agent/azd-guidance/azd-guidance.md) → [create](../foundry-agent/create/create-hosted.md) → [deploy](../foundry-agent/deploy/deploy.md) → [invoke](../foundry-agent/invoke/invoke.md) |
| Optimize existing Python hosted agent | [dependency check and setup](entry--pre-execution-requirements-dependency-check-and-setup-w.md#dependency-check-and-setup) → [azd-guidance](../foundry-agent/azd-guidance/azd-guidance.md) → [agent-optimizer](../foundry-agent/agent-optimizer/agent-optimizer.md) → scaffold/review → eval.yaml → optimize → apply candidate → deploy → invoke |
| Deploy an agent (code already exists) | [dependency check and setup](entry--pre-execution-requirements-dependency-check-and-setup-w.md#dependency-check-and-setup) → [azd-guidance](../foundry-agent/azd-guidance/azd-guidance.md) → deploy (includes eval-suite setup) → invoke → observe (evaluate/optimize) |
| Update/redeploy an agent after code changes | [dependency check and setup](entry--pre-execution-requirements-dependency-check-and-setup-w.md#dependency-check-and-setup) → [azd-guidance](../foundry-agent/azd-guidance/azd-guidance.md) → deploy (includes eval-suite setup) → invoke → observe (evaluate/optimize) |
| Set up a CI/CD deployment pipeline for a hosted agent | [dependency check and setup](entry--pre-execution-requirements-dependency-check-and-setup-w.md#dependency-check-and-setup) → [azd-guidance](../foundry-agent/azd-guidance/azd-guidance.md) → cicd |
