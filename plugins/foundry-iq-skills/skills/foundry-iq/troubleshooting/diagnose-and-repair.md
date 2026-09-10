# Diagnose and repair search failures

**Domain:** Troubleshooting
**Reads:** workload profile — the deployed architecture and the decisions recorded for it.

Use this primitive for provisioning, ingestion, indexing, retrieval, identity,
network, quality, or application-integration failures.

## Diagnose autonomously

Read-only diagnosis needs no approval. Capture the failed operation, interface,
plane, timestamp, status, correlation ID, identity, target resource, and expected
postcondition. Classify the failure into one family, inspect its evidence, then
open only that family's troubleshooting guide:

| Failure | Evidence to inspect | Guide |
|---|---|---|
| Provisioning | Deployment operations, provider registration, quota, region, policy | [network](tsg/network.md) |
| Ingestion | Data-source reachability, indexer status/history, field mappings, skill errors, failed document keys, change tracking | [ingestion](tsg/ingestion.md) |
| Query | Index/alias target, document count, query shape, filters, vector dimensions, semantic configuration, latency and throttling | [query](tsg/query.md) |
| `401` or `403` | Token audience and expiry, caller versus service identity, role and scope, local-auth policy | [identity](tsg/identity.md) |
| Private networking | DNS resolution, endpoint approval, firewall, shared private links, outbound dependencies | [network](tsg/network.md) |
| Application | SDK/API version, endpoint, retry policy, serialization, request and response diagnostics | [query](tsg/query.md) |
| Application credentials | Credential chain, principal actually used, managed identity configuration, token acquisition | [identity](tsg/identity.md) |

When the family is unclear, scan [tsg/index.md](tsg/index.md), which lists every
covered symptom, before loading a family file.

Run the candidate entry's **Discriminator** before any repair. It is a read-only
check that confirms the diagnosis and rules out the entry's **Lookalikes**. If it
does not confirm, the entry does not apply; read the lookalikes and reclassify.
A symptom that merely resembles an entry is not a match, and matching a symptom
to the nearest entry and applying its fix is the most common way an agent turns
one failure into two. When no entry matches, say so and diagnose from evidence
rather than forcing the closest fit.

Treat an entry marked `Confidence: inferred` as a hypothesis to confirm, not a
fact. The guides are not exhaustive; their `Known gaps` sections record failures
that documentation does not cover.

Refresh an expired token and retry once. Retry one transient `408`, `429`, or `5xx`
response using the service delay when provided. Never hide persistent failures or
enable keys, public networking, broader permissions, or a broader source scope as
a shortcut.

## Repair safely

1. State the root cause and smallest repair supported by evidence, naming the
   guide entry that confirmed it or recording that none applied.
2. Apply local code or configuration edits when the user asked to fix them.
3. Before Azure mutation, follow `references/defaults-and-approvals.md`. Treat the
   entry's **Risk class** as the approval class. Require approval for billable,
   permission, network, production, destructive, or data-movement changes.
4. Preserve unrelated resources and data. Use idempotent updates and versioned
   indexes for breaking schema repairs.
5. Rerun the exact failed operation, then one adjacent regression check. For
   ingestion, verify failures and freshness; for retrieval, verify expected and
   negative queries; for access, rerun both authorized and unauthorized cases.

Return the failed postcondition, evidence, root cause, repair and approval,
commands or files changed, before/after results, remaining risk, and rollback.
