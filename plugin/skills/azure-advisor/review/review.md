# Azure Advisor Review

Drive an end-to-end Azure Advisor sweep using whichever `advisor_*` MCP tools the
connected Azure MCP server exposes. Designed to stay useful as new advisor tools
land — it routes by *capability* (catalog, recommendations, summary, IaC fix),
not by hard-coded tool name lists.

## When to Use This Sub-Skill

Use this sub-skill when the user wants to:

- Get an overall picture of Advisor findings for an Azure subscription
- See "what categories / impact levels does Advisor surface here?" before drilling in
- Combine the recommendation catalog (metadata) with the active recommendation list
- Produce a single grouped/aggregated view ("top N by impact", "by resource type")
- Quickly check whether their tenant even has Advisor data yet (new/empty subs)

This is a **read-only** review. Even if an `apply`-style advisor tool exists, this
sub-skill only proposes IaC fix snippets — it never modifies cloud state.

## Shared References

This capability builds on two product-area references shared by every `azure-advisor`
capability — read them before running the workflow:

- **[Capability Routing](../references/capability-routing.md)** — how to pick the right
  `advisor_*` MCP tool by capability (catalog, recommendations, summary, IaC fix).
- **[Subscription Discovery](../references/subscription-discovery.md)** — how to resolve
  the target subscription from repo config / env without hardcoding.

## Workflow

### Step 1 — Resolve subscription

Run [Subscription Discovery](../references/subscription-discovery.md). Save the resolved
value; mention its *source* in the final chat summary ("Subscription pulled from
`infra/main.parameters.json`").

### Step 2 — Probe the catalog (metadata)

Invoke the **metadata / catalog** capability (see
[Capability Routing](../references/capability-routing.md)) with no filter to learn what
recommendation categories, impacts, and resource types Advisor knows about for this
tenant. Cache the result — later steps can reference category/impact values from it.

If this call returns an empty list, the tenant likely lacks Advisor coverage — report
that and stop early.

### Step 3 — Pull active recommendations

Invoke the **active recommendations** capability with the resolved subscription and
**no filters first** to get raw counts. Limit output to a manageable page if the tool
supports it.

### Step 4 — Aggregate (if available)

If a **summary / aggregation** capability exists, call it twice:

- Once grouped by **category** (Cost, Security, Reliability, etc.)
- Once grouped by **impact** (High, Medium, Low)

If no aggregation tool exists, derive the same two breakdowns locally from the Step 3
list.

### Step 5 — Spotlight high-impact items

From the Step 3 results, pick up to **5 distinct High-impact recommendations** across
different resource types. For each, if an **IaC remediation** capability exists and
the recommendation's resource type matches a supported type, fetch a fix snippet.

### Step 6 — Compose chat summary

Reply in chat with this structure (no files written):

```
## Azure Advisor Review

**Subscription:** <id> (from <source>)
**Tenant catalog:** N categories, M impact levels, K resource types

### Snapshot
- Total active recommendations: X
- By category: Cost A | Security B | Reliability C | Performance D | Operational E
- By impact:   High H | Medium M | Low L

### High-impact spotlight (up to 5)
1. <recommendation text> — <resource type> — <resource id>
   <IaC fix snippet if available, fenced as bash/json>
...

### Notes
- Tools used: <list of advisor_* tools actually called>
- Tools skipped (no capability match): <list, if any>
```

Do **not** write any file to disk. The summary lives only in the chat response.

## Constraints

- ✅ **Always** discover the subscription from repo files / env first; ask only as last resort.
- ✅ **Always** include every advisor_* tool name actually invoked in the "Tools used" line so the user can see what the skill chose.
- ✅ **Always** mention which steps were skipped because no matching capability was found.
- ❌ **Never** hardcode a subscription id, tenant id, or resource group.
- ❌ **Never** modify Azure state — this sub-skill is read + suggest only.
- ❌ **Never** call a tool whose name does not contain `advisor_` as a substitute; if no capability matches, report it and skip. (Match on the substring `advisor_` — clients prepend a server-name prefix like `azure-mcp-`.)
- ❌ **Never** write the summary to a file unless the user explicitly asks for one in their prompt.
- ❌ **Never** write helper scripts, scratch files, or parsing utilities to disk (no `.tmp/*.js`, no `.tmp/*.json`, no temp files of any kind). Reason over MCP tool responses directly in-context. Prefer aggregating via the `advisor_recommendation_summary` tool over computing counts yourself.
- ❌ **Never** shell out to `node`, `python`, `pwsh`, `powershell`, `jq`, or any other interpreter to read, parse, group, or count MCP tool responses. The tool responses are already in your context — reason over them directly. If you need server-side aggregation, use the `advisor_recommendation_summary` tool.

## Error Handling

| Symptom | Probable cause | Action |
|---|---|---|
| No tool name contains `advisor_` | MCP server not configured / not running, **or** a strict starts-with match rejected prefixed names | Substring-match on `advisor_` (names look like `azure-mcp-advisor_*`). If still none, tell user to check `.vscode/mcp.json`, that `azmcp.exe` is reachable, and that tools are exposed individually (`--mode all`). |
| Catalog call returns empty | Tenant has no Advisor coverage yet | Stop after Step 2; report empty tenant. |
| Recommendation list 401/403 | Auth not scoped to subscription | Tell user to run `az login` and verify subscription access. |
| Aggregation tool errors on `group-by` | Field name not in supported list | Re-call with a value drawn from Step 2's catalog. |
| IaC tool says "unknown resource" | Resource type not in its supported list | Skip the fix for that recommendation; keep the rest. |
