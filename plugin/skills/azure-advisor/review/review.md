# Azure Advisor Review

Drive an end-to-end Azure Advisor sweep using whichever `advisor_*` MCP tools the
connected Azure MCP server exposes. Designed to stay useful as new advisor tools
land — it routes by *capability* (catalog, recommendations, summary, IaC fix),
not by hard-coded tool name lists.

## When to Use This Sub-Skill

Use this sub-skill when the user wants to:

- Get an overall picture of Advisor findings for an Azure subscription
- Sweep **all** subscriptions (dev, staging, prod, …), classify them by environment, and get recommendations grouped per environment
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
- **[Resource Scope Discovery](../references/resource-discovery.md)** — how to narrow the
  review to the resources this repo deploys (resource group / type / id) without
  hardcoding.

## Workflow

### Step 1 — Discover and classify subscription(s)

Run [Subscription Discovery](../references/subscription-discovery.md). By **default**,
auto-discover **every** subscription the repo references (a repo often pins a different
subscription per environment) and classify each into an environment bucket (prod /
staging / test / dev / other) — do **not** wait for the user to name the scope. Then run
Steps 2–5 **once per discovered subscription**.

- If discovery finds only one subscription, the review simply runs once.
- Widen to a tenant-wide enumeration (subscription-list tool) only when the user explicitly
  asks for it, or when repo discovery finds nothing.

Mention each subscription's *source* and the environment breakdown in the final chat
summary. Never hardcode ids.

### Step 1b — Resolve repo resource scope

Run [Resource Scope Discovery](../references/resource-discovery.md) to find the resource
group(s), resource **type(s)**, and resource id(s) this repo defines. Collect **every**
distinct signal — a repo usually defines **multiple** resource types, so do **not** stop
after the first. Save them all with their *source(s)*. Only if the repo defines no Azure
resources at all, fall back to a full-subscription review and note that in the summary.

### Step 2 — Probe the catalog (metadata)

Invoke the **metadata / catalog** capability (see
[Capability Routing](../references/capability-routing.md)) with no filter to learn what
recommendation categories, impacts, and resource types Advisor knows about for this
tenant. Cache the result — later steps can reference category/impact values from it.

If this call returns an empty list, the tenant likely lacks Advisor coverage — report
that and stop early.

### Step 3 — Pull active recommendations

Invoke the **active recommendations** capability with the resolved subscription. If
Step 1b found a repo scope, pass it as the matching filter (resource group / resource
type / resource id) per [Capability Routing](../references/capability-routing.md); if the
tool has no such filter, pull unfiltered and **post-filter** the list to the discovered
scope in-context. Otherwise pull the whole subscription. Limit output to a manageable
page if the tool supports it.

### Step 4 — Aggregate (if available)

If a **summary / aggregation** capability exists, call it twice (applying the same Step 1b
scope filter, if any):

- Once grouped by **category** (Cost, Security, Reliability, etc.)
- Once grouped by **impact** (High, Medium, Low)

If no aggregation tool exists, derive the same two breakdowns locally from the Step 3
list.

### Step 5 — Spotlight high-impact items

From the Step 3 results, pick up to **5 distinct High-impact recommendations** across
different resource types. For each, if an **IaC remediation** capability exists and
the recommendation's resource type matches a supported type, fetch a fix snippet.

### Step 6 — Compose chat summary

Reply in chat with this structure (no files written).

**Single subscription:**

```
## Azure Advisor Review

**Subscription:** <id> (from <source>)
**Scope:** <resource group / type / id and its source, or "whole subscription — no repo scope found">

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

**All subscriptions** — group the report by environment bucket (prod first, then staging,
test, dev, other), with a roll-up at the top:

```
## Azure Advisor Review — All Subscriptions

**Scope:** S subscriptions across E environments
**Totals:** High H | Medium M | Low L  ·  Cost A | Security B | Reliability C | Performance D | Operational E

### prod (n subscriptions)
- <sub name> (<id>): High h | Medium m | Low l — top category <cat>
  - High-impact spotlight (up to 5): <recommendation> — <resource type> — <resource id>
    <IaC fix snippet if available>
...

### staging (n subscriptions)
...

### Unclassified (n subscriptions)
...

### Notes
- Subscriptions enumerated via: <subscription-list tool name>
- Tools used: <list of advisor_* tools actually called>
- Tools skipped (no capability match): <list, if any>
- Subscriptions with no Advisor coverage: <list, if any>
```

Do **not** write any file to disk. The summary lives only in the chat response.

## Constraints

- ✅ **Always** discover the subscription from repo files / env first; ask only as last resort.
- ✅ **Always** auto-discover **every** subscription the repo references and classify each by environment before reviewing; never make the user name the scope and never hardcode the list.
- ✅ **Always** include every advisor_* tool name actually invoked in the "Tools used" line so the user can see what the skill chose.
- ✅ **Always** mention which steps were skipped because no matching capability was found.
- ❌ **Never** hardcode a subscription id, tenant id, or resource group.
- ❌ **Never** modify Azure state — this sub-skill is read + suggest only.
- ❌ **Never** call a tool whose name does not contain `advisor_` as a substitute; if no capability matches, report it and skip. (Match on the substring `advisor_` — clients prepend a server-name prefix like `azure-mcp-`.)
- ❌ **Never** write the summary to a file unless the user explicitly asks for one in their prompt.
- ❌ **Never** write helper scripts, scratch files, or parsing utilities to disk (no `.tmp/*.js`, no `.tmp/*.json`, no temp files of any kind). Reason over MCP tool responses directly in-context. Prefer aggregating via the Aggregation / summary capability (see [capability-routing.md](../references/capability-routing.md)) over computing counts yourself.
- ❌ **Never** shell out to `node`, `python`, `pwsh`, `powershell`, `jq`, or any other interpreter to read, parse, group, or count MCP tool responses. The tool responses are already in your context — reason over them directly. If you need server-side aggregation, use the Aggregation / summary capability from [capability-routing.md](../references/capability-routing.md).

## Error Handling

| Symptom | Probable cause | Action |
|---|---|---|
| No tool name contains `advisor_` | MCP server not configured / not running, **or** a strict starts-with match rejected prefixed names | Substring-match on `advisor_` (names look like `azure-mcp-advisor_*`). If still none, tell user to check `.vscode/mcp.json`, that `azmcp.exe` is reachable, and that tools are exposed individually (`--mode all`). |
| Tenant-wide enumeration requested but no subscription-list tool | Azure MCP subscription tool not exposed | Fall back to repo-discovered subscriptions; if none, ask the user. |
| Recommendations tool has no resource-scope filter | Tool only accepts a subscription | Pull unfiltered and post-filter the list to the Step 1b scope in-context. |
| Catalog call returns empty | Tenant has no Advisor coverage yet | Stop after Step 2; report empty tenant. |
| Recommendation list 401/403 | Auth not scoped to subscription | Tell user to run `az login` and verify subscription access. |
| Aggregation tool errors on `group-by` | Field name not in supported list | Re-call with a value drawn from Step 2's catalog. |
| IaC tool says "unknown resource" | Resource type not in its supported list | Skip the fix for that recommendation; keep the rest. |
