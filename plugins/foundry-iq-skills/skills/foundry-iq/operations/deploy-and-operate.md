# Deploy and operate a search workload

**Domain:** Operations
**Reads:** workload profile — environment and policy, freshness, latency and cost.

Persist the service, index, ingestion, identities, diagnostics, and application
configuration as source-controlled artifacts. Reuse the repository's IaC and
deployment system rather than introducing a parallel mechanism.

## Safe deployment

1. Compare desired and deployed state. Reuse compatible resources and list all
   cost, role, network, and data changes in one approval.
2. Deploy to a nonproduction environment first when one exists.
3. For a breaking schema change, create a versioned index, ingest it, run the
   user-provided evaluation dataset or representative acceptance queries, then
   swap an alias. Keep the previous index through the agreed rollback window.
4. Roll application configuration forward only after the target index is ready.
   Never delete the previous index in the same unconfirmed step.

## Operate

Configure diagnostics and actionable alerts for query latency and throttling,
indexer failures, failed documents, freshness, storage/capacity, and application
errors. Record expected service level, owner, dashboard, and escalation path.
Recommend scaling only from observed utilization and workload requirements.

Production network exposure, role assignments, scaling, alias swaps, and deletion
plans require approval. This workflow does not execute deletion; if the user asks
to remove resources, return an ownership-scoped plan and require a separately
approved destructive workflow. Read-only health checks and generation of
deployment assets do not require approval.

Return the state diff, approvals, deployment and alias status, acceptance results,
monitoring links or definitions, capacity observations, rollback command, and
resources intentionally retained.
