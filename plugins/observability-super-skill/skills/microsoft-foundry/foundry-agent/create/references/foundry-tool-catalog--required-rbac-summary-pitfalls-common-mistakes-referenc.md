# Selected guidance: Required RBAC summary; Pitfalls / common mistakes; References

> Reading grants no execution approval. Apply current-request intent and
> standalone availability gates. Analyze supplied evidence in memory without
> Azure/Python, installs, auth, cache, writes or jobs. Missing/denied/empty/
> partial evidence stays distinct; insufficient evidence is INCONCLUSIVE.
> Live reads need verified operations/schemas, approved scope/window and finite
> budgets. Lifecycle actions, sensitive content, traffic, persistence, edits
> and deployment need separate explicit approval. Retain prerequisites from
> reached steps; missing prerequisites block operations. These rules supersede
> conflicting automatic actions in retained examples.

[Execution boundaries](../../../references/execution-boundaries.md) apply to the selected action.

## Required RBAC summary

| Operation | Role |
|---|---|
| PUT any connection above | **Foundry Project Manager** on the project (or **Cognitive Services Contributor** on the account) |
| Drive OAuth consent (`gateway_connector`, `catalog_MCP` managed-OAuth) | The end-user themselves, signed in to the subscription's tenant |
| `ProjectManagedIdentity` against a Cognitive Services upstream | Project MI needs the upstream's data-plane role (e.g. `Cognitive Services Language Owner` for `/language/mcp`) |

## Pitfalls / common mistakes

- **Do not forget PUT #2 for `gateway_connector`** ([Step 4](foundry-tool-catalog--gateway-connector-full-flow-step-1-discover-step-2-put-.md#step-4--put-2-register-actions)). The first PUT + OAuth flips status to `Authenticated` but the runtime has no actions to dispatch until you PUT again with `metadata.mcpserverConfigProperties`.
- **Do not invent a "real" target URL** for the `gateway_connector` flow on PUT #1. `"https://placeholder"` is correct on PUT #1; PUT #2 rewrites it.
- **Do not mix BYO `credentials` with `metadata.type=catalog_MCP`** in the BYO body. They conflict; the server accepts the PUT but the runtime uses the catalog's managed app and ignores your secret — or fails with consent confusion.
- **Do not send `scopes` as a space-separated string** anywhere. Always an array.
- **Do not call `listConsentLinks` for BYO OAuth.** Use only for `gateway_connector` and managed-OAuth `catalog_MCP`.
- **Do not assume catalog identity proves OAuth metadata.** Obtain reviewed
  scopes/endpoints from developer-provided inputs or separately approved
  supported retrieval. Never hardcode a provider mapping or replay a backend
  request to fill a gap.
- **Use exact field spelling** for `gateway_connector`: `toolEntityId` (NOT `entityId`), `connectionproperties` (lowercase, stringified JSON).
- **Sign in to the subscription's tenant** before calling `listConsentLinks` — it validates the caller principal owns the supplied `objectId` + `tenantId`.
- **Toolbox PATCH `default_version` must be a JSON STRING**, not a number. Sending `{"default_version": 1}` returns `400 invalid_payload "requires an element of type 'String', but the target element has type 'Number'"`. Use `{"default_version": "1"}`.
- **`metadata.audience` is required for `ProjectManagedIdentity`.** Without it the MCP server returns 401.
- **Header names for `CustomKeys` come from the catalog**, not from a default `Authorization: Bearer` template.
- **`ApiKey` is rejected** for `category=RemoteTool`. Use `CustomKeys` for static secrets.
- **OAuth consent is per-user, per-connection, per-project.** Each new caller hits `CONSENT_REQUIRED` once (returned as a nested string code inside an outer `-32006` error) and must open the URL the toolbox returns.
- **`api.githubcopilot.com/mcp` rejects user OAuth-App tokens.** Use a self-hosted MCP or fall back to OpenAPI.
- **PMI forwarder drops `target` query strings and mints a fixed audience.** Setting `properties.audience` is accepted but does not change what is sent.
- **Network-secured Foundry** projects cannot use private-endpoint-only MCP servers — only public endpoints reachable from the Foundry data plane and the Connector Namespace.

## References

- [Tool Catalog](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog)
- [Toolbox (preview)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [Private tools catalog](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog#private-tools-catalog)
- [Cognitive Services projects REST API](https://learn.microsoft.com/rest/api/aiservices/)
- [tool-mcp.md](tools/prompt-agent/tool-mcp.md) — prompt-agent MCP wiring (no toolbox)
- [use-toolbox-in-hosted-agent.md](use-toolbox-in-hosted-agent.md) — MCP endpoint, auth, testing, troubleshooting
- [agent-tools.md](tools/prompt-agent/agent-tools.md) — the agent-tools index
- [use-toolbox-in-hosted-agent.md](use-toolbox-in-hosted-agent.md) — wiring a toolbox into a hosted agent
