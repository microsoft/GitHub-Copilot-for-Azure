# 1. Resolve the requested scope once

Reuse confirmed application/environment, exact resource/source IDs, provenance,
schema and sufficient observations. Recheck expired access or changed associations,
not every subscription. If needed, load available `connect-observability` through
supported host loading, or establish the same essentials directly. No saved
mapping, Python, azd or Foundry is required for web/API health.

Choose the narrowest applicable lens:

- Web/API: [public web/API guidance](web-api.md), with
  [resource guidance](application-health.md) only for relevant scope.
- Named AKS, VM, Function, cache, database or application-wide:
  [application/resource guidance](application-health.md).
- Foundry agent: [Foundry health](foundry-agent-health.md) and
  [attribution/correlation guidance](foundry-agent.md). Resolve the
  exact project/agent/version and actual telemetry linkage; no guessed topology.

Agree the task, exact UTC window, core surfaces, freshness and relevant
SLO/baseline/failure policy. Unknown thresholds permit measurements, not invented
regressions. If idle, establish whether activity was expected; never generate
traffic for evidence. Propose a representative window only when none is agreed;
do not silently broaden the window, including to 24 hours.

Reuse verified IDs rather than Resource Graph. A stale ID may justify one scoped
resource-group metadata read only if needed and within approval; never silently
update a saved inventory. Do not retrieve secret connection objects or complete
agent configurations. If safe projection is unavailable, request a safer source.
