# Notices and provenance

Azure Observability Skill Plugin contains six skills and their referenced
resources. This local draft imports source candidate 0.3.39 and adapts it to
this repository's per-plugin structure. It is not an accepted contribution
or a published product.

## Microsoft specialist sources

The adapted Azure diagnostics and Microsoft Foundry skills originate from
[microsoft/GitHub-Copilot-for-Azure](https://github.com/microsoft/GitHub-Copilot-for-Azure)
at commit `fbda857c484a85c7ce644f56809b7f204471fb69`.
Their original license and copyright notices remain with the skills:

- [Azure diagnostics license](skills/azure-diagnostics/LICENSE.md)
- [Microsoft Foundry license](skills/microsoft-foundry/LICENSE.md)

See the [diagnostics provenance](skills/azure-diagnostics/references/provenance.md)
and [Foundry provenance](skills/microsoft-foundry/references/provenance.md) for
adaptations. Retaining a workflow does not establish its live availability,
external access, or tested host compatibility.

## Contributed health and investigation resources

The health assessment and nested investigation resources include separately
supplied contributions with confirmed permission to ship. No upstream license
was supplied with the original contributions. On 2026-11-16, the contributor
confirmed authority or contributors' permission to license those resources
under MIT and authorized applying MIT to this plugin.

See [health provenance](skills/assess-observability-health/references/provenance.md)
and [investigation provenance](skills/azure-diagnostics/investigation/references/provenance.md).
This plugin is distributed under the [MIT License](LICENSE). The original
Microsoft copyright and MIT notices remain intact. This licensing decision
does not alter the receiving repository's license or authorize publication,
deployment, or other release operations.

## Public-source preparation

This candidate removes the restricted investigation-service implementation and
its routing, protocol documentation, tests, and nonpublic development narratives.
It retains direct diagnostics, health assessment, existing-result analysis,
trace-capability selection, optional SRE review, onboarding, and recovery
comparison with their approval boundaries.

Source candidate 0.3.39 conditionally selects smaller runtime guides, keeps
detailed host acceptance in contributor tests, adds evidence-backed remediation
choices and optional post-verdict monitoring, and supplies local tokenizer
validation. These changes do not establish installed-host outcomes or grant
execution rights. Its standalone CI workflow is not imported into this repo.

The transaction-link helper uses the customer Azure portal default. Its
adaptation is recorded with the health resources; no unchanged-byte or live
portal-rendering claim is made.

The original source manifest followed the composition convention reviewed at
Awesome Copilot commit `222eba62d518c27317e917c92e3ec1a7e6729455`.
The imported plugin now uses this repository's generated client manifests,
NBGV versions, routing evaluation scaffolds, and shared telemetry hooks.
See the [README telemetry disclosure](README.md#telemetry) for opt-out details.
The MIT declaration now applies with the contributor's confirmed authorization.
Catalog inclusion has not been established.
No new MCP backend is bundled; both MCP declarations are empty.

The original candidate inventory is retained under
`tests/skills/observability-super-skill/candidate-inventory.json` in the
receiving repository as historical input evidence, not current package hashes.
Repository adaptations include manifest metadata, source version placeholders,
LF normalization, skill-local copies of shared reference contracts, and
rebased documentation and offline tests. Historical private export records
are excluded rather than represented as current assets.

Deleting content from the current tree does not remove it from earlier Git
commits. Review a clean contribution snapshot and its history before any
public publication. No history rewrite is authorized by this preparation.

## Verification boundaries

Offline package and helper tests do not certify Copilot selection, service
execution, permission enforcement, or recovery. Fresh VS Code and Copilot CLI
checks remain separate. Public submission additionally requires target-repository
validation, attribution review, and review of existing specialist duplication.
