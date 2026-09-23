# AKS Skills

AKS-focused operational skills maintained as a budget-isolated sibling plugin.

## Security

> [!WARNING]
> The `aks-skills` plugin's bundled telemetry hooks use `npx` to download and run the Azure MCP Server, inheriting the local environment's `.npmrc` configuration. Install this plugin only on trusted devices. A compromised `.npmrc` configuration could cause `npx` to download and execute malicious code, potentially resulting in remote code execution.

## Skills

- **aks-gpu-inference** - Diagnose existing AKS GPU and KAITO inference incidents with profile-aware, read-only evidence.
- **aks-known-issues** - Match named AKS failure signatures to documented causes, fixes, and Microsoft Learn references.
- **aks-network-capture** - Collect bounded packet captures from selected AKS nodes and gather Azure network configuration for wire-level troubleshooting.
- **aks-troubleshooting** - Investigate live AKS incidents with target-bound, read-only evidence collection and structured root-cause reporting.

Migrated from `Azure/AKS-Skills` PR #99 at commit
`5f7d3910b30a93d49e3f0f657ac478ca01b7c870`; the troubleshooting public-canary
evals trace to PR #102 commit `6c17c636e9b11fa44b82e026edc14226f9f197cb`.

## Authoring rules

- Separate observed evidence from inference; causal branches are hypotheses
  until target-bound evidence supports one.
- State applicability for profile-, platform-, and feature-specific guidance.
- Keep mutation approvals in the entry workflow, before commands or resources.
- Preserve missing or inaccessible data as unknown; never convert it to absence.
- Use public first-party sources for factual guidance and keep examples distinct
  from required customer evidence.

## Publication and installation

The shared [publish workflow](https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/workflows/publish-to-marketplace.yml)
copies the built sibling payload to `.github/plugins/aks-skills` and updates
the marketplace catalogs in the same generated downstream pull requests. Those
pull requests still require maintainer review and merge before the install name
is available. The workflow does not replicate AKS skills into the
`microsoft/azure-skills` repository root.

The publisher updates the `microsoft/azure-skills` (`.claude-plugin`,
`.cursor-plugin`) and `microsoft/skills` (`.claude-plugin`, `.github/plugin`)
`marketplace.json` catalogs with an `aks-skills` entry whose source is
`./.github/plugins/aks-skills` and whose description comes from the built
manifest. Unrelated entries remain in place; no portal or application
registration step exists.

- **Claude Code / compatible CLI (after the generated catalog change merges):** add the
  `microsoft/azure-skills` marketplace, then install
  `aks-skills@azure-skills`. Update with `/plugin update aks-skills@azure-skills`
  (`plugin update` takes `plugin-name@marketplace-name`); this repository
  ships no updater, and merging source here does not update installed copies.
  Under managed plugin policy: if policy blocks installing or enabling the
  plugin, it is unavailable on that host, so continue with base Azure guidance;
  if policy only pins or blocks updates, the installed approved version stays
  usable within its documented capabilities — use it, say it is pinned, and do
  not bypass the restriction.
- **SRE Agent:** add the `microsoft/azure-skills` marketplace, select the
  `aks-skills` plugin, and record the installation's pinned commit SHA.
  Updates are explicit. If an integration requires an MCP connector, configure
  it separately; installing skills does not provision credentials or connectors.
  Do not use the repository-root Azure plugin URL as an AKS sibling install.

  **Stable identifiers.** The four skill ids and the `references/` paths
  inside each skill are stable identifiers consumers may pin to; renaming or
  removing one goes through a deprecation note in this README and the plugin
  `CHANGELOG.md` first. The published commit SHA is the immutable identity of
  an installation; `version.json` versions are semantic, stamped by NBGV at
  build time, and never hand-edited.
- **Folder consumers:** use
  `microsoft/skills/.github/plugins/aks-skills/skills/` at an exact published
  commit SHA.

## Base Azure and optional AKS operations

The base `azure` plugin continues to provide AKS recommendation, Day-0
planning, cluster setup, deployment, readiness, and basic diagnostics. This
sibling adds four deeper operational skills; it is not an automatic dependency
and installation requires explicit customer consent. When already available,
use the relevant focused skill for the requested task subject to host policy.

When the current task would benefit from one of these focused skills, use the
host's available-skill inventory or an approved read-only host capability to
check whether it is present. If present and relevant to the requested task,
invoke only that skill through the host's native skill mechanism. If absent,
explain the benefit and ask before using the host-supported plugin manager.
After installation, confirm the skill appears in the host's inventory before
invoking it; if the host activates new components only in a new session or
after a restart, say so and continue with base guidance now. If
installation is declined or the host cannot install or execute the add-on,
continue with the base Azure guidance and supplied evidence rather than
stopping.

Skill bodies and `references/` documents are selected on demand; installing
the plugin does not load every reference into every conversation.

### Relationship to the base `azure-diagnostics` AKS guide

`azure-skills/skills/azure-diagnostics/troubleshooting/aks/` is the intentional
baseline for customers without this add-on. `aks-skills/skills/aks-troubleshooting/`
is the deeper version of the same topics. Eleven files share names across the
two directories (two identical, the rest overlapping); the baseline may say
less and carries its own scripts. Both describe the same tool boundary: the Azure MCP AKS area provides cluster and node-pool metadata only,
`kubectl` never runs through it, and the separate `Azure/aks-mcp` server is not
configured by either plugin.

Maintenance rule: when a fact, command, or safety boundary changes, update the
focused skill first, then the same-named baseline file. Baseline files may say
less than the focused skill; they must not say the opposite.

## Telemetry readiness

The bundled hooks report session-start and skill-use events through the Azure
MCP `server plugin-telemetry` command, launched with `npx`, and honor
`AZURE_MCP_COLLECT_TELEMETRY=false`. Local hook tests replace `npx` with a mock;
they validate event construction, plugin ownership, and opt-out behavior, but
do not prove that the telemetry receiver accepts or records an event. The
repository's standalone `telemetry-reporter` embeds pinned copies of the same
Azure MCP allowlists; it is not what the shipped hooks invoke, and its pinned
copies currently contain no `aks-*` skill names either.

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