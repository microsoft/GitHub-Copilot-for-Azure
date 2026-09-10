# Reuse or provision knowledge

**Domain:** Discovery
**Reads:** workload profile — query shape, freshness, entitlement model, environment and policy.

Run this decision before proposing any new Search service, index, knowledge
source, or knowledge base. Another team may already own an authorized asset for
the same content. Duplicating it wastes cost and splits governance.

## 1. Enumerate what the caller can access

Compose `inventory` first. Enumerate only resources the current identity is
permitted to see, and distinguish an inaccessible resource from an absent one. An
inaccessible resource may still be the correct answer; report it with its owner
rather than provisioning around it.

## 2. Assess fitness

A candidate is reusable only when it satisfies the workload on every dimension
that the user's request constrains:

| Dimension | Reject when |
|---|---|
| Content coverage | The corpus does not contain the requested sources or scope |
| Freshness | Refresh cadence or last successful run misses the required currency |
| Region and residency | Location violates policy, residency, or latency requirements |
| Security posture | Auth mode, network exposure, or encryption is below the requirement |
| Permission model | It cannot preserve the per-user trimming the workload requires |
| Retrieval quality | Schema, vectorization, or semantic configuration cannot serve the query shape |
| Governance | Ownership, change control, or SLA does not allow this consumption |
| Cost model | Tier or consumption profile is inappropriate for the expected traffic |

State the evidence for each rejection. Do not reject a candidate because
provisioning a new resource is simpler.

## 3. Decide

Choose one outcome and record why:

- **Reuse as-is** when every constrained dimension passes. Bind to it read-only
  and verify retrieval before declaring success.
- **Reuse with a bounded change** when one dimension fails and the change is
  reversible, in scope, and owned by this user. Follow the normal approval path.
- **Request a change from the owner** when the resource is fit but owned by
  another team. Report the owner, the requested change, and the reason. Do not
  mutate a resource this workload does not own.
- **Provision new** only when no candidate fits, or reuse would violate policy,
  residency, or isolation. State which dimension forced it.

Prefer reuse when a candidate is fit. Prefer provisioning when reuse would
silently degrade security, isolation, or per-user permissions.

## Output contract

Return the enumerated candidates, the fitness verdict and evidence per dimension,
the selected outcome and rationale, the owner and requested change when
applicable, and the verification that proves the reused asset actually answers
the user's query.
