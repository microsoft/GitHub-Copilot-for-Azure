# Deploy a governed agent

**Domain:** Operations
**Reads:** workload profile — entitlement model, environment and policy.

Use this primitive after an enterprise knowledge base is ready.

Inspect the existing Foundry project, agent definitions, identity, VNet, policy,
and reusable resources without asking. Ask only for an unresolved environment,
agent behavior, or approved identity boundary. Follow
`references/defaults-and-approvals.md` and obtain one approval for deployment,
roles, and network changes.

1. Deploy or update a Foundry Hosted Agent in the approved VNet idempotently.
2. Bind the knowledge base by name using managed identity.
3. Apply explicit least-privilege role assignments for the hosted-agent identity.
4. Keep keys, connection strings, and bearer tokens out of agent configuration.
5. Verify private DNS, outbound shared private links, knowledge-base resolution,
   managed-identity authentication, and an authorized retrieval.

A knowledge base that only the deploying developer can query is not a production
outcome. Return the hosted-agent identifier, VNet, knowledge-base binding, managed
identity, verified role scopes, authorized retrieval, access-denial result when
required, deployment artifact, and rollback procedure.
