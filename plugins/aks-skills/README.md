# AKS Skills

AKS-focused operational skills maintained as a budget-isolated sibling plugin.

## Skills

- **aks-gpu-inference** - Diagnose existing AKS GPU and KAITO inference incidents with profile-aware, read-only evidence.
- **aks-known-issues** - Match named AKS failure signatures to documented causes, fixes, and Microsoft Learn references.
- **aks-network-capture** - Collect bounded packet captures from selected AKS nodes and gather Azure network configuration for wire-level troubleshooting.
- **aks-troubleshooting** - Investigate live AKS incidents with target-bound, read-only evidence collection and structured root-cause reporting.

The skills were migrated from `Azure/AKS-Skills` PR #99 at commit
`5f7d3910b30a93d49e3f0f657ac478ca01b7c870`. The troubleshooting
public-canary evals trace to PR #102 source commit
`6c17c636e9b11fa44b82e026edc14226f9f197cb`.

## Authoring rules

- Separate observed evidence from inference; causal branches are hypotheses
  until target-bound evidence supports one.
- State applicability for profile-, platform-, and feature-specific guidance.
- Keep mutation approvals in the entry workflow, before commands or resources.
- Preserve missing or inaccessible data as unknown; never convert it to absence.
- Use public first-party sources for factual guidance and keep examples distinct
  from required customer evidence.

## Publication and installation

> Pending catalog registration: the [publish workflow](https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/workflows/publish-to-marketplace.yml)
> syncs the built
> `aks-skills` payload into downstream `.github/plugins/aks-skills` directories,
> but it does not add marketplace catalog entries. Those entries require
> separate maintainer-approved manual changes. The install name below becomes
> available only after the corresponding catalog entry is merged.

The publish workflow copies the built sibling payload to
`.github/plugins/aks-skills` in the downstream repositories. It does not
replicate AKS skills into the `microsoft/azure-skills` repository root.

The current catalogs do not contain an AKS entry. At publication time,
maintainers must add `aks-skills` manually to all four downstream catalogs:

- `microsoft/azure-skills/.claude-plugin/marketplace.json`
- `microsoft/azure-skills/.cursor-plugin/marketplace.json`
- `microsoft/skills/.claude-plugin/marketplace.json`
- `microsoft/skills/.github/plugin/marketplace.json`

Each entry uses the name `aks-skills`, source
`./.github/plugins/aks-skills`, and the description from the built plugin
manifest. Merge the payload synchronization before, or atomically with, a
catalog entry so the catalog never points to a missing payload. No separate
portal or application registration step is part of this repository's
publication procedure.

- **Claude Code / compatible CLI (after catalog registration):** add the
  `microsoft/azure-skills` marketplace, then install
  `aks-skills@azure-skills`.
- **SRE Agent:** add the `microsoft/azure-skills` marketplace, select the
  `aks-skills` plugin, and record the installation's pinned commit SHA.
  Updates are explicit. If an integration requires an MCP connector, configure
  it separately; installing skills does not provision credentials or connectors.
  Do not use the repository-root Azure plugin URL as an AKS sibling install.

  **Stable identifiers.** The skill ids `aks-troubleshooting`,
  `aks-known-issues`, `aks-network-capture`, and `aks-gpu-inference` and the
  `references/` paths inside each skill are stable identifiers that consumers
  may pin to. Renaming or removing one goes through a deprecation note in this
  README and the plugin `CHANGELOG.md` before the old id or path disappears. The
  published git commit SHA is the immutable identity of an installation; the
  per-skill and plugin `version.json` versions are semantic, stamped by NBGV at
  build time from commit history, and never hand-edited.
- **Folder consumers:** use
  `microsoft/skills/.github/plugins/aks-skills/skills/` at an exact published
  commit SHA.

## Telemetry readiness

The bundled hooks use the existing Azure MCP plugin-telemetry command and honor
`AZURE_MCP_COLLECT_TELEMETRY=false`. Local hook tests replace `npx` with a mock;
they validate event construction, plugin ownership, and opt-out behavior, but
do not prove that the telemetry receiver accepts or records an event.

After this plugin merges, the existing
[Azure MCP allowlist sync workflow](https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/workflows/sync-to-azure-mcp.yml)
generates skill-name and reference-path allowlists from every
`plugins/*/skills` directory. AKS ingestion is not ready until the resulting
`microsoft/mcp` synchronization PR is merged by an MCP maintainer and a
containing `@azure/mcp` package is released. Until then, the receiver's
Azure/Kusto-only allowlists reject AKS names and paths. Installing the plugin or
passing local hook tests must not be reported as completed telemetry ingestion.

Merging the GHCP source change alone is not an archive signal. Before retiring
the source, verify that both payload and catalog entries are published, run a
supported-client installation smoke test, publish an explicit migration notice
with an accountable owner, and resolve all remaining source-only behavior.