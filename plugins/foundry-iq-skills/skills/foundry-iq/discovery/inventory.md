# Inventory Foundry IQ resources

**Domain:** Discovery
**Reads:** workload profile — environment and policy.

Use this primitive when the user asks what already exists or whether an existing
resource can be reused.

Proceed read-only without approval:

1. Confirm the active tenant, subscription, and environment from existing context.
   If several are plausible, report them and ask which one only before mutation.
2. Use Azure MCP Server read-only tools, REST/SDK list operations, or control-plane
   discovery to enumerate Search services, hosting/SKU, region, identities,
   network posture, indexes and aliases, data sources, indexers, skillsets,
   knowledge sources, knowledge bases, and known application or agent bindings.
3. Inspect health and last-run status without retrieving keys or private document
   content.
4. Classify each resource as reusable, incompatible, inaccessible, or unhealthy
   and explain the evidence.

Distinguish inaccessible resources from absent resources. Return stable resource
identifiers, the interface used, recommended reuse candidates, and any facts that
still require user confirmation.
