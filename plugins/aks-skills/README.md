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

> Pending publication: the `aks-skills` catalog entries become available only
> after this repository's generated downstream sync PRs are reviewed and merged.

The publish workflow copies the built sibling payload to
`.github/plugins/aks-skills` in the downstream repositories. It does not
replicate AKS skills into the `microsoft/azure-skills` repository root.

- **Claude Code / compatible CLI:** add the
  `microsoft/azure-skills` marketplace, then install
  `aks-skills@azure-skills`.
- **SRE Agent:** add the `microsoft/azure-skills` marketplace, select the
  `aks-skills` plugin, and record the installation's pinned commit SHA.
  Updates are explicit. If an integration requires an MCP connector, configure
  it separately; installing skills does not provision credentials or connectors.
  Do not use the repository-root Azure plugin URL as an AKS sibling install.
- **Folder consumers:** use
  `microsoft/skills/.github/plugins/aks-skills/skills/` at an exact published
  commit SHA.

Merging the GHCP source change alone is not an archive signal. Before retiring
the source, verify that both payload and catalog entries are published, run a
supported-client installation smoke test, publish an explicit migration notice
with an accountable owner, and resolve all remaining source-only behavior.