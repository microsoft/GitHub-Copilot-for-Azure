# Harden a prototype for production

**Domain:** Operations
**Reads:** workload profile — environment and policy, entitlement model.

Use this primitive when a working configuration must move into a regulated,
isolated, or production environment. The starting state is a design that already
answers queries, so the risk is not building the wrong thing; it is carrying a
development shortcut into production unnoticed.

## 1. Detect development shortcuts

Inventory the current deployment and classify each finding. Treat these as
blocking:

| Shortcut | Production requirement |
|---|---|
| Local auth or API keys enabled | `disableLocalAuth: true`, Microsoft Entra ID only |
| Keys or connection strings in code, config, or environment files | Managed identity and `DefaultAzureCredential` |
| Public network access | `publicNetworkAccess: Disabled`, private endpoint, private DNS |
| Serverless or development tier | Dedicated tier sized for the workload |
| Broad or subscription-scoped roles | Least-privilege roles at the narrowest scope |
| Shared developer identity | A workload identity owned by the deployment |
| Platform-managed encryption where policy requires CMK | Customer-managed keys |
| Unpinned API or package versions | Pinned, source-controlled versions |

Treat missing telemetry, missing rollback, and unversioned index schemas as
advisory unless policy makes them blocking.

## 2. Plan the target architecture

Read Azure Policy, approved regions, and network topology before proposing.
Produce the target posture, the migration order, and the rollback. Never offer a
public or key-based fallback path, and never leave the prototype's public
endpoint reachable as a backup.

Enumerate every outbound dependency the workload needs inside isolation: storage,
embedding and model endpoints, Fabric, ontology and connector services, and
monitoring. Each needs a shared private link or an approved private route. A
dependency that is reachable only over the public internet blocks the migration
and must be reported, not worked around.

Follow `references/defaults-and-approvals.md` and request one consolidated
approval covering tier changes, role assignments, network mutation, encryption,
and cost class.

## 3. Apply and verify

Apply idempotently, preferring versioned infrastructure over portal changes so
the result is reproducible. Then verify from inside the isolated environment:

1. Private DNS resolves to the private endpoint and public access is refused.
2. Every enumerated dependency is reachable.
3. Managed identity authenticates and least-privilege roles are sufficient.
4. A representative query returns a grounded, cited result end to end.
5. When trimming applies, rerun the deny test with both identities.

Successful resource creation is not a successful migration. If retrieval fails
after deployment, compose `troubleshooting/diagnose-and-repair` rather than relaxing
network or identity settings.

## Output contract

Return the detected shortcuts and their classification, the approved target
architecture, dependencies and their private routes, resources changed,
post-deployment retrieval and deny-test evidence, residual risk, and rollback.
