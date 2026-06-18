---
name: azure-advisor
description: "Azure Advisor reviews and recommendation workflows using whichever advisor_* MCP tools are available. WHEN: \"run an advisor review\", \"check my Azure advisor recommendations\", \"summarize advisor findings\", \"what does Advisor say about my subscription\", \"give me an advisor health check\", \"audit my Azure resources with Advisor\". USE FOR: end-to-end Advisor sweeps that combine the recommendation catalog, active recommendations, summaries/aggregates, and IaaC fix suggestions into one chat summary. DO NOT USE FOR: applying changes to Azure resources directly (read-only review), cost analysis beyond Advisor's cost category (use azure-cost), or non-Advisor diagnostics (use azure-diagnostics)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Advisor Skill

Azure Advisor is a **product area** with multiple capabilities. This skill routes a
user's intent to the right capability and runs it using whichever `advisor_*` MCP tools
the connected Azure MCP server exposes. Routing is by *capability* (catalog,
recommendations, summary, IaaC fix), not by hard-coded tool names, so the skill stays
useful as new advisor tools land.

> 🛠️ **Contributing a new capability?** See [README.md](README.md) for the folder map
> and a step-by-step recipe.

## Pre-Execution Requirements

Inspect the available `advisor_*` MCP tools and their parameters before running a
capability. Match tools by capability description, not by a fixed name list — see the
shared [Capability Routing](references/capability-routing.md) reference.

## Shared References

These product-area references are reused by **every** capability below. Read the
relevant one before acting:

| Reference | Purpose |
|-----------|---------|
| [Capability Routing](references/capability-routing.md) | Resolve which `advisor_*` MCP tool to call for each capability (catalog, recommendations, summary, IaaC fix). |
| [Subscription Discovery](references/subscription-discovery.md) | Resolve the target subscription from repo config / env without hardcoding. |

## Capabilities

Route the user's request to the matching capability. **Use these instead of the main
skill when they match the task:**

| Capability | When to Use | Reference |
|-----------|-------------|-----------|
| **review** | Run a holistic, read-only Advisor sweep across a subscription — probe the catalog, pull active recommendations, aggregate by category/impact, spotlight high-impact items, and propose IaaC fix snippets. | [review](review/review.md) |

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
- ❌ **Never** call non-`advisor_*` tools as substitutes; if no capability matches, report it and skip.
