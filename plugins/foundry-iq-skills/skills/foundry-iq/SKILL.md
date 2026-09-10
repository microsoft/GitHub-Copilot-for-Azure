---
name: foundry-iq
description: 'Build Azure AI Search applications and grounded Foundry IQ knowledge. WHEN: "provision Azure AI Search", "create a Foundry IQ knowledge base", "make these documents indexed and retrievable", "add search to this app", "answer questions from these files with citations", "connect our Blob container", "ground the agent I already created", "ground an assistant in our policies", "answer from SharePoint", "answer across our docs and our public website", "only let users see their own documents", "why am I getting a 403", "results are missing or outdated", "improve retrieval quality", "deploy this privately to production". Do not use for single-file questions, code edits, or content the repository index already answers.'
license: MIT
compatibility: "Requires Azure access for provisioning, supported Azure AI Search or Foundry IQ API/SDK/MCP interfaces, and Copilot CLI for session tool registration."
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure AI Search and Foundry IQ

## When to use

Use for search, grounded knowledge, retrieval quality, repair, production
hardening, and agents. Do not activate for ordinary code or single-file work.

## Before acting

For an authorized existing Prompt Agent, one Blob corpus, and bounded questions,
run
`python "<skill-directory>\scripts\ground_prompt_agent_blob.py" --question
"<acceptance question>"`. Scoped environment supplies inputs. Do not inspect
skill files, install packages, or rediscover APIs; wait once.

Read [discover-and-decide](discovery/discover-and-decide.md),
[architecture-choices](references/architecture-choices.md),
[defaults-and-approvals](references/defaults-and-approvals.md), and
[autonomy-modes](references/autonomy-modes.md) before mutation, and
[interfaces](references/interfaces.md) before selecting a tool. Produce the
workload profile with [qualify-workload](discovery/qualify-workload.md), and
assess [reuse-or-provision](discovery/reuse-or-provision.md) before creating any
resource.

## Development workflow

1. Inspect the app, data, Azure context, policy, identity, and resources; record
   the workload profile.
2. Select the smallest composition and least capable sufficient architecture.
3. Present one plan before billable, permission, network, production,
   destructive, or data-movement changes.
4. Apply idempotently, verify the outcome, and return rollback.

Compose needed primitives in lifecycle order: discovery, knowledge, retrieval,
evaluation, operations. Failures enter troubleshooting
directly. `Reads:` defines preconditions; the profile is the handoff.

## Intent routing

Route on the user's own words; they rarely name the product. Evaluate in table
order and match any signal.

| Workflow | Prompt signals |
|---|---|
| `diagnose-and-repair` | `403`; `401`; `denied`; `missing documents`; `missing results`; `missing from`; `outdated`; `stale`; `not working`; `failing`; `fix this indexer` |
| `harden-for-production` | `regulated`; `no public network`; `into production`; `prototype into`; `network isolation`; `private endpoint` |
| `enterprise-isolated` | `hosted agent`; `production agent`; `fabric iq`; `work iq`; `caller acl` |
| `multi-source-knowledge` | `public website`; `public web`; `several sources`; `multiple sources`; `across sources`; `combine sources` |
| `sharepoint-grounded` | `sharepoint`; `document library`; `m365 copilot` |
| `permission-trimmed` | `only see`; `each user`; `entitle`; `per-user`; `their own documents` |
| `prompt-agent-grounded` | `prompt agent`; `existing agent`; `agent i already`; `agent we already` |
| `provision-knowledge` | `provision azure ai search`; `create a foundry iq knowledge base`; `indexed and retrievable`; `make both collections retrievable`; `set up what is needed` |
| `classic-application-search` | `storefront`; `.net api`; `search endpoint`; `search page`; `add search to this app`; `facets`; `autocomplete` |
| `blob-grounded` | `blob container`; `blob prefix`; `production blob`; `connect our blob` |
| `local-files` | `folder`; `./docs`; `these files`; `local files`; `this directory` |
| `ground-agent` | `internal assistant`; `assistant grounded`; `ground an agent`; `ground our agent`; `answer from our` |
| `evaluate-and-tune` | `search-quality.jsonl`; `evaluation dataset`; `retrieval quality`; `incomplete answers`; `inconsistent citations`; `irrelevant`; `tune retrieval` |
| `harden-for-production` | `network-isolated`; `private link`; `firewall`; `lock down` |
| `none` | `summarize docs/`; `rename `; `symbol lookup` |

Evaluation adds measurement without replacing the product workflow. Failures and
promotion of existing resources never route to provisioning.
`harden-for-production` appears twice on purpose: promotion wording outranks
provisioning, while a bare isolation adjective is only decisive once no
build intent matched. `ground-agent` means the source is unstated: inventory and assess reuse first. A
route names the workflow, not the architecture; every build route uses
[architecture-choices](references/architecture-choices.md).

## Task map

| Developer task | Compose |
|---|---|
| Build classic application search | [design-index](knowledge/design-index.md) → [ingest-and-sync](knowledge/ingest-and-sync.md) → [integrate-query](retrieval/integrate-query.md) → [deploy-and-operate](operations/deploy-and-operate.md) |
| Qualify an underspecified request | [qualify-workload](discovery/qualify-workload.md) |
| Ground an agent when the source is unstated | [inventory](discovery/inventory.md) → [reuse-or-provision](discovery/reuse-or-provision.md) → a knowledge route |
| Ground a session in local files | [onboard-local](knowledge/onboard-local.md) → [retrieve-grounded](retrieval/retrieve-grounded.md) |
| Ground a session in production Blob | [connect-blob](knowledge/connect-blob.md) → [retrieve-grounded](retrieval/retrieve-grounded.md) |
| Ground an existing Foundry Prompt Agent | a source primitive → [ground-prompt-agent](retrieval/ground-prompt-agent.md) |
| Provision retrieval | [reuse-or-provision](discovery/reuse-or-provision.md) → [provision-search-service](operations/provision-search-service.md) if new → classic: [design-index](knowledge/design-index.md) → [ingest-and-sync](knowledge/ingest-and-sync.md); agentic: [provision-knowledge-source](operations/provision-knowledge-source.md) → [provision-knowledge-base](operations/provision-knowledge-base.md) |
| Ground an agent in SharePoint content | [connect-sharepoint](knowledge/connect-sharepoint.md) → [end-user-identity](knowledge/end-user-identity.md) → [verify-access](evaluation/verify-access.md) |
| Answer across several knowledge sources | [connect-enterprise-sources](knowledge/connect-enterprise-sources.md) → [retrieve-grounded](retrieval/retrieve-grounded.md) |
| Choose an extraction mode for the corpus | [process-content](knowledge/process-content.md) |
| Federate governed sources | [connect-enterprise-sources](knowledge/connect-enterprise-sources.md) → [deploy-governed-agent](operations/deploy-governed-agent.md) → [verify-access](evaluation/verify-access.md) |
| Preserve per-user permissions | [end-user-identity](knowledge/end-user-identity.md) → [verify-access](evaluation/verify-access.md) |
| Move a prototype to production | [harden-for-production](operations/harden-for-production.md) |
| Baseline quality | [measure-quality](evaluation/measure-quality.md) |
| Improve quality | [measure-quality](evaluation/measure-quality.md) → [tune-quality](evaluation/tune-quality.md) |
| Explain existing resources | [inventory](discovery/inventory.md) |
| Repair a failure | [diagnose-and-repair](troubleshooting/diagnose-and-repair.md) |

Run only the primitives the request needs: stop after design when the user asked
for design, and after measurement for a baseline. Reruns converge without
duplicate services, indexes, or endpoints.

## Guardrails

Use [interfaces](references/interfaces.md): Azure MCP is read-only; mutations use
the narrowest supported SDK, REST, or IaC surface. Use Microsoft Entra ID and
managed identity, never expose credentials or invent properties, and fail closed
on unresolved approval, policy, identity, networking, roles, or access. Never
downgrade to public access, keys, or serverless. Read only selected procedures.
