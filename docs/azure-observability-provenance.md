# Azure Observability skill plugin provenance

Contributor-only source and permission history for the
[Azure Observability skill plugin](../plugins/azure-observability/README.md).
This document is outside the shipped plugin.

## Discovery-first integration

The current integration adapts source candidate 0.3.40 into this repository's
per-plugin structure. It contains four core skills and retains unique bounded
investigation guidance beneath the coordinator.

`azure-diagnostics` and `microsoft-foundry` are external canonical specialists.
Their copied directories, corresponding bundled-skill routing evaluations and
local implementation tests have been removed. Discovery instructions retain
approval ceilings and distinguish availability, loading, access and execution.
No upstream workflow is certified by this package's offline tests.

Historical candidate 0.3.39 included adaptations of those specialists from
Microsoft's repository at commit
`fbda857c484a85c7ce644f56809b7f204471fb69`. That historical source pin does not
identify the current external dependency version or any retained specialist
copy. Resolve the actual installed origin/version at use time.

## Contributed health and investigation resources

The health assessment and nested investigation resources include separately
supplied contributions with confirmed permission to ship. No upstream license
was supplied with the original contributions. On 2026-11-16, the contributor
confirmed authority or contributors' permission to license those resources
under MIT and authorized applying MIT to this plugin.

This preserves the permission record already present in the receiving PR;
removing duplicated Microsoft specialists does not revoke or expand it.
The plugin's existing [MIT License](../plugins/azure-observability/LICENSE)
remains. This decision does not authorize publication, deployment or any other
release operation.

Concise source notices remain with the retained contributions:

- [Health source notice](../plugins/azure-observability/skills/assess-observability-health/references/SOURCE-NOTICE.md)
- [Investigation source notice](../plugins/azure-observability/skills/troubleshoot-observability/references/investigation/SOURCE-NOTICE.md)

The health renderer is retained unchanged from its supplied source.
The transaction-link helper was relocated and its default portal host changed
to `portal.azure.com`; no unchanged-byte or live portal-rendering claim is made.
The managed Prometheus client remains in the retained investigation resources.

## Receiving-repository adaptations

The isolated source used an Awesome Copilot composition convention reviewed at
commit `222eba62d518c27317e917c92e3ec1a7e6729455`. This integration uses the
receiving repository's four client manifests, source version placeholders,
per-skill NBGV configuration, routing evaluation scaffolds and shared telemetry
hooks instead. The isolated candidate number is not the generated package
version. Microsoft authorship metadata and individual CODEOWNERS serve
different purposes.

The package identity and related directories are now `azure-observability`,
with the display name "Azure Observability skill plugin". The four independently
routed skill identifiers are unchanged. Existing copyright notices and
historical source inventories retain their original contents; they are not
active package registrations. The existing PR source branch is also unchanged.
An earlier installation is not automatically migrated by this package rename.

The [installed-user README](../plugins/azure-observability/README.md)
retains the telemetry disclosure and opt-out. The existing MCP declarations
remain empty; no new backend or connection is configured.

Contributor validation tools, host-acceptance specifications and source
inventories live outside the plugin. Historical source inventories are not
current receiving-package hashes or evidence of installed-host behavior.

Deleting content from the current tree does not remove earlier Git history.
No history rewrite, commit, push or publication is authorized by this
preparation alone.

## Verification boundaries

Offline tests do not certify actual skill selection, canonical-specialist
loads, service execution, permission enforcement or recovery. Fresh VS Code
and Copilot CLI checks remain separate. Routing smoke specifications do not
prove natural-language discovery and have not been executed by this refactor.

The receiving build and validators require their existing development
dependencies. Missing dependencies are explicit blockers, not passing build
results. TypeScript test migration remains deferred; Python tests do not run
automatically through `npm run test`.
