# Shared Reference — Advisor Capability Routing

> **Shared across all `azure-advisor` capabilities.** Any capability that needs to
> pick an `advisor_*` MCP tool should link here instead of re-defining the table.
> Match tools by *capability description*, never by hard-coded name.

The connected Azure MCP server may expose a changing set of `advisor_*` tools. Resolve
which tool to invoke at each step from this capability table.

## Tool name matching

Match a tool when its name **contains** `advisor_` (i.e. `*advisor_*`) — **not** only
when it *starts with* `advisor_`. MCP clients prepend the **server name** to every tool,
so the same Advisor tool surfaces under a different prefix depending on the host:

| Client | Example tool name |
|---|---|
| Copilot CLI | `azure-mcp-advisor_recommendation_list` |
| Other hosts | `<server-prefix>advisor_recommendation_list` |

A strict *starts-with* check would reject `azure-mcp-advisor_recommendation_list` and the
skill would wrongly report "no Advisor tools found". Always substring-match on `advisor_`.

| Capability | Look for an `advisor_*` tool whose description says... | Required input |
|---|---|---|
| **Metadata / catalog** | "list recommendation types / categories / impact levels / supported values" | tenant context (no subscription needed) |
| **Active recommendations** | "list Advisor recommendations in a subscription" | subscription (resource group optional, filters optional) |
| **Aggregation / summary** | "summarize / group / aggregate Advisor recommendations" | subscription + group-by field |
| **IaC remediation** | "apply Advisor recommendations to IaC / ARM / Bicep / Terraform" | a resource type identifier |

## Resolution rules

- If a step's capability has **no matching tool**, skip it and note that in the chat
  output (e.g. "no aggregation tool available, presenting raw list").
- If **multiple tools** match, prefer the one with the more specific description.
- **Never** substitute a tool whose name does **not** contain `advisor_` for a missing
  capability — report the gap and skip instead.
