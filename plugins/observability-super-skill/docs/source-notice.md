# Notices and provenance

Azure Observability Skill Plugin contains six skills and their referenced
resources. This 0.3.38 candidate uses the Awesome Copilot in-repository source
composition layout. It is not an accepted contribution or a published product.

## Microsoft specialist sources

The adapted Azure diagnostics and Microsoft Foundry skills originate from
[microsoft/GitHub-Copilot-for-Azure](https://github.com/microsoft/GitHub-Copilot-for-Azure)
at commit `fbda857c484a85c7ce644f56809b7f204471fb69`.
Their original license and copyright notices remain with the skills:

- [Azure diagnostics license](../skills/troubleshoot-observability/references/azure-diagnostics/LICENSE.md)
- [Microsoft Foundry license](../skills/troubleshoot-observability/references/microsoft-foundry/LICENSE.md)

See the [diagnostics provenance](../skills/troubleshoot-observability/references/azure-diagnostics/references/provenance.md)
and [Foundry provenance](../skills/troubleshoot-observability/references/microsoft-foundry/references/provenance.md) for
adaptations. Retaining a workflow does not establish its live availability,
external access, or tested host compatibility.

## Contributed health and investigation resources

The health assessment and nested investigation resources include separately
supplied contributions with confirmed permission to ship. No upstream license
was supplied for those contributions; that permission is not an MIT grant.
Receiving-project license acceptance and approved public attribution remain
required before submission.

See [health provenance](../skills/assess-observability-health/references/provenance.md)
and [investigation provenance](../skills/troubleshoot-observability/references/azure-diagnostics/investigation/references/provenance.md).
No repository-wide license is declared.

## Public-source preparation

This candidate removes the restricted investigation-service implementation and
its routing, protocol documentation, tests, and nonpublic development narratives.
It retains direct diagnostics, health assessment, existing-result analysis,
trace-capability selection, optional SRE review, onboarding, and recovery
comparison with their approval boundaries.

The transaction-link helper uses the customer Azure portal default. Its
adaptation is recorded with the health resources; no unchanged-byte or live
portal-rendering claim is made.

The source manifest follows the scaffold and composition convention reviewed at
Awesome Copilot commit `222eba62d518c27317e917c92e3ec1a7e6729455`.
The scaffold's default MIT declaration and published-install command were not
adopted: licensing and catalog inclusion have not been established.
No Azure onboarding hooks, telemetry collection, or new MCP backend were added.

The candidate inventory (`tests/candidate-inventory.json`, not imported) records the current
source hashes. Historical private export records are excluded from the public
candidate rather than represented as current assets.

Deleting content from the current tree does not remove it from earlier Git
commits. Keep the existing repository private; review a clean contribution
snapshot before any public publication. No history rewrite is authorized by
this preparation.

## Verification boundaries

Offline package and helper tests do not certify Copilot selection, service
execution, permission enforcement, or recovery. Fresh VS Code and Copilot CLI
checks remain separate. Public submission additionally requires target-repository
validation, license acceptance, and review of existing specialist duplication.
