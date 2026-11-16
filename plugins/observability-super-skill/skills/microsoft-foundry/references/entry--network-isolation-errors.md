# Selected guidance: Network Isolation Errors

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

If it's indeed a network isolation issue, supported connection options are documented in [Choose a secure connection method to Foundry](https://learn.microsoft.com/azure/foundry/how-to/configure-private-link#choose-a-secure-connection-method-to-foundry).

> ℹ️ Foundry MCP tools cannot reach a VNet-isolated project even from inside the VNet.
