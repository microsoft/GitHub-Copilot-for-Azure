---
name: azure-advisor
description: "Azure Advisor reviews and recommendations using available advisor_* MCP tools. WHEN: \"run an advisor review\", \"check my Azure advisor recommendations\", \"summarize advisor findings\", \"what does Advisor say about my subscription\", \"give me an advisor health check\", \"audit my Azure resources with Advisor\". USE FOR: read-only Advisor sweeps with catalog, recommendations, and IaC fixes. DO NOT USE FOR: changing resources, billing analysis (use azure-cost), or non-Advisor troubleshooting (use azure-diagnostics)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Advisor Skill

Azure Advisor is a **product area** with multiple capabilities. This skill routes a
user's intent to the right capability and runs it using whichever `advisor_*` MCP tools
the connected Azure MCP server exposes. Routing is by *capability* (catalog,
recommendations, summary, IaC fix), not by hard-coded tool names, so the skill stays
useful as new advisor tools land.

> 🛠️ **Contributing a new capability?** See [README.md](README.md) for the folder map
> and a step-by-step recipe.

## Pre-Execution Requirements

Inspect the available `advisor_*` MCP tools and their parameters before running a
capability. Match a tool when its name **contains** `advisor_` (i.e. `*advisor_*`), not
only when it *starts with* it — MCP clients prepend a server-name prefix (e.g.
`azure-mcp-advisor_recommendation_list`). Match by capability description, not by a fixed
name list — see the shared [Capability Routing](references/capability-routing.md) reference.

## Shared References

These product-area references are reused by **every** capability below. Read the
relevant one before acting:

| Reference | Purpose |
|-----------|---------|
| [Capability Routing](references/capability-routing.md) | Resolve which `advisor_*` MCP tool to call for each capability (catalog, recommendations, summary, IaC fix). |
| [Subscription Discovery](references/subscription-discovery.md) | Resolve the target subscription from repo config / env without hardcoding. |

## Capabilities

Route the user's request to the matching capability. **Use these instead of the main
skill when they match the task:**

| Capability | When to Use | Reference |
|-----------|-------------|-----------|
| **review** | Run a holistic, read-only Advisor sweep across a subscription — probe the catalog, pull active recommendations, aggregate by category/impact, spotlight high-impact items, and propose IaC fix snippets. | [review](review/review.md) |

### Roadmap (not yet implemented)

Planned capabilities will each be added as a sibling folder under `azure-advisor/`,
reusing the shared references above. Add a row to the table above when one ships:

- **summarize** — focused recommendation summarization / aggregation views
- **resource-analysis** — per-resource Advisor analysis and drill-down
- **greenfield** — Advisor-informed guidance for new/empty subscriptions
- **cost** — Advisor cost-category optimization (coordinates with `azure-cost`)
- **reliability** — Advisor reliability-category reviews
- **governance** — Advisor operational-excellence / governance reviews

## Constraints

- ❌ **Never** hardcode a subscription id, tenant id, or resource group.
- ❌ **Never** modify Azure state — Advisor workflows in this skill are read + suggest only.
- ❌ **Never** call a tool whose name does not contain `advisor_` as a substitute; if no capability matches, report it and skip.
