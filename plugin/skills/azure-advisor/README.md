# Azure Advisor Skill — Contributor Guide

> This README is for **contributors** maintaining the `azure-advisor` skill. It is not
> loaded by the agent at runtime — the agent reads [SKILL.md](SKILL.md) and the
> capability files. Keep onboarding notes here.

## What this skill is

`azure-advisor` is a **product area**, not a single workflow. It groups multiple
Advisor-related capabilities behind one router so the agent can pick the right one by
user intent. Each capability is a self-contained folder; shared concerns live in the
[references](references/capability-routing.md) folder.

## Folder map

| Path | Purpose |
|------|---------|
| [SKILL.md](SKILL.md) | **Router.** Frontmatter (makes the skill discoverable) + a capability table that routes intent to a capability file. Keep it thin. |
| [references/capability-routing.md](references/capability-routing.md) | **Shared.** Capability-agnostic routing docs reused by every capability: resolve which `advisor_*` MCP tool to call for each capability (catalog, recommendations, summary, IaC fix). |
| [references/subscription-discovery.md](references/subscription-discovery.md) | How to resolve the target subscription from repo config / env without hardcoding. |
| [references/resource-discovery.md](references/resource-discovery.md) | How to narrow a review to the resources defined in this repo (resource group / type / id) without hardcoding. |
| [review/review.md](review/review.md) | **Capability:** holistic read-only Advisor sweep (the only file the agent reads for this capability). |

## Conventions (match the rest of the repo)

- **One folder per capability**, named after the capability (e.g. `review/`,
  `summarize/`). This mirrors `microsoft-foundry` (`quota/quota.md`, `rbac/rbac.md`).
- **Capability file is named after its folder**: `review/review.md`,
  `summarize/summarize.md`. The agent loads this file when the capability matches.
- **Shared docs go in `references/`**, never inside a single capability folder — so the
  next capability can reuse them without a refactor.
- **Capability-specific references** (used by only one capability) may live in a nested
  `references/` inside that capability folder, e.g. `review/references/…`.
- **Frontmatter lives only in `SKILL.md`** (`name`, `description`, `license`,
  `metadata.author`, `metadata.version`). Capability files are plain Markdown.

## How to add a new capability

1. **Create the folder + file:** `azure-advisor/<capability>/<capability>.md`.
2. **Reuse shared references** instead of re-defining them — link to
   [capability-routing.md](references/capability-routing.md) and
   [subscription-discovery.md](references/subscription-discovery.md) where relevant.
3. **Register it in the router:** add a row to the **Capabilities** table in
   [SKILL.md](SKILL.md) (and remove it from the Roadmap list there if listed).
4. **Keep it read-only by default.** Advisor workflows propose IaC fixes; they don't
   mutate cloud state. Document any exception explicitly.
5. **Do not edit `metadata.version`** in [SKILL.md](SKILL.md) — it stays
   `0.0.0-placeholder`; NBGV stamps the real version at build time.

## Where this ships from

This is the upstream `microsoft/GitHub-Copilot-for-Azure` repository. Land changes here;
they are released from this repo and mirrored downstream automatically.
