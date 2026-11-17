# Azure Observability Skills contribution provenance

Contributor information; this file is not part of the installed plugin.

The four observability workflows and their helpers were adapted from the
contributor-supplied observability candidate. Permission to ship the contributed
health and affected-path investigation resources was confirmed on 2026-11-11.
On 2026-11-16, the contributor confirmed authority or contributors' permission
to license those contributions under MIT and authorized applying MIT.

The initial draft bundled adapted Microsoft `azure-diagnostics` and
`microsoft-foundry` packages inspected at revision
`fbda857c484a85c7ce644f56809b7f204471fb69`. Both standalone copies and their
broader lifecycle/platform resources have been removed. The installed package
instead identifies the existing specialists as optional external skills.
The retained local investigation references are the contributed affected-path
workflow, trace-query patterns, managed-Prometheus source distinctions,
Foundry-to-application routing and confidence rubric, not either complete
Microsoft specialist library.

The contributed health renderer remains unchanged. The transaction-link helper
uses `portal.azure.com`; construction tests do not establish live portal rendering.
Original contribution history and review records remain in Git. Removing files
from the current package does not rewrite that history.

The plugin's MIT license does not certify publication, installed-host behavior,
live Azure access, model routing, or the effectiveness of approval instructions.
Use the test prompt inventory and validation results in
`tests/azure-observability-skills` to distinguish specifications, offline helper
tests and actual agent/host evidence.
