# Selected guidance: Agent: .foundry Workspace Standard; Agent: Setup References; Agent: Common Project Context Resolution

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

| Invoke/test/chat with an agent | [dependency check and setup](entry--pre-execution-requirements-dependency-check-and-setup-w.md#dependency-check-and-setup) → [azd-guidance](../foundry-agent/azd-guidance/azd-guidance.md) → invoke |
| Schedule/event-trigger an agent, or CRUD/enable/disable/dispatch a routine | [dependency check and setup](entry--pre-execution-requirements-dependency-check-and-setup-w.md#dependency-check-and-setup) → [azd-guidance](../foundry-agent/azd-guidance/azd-guidance.md) → routine |
| Optimize / improve agent prompt or instructions | observe (Step 4: Optimize) |
| Evaluate and optimize agent (full loop) | observe |
| Enable continuous evaluation monitoring | observe (Step 6: CI/CD & Monitoring) |
| Pull existing agent insights | [insights](../foundry-agent/insights/insights.md), bounded noncontent reads; no setup |
| Troubleshoot an agent issue | supplied evidence → [troubleshoot](../foundry-agent/troubleshoot/troubleshoot.md) or [trace](../foundry-agent/trace/trace.md); no invocation |
| Fix a broken agent | investigate → proposed change; edits, deployment and traffic require separate approvals; comparable post-change evidence required for recovery |

## Agent: .foundry Workspace Standard

Every agent source folder can keep Foundry-specific cache and overlay state under `.foundry/`:

```text
<agent-root>/
  .foundry/
    agent-metadata.yaml
    agent-metadata.prod.yaml
    suites/
    datasets/
    evaluators/
    results/
```

- Reuse confirmed deployment context. Never dump `azd env get-values`,
  `.env` files, connection strings or credentials. Selective nonsecret
  configuration hints are candidates, not proof of deployment or access.
- `agent-metadata.yaml` is the preferred local/dev overlay for non-azd values, remote Foundry suite references, local cache paths, result summaries, and explicit overrides. Optional sidecar files such as `agent-metadata.prod.yaml` can hold a single prod or CI-targeted overlay without mixing multiple environments in one file.
- `suites/`, `datasets/`, and `evaluators/` are local cache folders. Reuse them when they are current, and ask before refreshing or overwriting them.
- See [Agent Metadata Contract](../references/agent-metadata-contract.md) for the canonical schema and workflow rules.

## Agent: Setup References

- [Standard Agent Setup](../references/standard-agent-setup.md) — advanced setup for production workloads that need data-residency control (bring-your-own Cosmos DB / Storage / AI Search via a Foundry capability host). The default `azd ai agent` flow uses **Basic Agent Setup** and does **not** provision `capabilityHosts/agents` — do not flag its absence as a bug. For default post-provision state, see the "Expected env-var fingerprint" section in [foundry-agent/create/create-hosted.md](../foundry-agent/create/create-hosted.md).

## Agent: Common Project Context Resolution

