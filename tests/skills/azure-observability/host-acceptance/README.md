# Contributor host acceptance suite

This is the canonical maintainer suite, organized by scenario rather than skill
or historical release. It is not runtime skill guidance. Host acceptance
instructions and developer provenance do not ship with the four core skills.
Synthetic JSON specifications live under `../fixtures/<skill>/references/`,
outside the plugin payload; reading a fixture does not load or register a skill.

## Run and record once per scenario, separately per host

Run VS Code and Copilot CLI separately in fresh installed-package chats outside
the skill-source checkout unless a case explicitly tests source-workspace reads.
Record the actual loaded manifest/path/version and all four exposed entries:
`troubleshoot-observability`, `connect-observability`,
`assess-observability-health`, `verify-observability-fix`.
Canonical `azure-diagnostics` and `microsoft-foundry` are external dependencies,
not bundled entries. Record their independent discovery, version, supported
instruction-load event and operation contracts when selected; do not infer
availability, setup safety or compatibility from this package.
Four physical entries, a lexical frontmatter check, an
archive/schema check or source version do not prove registration/cache freshness.
Use only supported refresh/reinstall controls with applicable approval; disable
duplicate older copies, do not edit caches or load workspace and plugin copies
simultaneously. Catalog visibility and actual loads are separate gates.

For every case record:

- Host/version, workspace and installation mode; exact synthetic prompt,
  evidence provenance/freshness and approval ceiling.
- Actual instruction-load event/path, or permitted local instruction read,
  entry/sub-workflow, ordering relative to operations and manual help required.
- Planned versus actual operation names and sanitized inputs, identity,
  source/destination, UTC scope, requested/effective rows and remaining budgets.
- Outputs/errors, original and effective evidence states, truncation/coverage,
  context retained, skipped steps and concrete fallback reason.
- Attempted side effect, consent decision and whether it executed.
- Response/display fidelity and PASS, FAILED, BLOCKED, UNRUN or activation
  unverified. Skill-name prose is not a load event; insufficient host trace
  cannot prove activation. Generated graphics and actual rendering differ.

Default ceiling: supplied synthetic evidence and native skill loads/local
instruction reads only. No Azure/network/schema discovery, auth, installs,
scripts/helpers, edits, persistence, jobs, traffic or deployment is authorized
by this suite. A fixture's environment does not change actual host availability.
Live/setup/render/save/service cases require separately agreed scope, budgets
and applicable action approval. Do not invoke a real service to pass offline tests.
Keep private paths, transcript identifiers, credentials and sensitive raw
application prompts/responses or telemetry out of records and fixtures.

## Canonical scenario groups

| Group | Cases and supporting fixtures |
|---|---|
| [Connection and prerequisites](onboarding.md) | Explicit/natural selection, tools-only mode, helper reads, persistence, setup; `../fixtures/connect-observability/references/preflight-cases.json` |
| [Health and selected-finding handoff](health.md) | Stable health, external review, evidence states, budgets, renderer/portal and ranked handoffs; health `integration-cases.json`, coordinator `acceptance.json` |
| [Focused investigation](investigation.md) | Retained affected-path investigation, external diagnostics/Foundry discovery and handoff, semantic boundaries, evidence fidelity, standalone availability |
| [Trace selection](trace-selection.md) | Organic retrieval, capability decision timing, identity, content, budgets, failures; coordinator `trace-selection-cases.json` |
| [Optional capabilities and services](optional-services.md) | Matching, acquisition, SRE review/execution controls, AMG dashboard; coordinator `matching-cases.json` |
| [Journey and continuation](journey.md) | Intent, presentation, approvals, fix review/edit and recovery; coordinator `intent-cases.json`, `next-action-cases.json`, `acceptance.json` |

Apply the common record/approval rules to every group rather than repeating a
host history per skill. Compare each fixture's expected and forbidden claims/
operations; equivalent plain language is acceptable. Fixture and instruction
checks are offline contracts, not actual model selection or SRE live execution.

## Truthful validation limits

All current-candidate installed-host acceptance gates: **VS Code UNRUN; CLI
UNRUN**. Registration, natural activation, handoffs, UI rendering, approval
refusal, real denied/throttled tools, auth, live telemetry, portal navigation,
AMG writes, SRE recommendation and execution remain independently unverified.
No source test or previous package run closes these gates. Earlier partial
operation evidence cannot certify a new candidate, population completeness,
general ID equivalence, organic routing or advanced analysis. A separately
approved retrieval can pass partially while aggregation fails and advanced
analysis remains NOT TESTED; record each operation independently.
Supplied/frozen lab exports are evidence, not authorization to reset a lab.
External specialist lifecycle workflows are not bundled or certified here.
