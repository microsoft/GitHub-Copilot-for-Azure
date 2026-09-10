# Provision an Azure AI Search service

**Domain:** Operations
**Reads:** workload profile, reuse verdict, target environment, policy, identity, region, capacity, and cost constraints.

Create a Search service only after `discovery/reuse-or-provision` proves that no
authorized existing service fits. This primitive owns the service boundary; index
design, ingestion, knowledge sources, and knowledge bases are separate decisions.

## Preconditions

- The subscription, isolated resource group, allowed region, ownership tags, and
  approved cost class are known.
- Policy, network, identity, and residency constraints have been inspected.
- [Region and capacity preflight](../references/region-capacity-preflight.md)
  produced an ordered set of approved candidates with feature support and quota
  headroom; live allocation capacity remains unknown until creation.
- The plan states why reuse failed and has approval for billable, permission,
  network, and production changes.
- The selected SKU supports the required index, source, semantic, vector, and
  knowledge-base capabilities. Do not select a tier from habit.

## Apply

Use source-controlled IaC or a control-plane SDK, with control-plane REST only
when the required contract is not exposed. Derive a deterministic name and apply
idempotently in the approved resource group.

When Azure reports a recognized regional allocation constraint, retain the
diagnostic and follow the pre-approved candidate order. Use bounded retry when
the region must be preserved; otherwise clean up the failed attempt and try the
next compatible region. Do not change geography, SKU, identity, networking, or
local-auth posture merely to make creation succeed.

Use Microsoft Entra authentication and disable local auth on new services. Assign
only the least-privilege control-plane and data-plane roles required by the
approved workflow. For inspection-only access to an empty data plane, assign
`Search Index Data Reader` at the service scope; do not substitute a broader
control-plane role. Apply only the networking and encryption posture justified
by policy or the environment; never enable public access or retrieve credentials
as a fallback.

Tag the resource with workload, environment, owner, and trial or deployment
identity. Record whether cleanup owns the service or must preserve it as shared.

## Verify

Read the service through the control plane and prove:

1. provisioning state and endpoint are healthy;
2. SKU, region, replicas, partitions, identity, local-auth, network, encryption,
   and tags match the approved plan;
3. required data-plane access succeeds with a Microsoft Entra token;
4. rerunning converges on the same service without a duplicate or credential
   disclosure.

Do not call an empty service a completed customer outcome. Continue with index
ingestion or the knowledge-source and knowledge-base primitives selected by the
workload.

## Output contract

Return the reuse rejection evidence, resource ID and endpoint, applied
configuration, role and network changes, verification results, ownership,
idempotency evidence, estimated cost class, rollback, and ownership-scoped cleanup.
