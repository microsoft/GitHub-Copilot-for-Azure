# Selected guidance: Tool Usage Conventions; Azure Authentication; Additional Resources; Network Isolation Errors

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

4. `kind: prompt` without that harness -> ordinary **Prompt Agent**.

Use `agent_get` only when the type cannot be resolved from project context. Preserve the harness discriminator already authored on an existing Managed Harness Agent; do not migrate it during ordinary edits or redeploys. Do not convert an existing Agent between Prompt, Hosted, Managed Harness Agent, and Voice types; create a new Agent instead. Before creating any **Voice Agent**, determine the model strategy first per [create-voice](../foundry-agent/create/create-voice.md).

## Tool Usage Conventions

- Use the `ask_user` or `askQuestions` tool whenever collecting information from the user
- Use the `task` or `runSubagent` tool to delegate long-running or independent sub-tasks (e.g., env var scanning, status polling, Dockerfile generation)
- Prefer azd for Hosted Agents, Managed Harness Agents, and Voice Agents; prefer Foundry MCP for ordinary Prompt Agents.
- Reference official Microsoft documentation URLs instead of embedding CLI command syntax

## Azure Authentication

- [Azure Authentication Best Practices](../references/auth-best-practices.md)

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Agent Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)

## Network Isolation Errors

Applies to **any** call against a Foundry project or its parent Foundry account — Foundry MCP tools, `azd`, `az` CLI, `curl`, REST, or SDK.

If an error matches `Public access is disabled` / `PublicNetworkAccessDisabled` / `403 Forbidden` from a private endpoint / connection timeout / the project endpoint FQDN resolves to a public IP, this typically means the parent Foundry account has `publicNetworkAccess=Disabled` or `Enabled from selected IP addresses`, and the current shell is outside its VNet.

Only if the error is ambiguous, confirm against the Foundry account using a management-plane call (works from anywhere with reader access):

```bash
az cognitiveservices account show \
  --name <account> --resource-group <rg> \
  --query "properties.{publicNetworkAccess:publicNetworkAccess, networkAcls:networkAcls, privateEndpointConnections:privateEndpointConnections[].properties.privateLinkServiceConnectionState.status}"
```

`publicNetworkAccess: "Disabled"` — or `"Enabled"` together with non-empty `networkAcls.ipRules` / `virtualNetworkRules` — confirms isolation. If `publicNetworkAccess: "Enabled"` and `networkAcls` is empty, the failure is a caller-side network issue (e.g. Private DNS resolving the FQDN to a public IP from inside a VNet with a private endpoint), not an account-config issue.

