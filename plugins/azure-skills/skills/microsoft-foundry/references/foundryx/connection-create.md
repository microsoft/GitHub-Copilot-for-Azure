# RemoteTool MCP connections

This guide is resource administration, not the normal Agent builder path. For
admin-created resources, use `connection list` / `connection show` and follow
[Discover and reuse tools](tool-discovery.md). Never create/replace a connection
automatically because discovery or invocation failed.

Requires project `manager` or `owner` (and a customer Foundry account onboarded with built-in Foundry Project Manager assigned to the backend app). For an MCP-backed Hosted Agent, complete `connection create` before `toolbox create`.

```text
foundryx connection create <name> \
  --kind remote-tool \
  --target https://example.com/mcp \
  --auth-type none|custom-keys|project-managed-identity|agentic-identity \
  [--audience <audience>] \
  [--custom-key <key=value>...] \
  [--metadata <key=value>...] \
  [--force] \
  [--output table|json] \
  --project <project-id>
```

| `--auth-type` | Required options | Consumer / Agent support & rules |
|---|---|---|
| `none` | `--target` | Public unauthenticated HTTPS MCP endpoint. Supported by both Prompt `agent.tools` (`type: mcp`) and Toolboxes. |
| `custom-keys` | `--target`, one or more `--custom-key <name=value>` | Static headers/keys (e.g. `--custom-key x-api-key=<secret> --custom-key Authorization=<secret>`; split on the first `=`; last duplicate wins). Sent to FoundryX/Azure, never stored or returned. Avoid placing real secrets in docs, logs, or transcripts. Supported by Prompt `agent.tools` and Toolboxes. |
| `project-managed-identity` | `--target`, `--audience <audience>` | App-only Entra token using the project managed identity (all consumers act with that shared identity, not their own). Supported by Hosted Agents via a Toolbox only (never direct Prompt MCP). |
| `agentic-identity` | `--target`, `--audience <audience>` | App-only Entra token using the Agent identity (unpublished project Agents may share one identity; all consumers act with that shared identity). Supported by Hosted Agents via a Toolbox only. |

- **Identity authorization**: Authorizing the project or Agent identity on the target MCP server is handled separately by its owner; do not assign Azure/Entra roles as part of this workflow. Configure only trusted targets, as Foundry sends an Entra token for `--audience` to `--target`.
- **Overwrite**: Pass `--force` only when the user intends to replace an existing named connection.


