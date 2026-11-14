# Notices and provenance

This local review draft imports four skills from the prepared source at
revision `18f482ad23660251933e91fd7d61e61d76b876ef`. See the
[source notice](https://github.com/nuzhatminhaz_microsoft/ignite-plugin-observability-v1/blob/18f482ad23660251933e91fd7d61e61d76b876ef/NOTICE.md)
for the complete provenance of that candidate.

## Contributor

Nuzhat Minhaz.

## Licensing and attribution

On 2026-11-13, the user confirmed that the rights holder approved releasing
the separately supplied health contribution under MIT. The earlier source
notice recorded permission to ship but did not itself grant an MIT license or
declare a repository-wide license for the prepared source. Receiving-project
license acceptance and approved public attribution remain required before
submission. See
[health provenance](skills/assess-observability-health/references/provenance.md).

## Microsoft specialist sources

The source candidate includes adapted Azure diagnostics and Microsoft Foundry
specialists derived from
[microsoft/GitHub-Copilot-for-Azure](https://github.com/microsoft/GitHub-Copilot-for-Azure)
at commit `fbda857c484a85c7ce644f56809b7f204471fb69`. This draft imports those
adapted trees as references under `skills/troubleshoot-observability/references/`
(`azure-diagnostics/` and `microsoft-foundry/`), with their original
`LICENSE.md` files retained. They are not registered as separate skills, and
their integration with the receiving repository's existing specialists
requires review.

## Imported investigation and specialist-derived content (license review pending)

The following content was imported from the source repository at revision
`18f482ad23660251933e91fd7d61e61d76b876ef` and still requires its own license
review. The MIT confirmation above applies only to the health contribution; it
does **not** extend to this content:

- the nested affected-path investigation workflow, its references and the
  Prometheus helper (`skills/troubleshoot-observability/references/azure-diagnostics/investigation/`);
- the local adaptations, execution boundaries and provenance records within
  the imported `azure-diagnostics` and `microsoft-foundry` reference trees;
- the source documentation (`docs/`), including the verbatim
  [source notice](docs/source-notice.md) and [source README](docs/source-readme.md);
- the imported Python tests under `tests/skills/observability-super-skill/`
  and the evaluation scenarios converted to `evals/observability-super-skill/`.

See the
[investigation provenance](skills/troubleshoot-observability/references/azure-diagnostics/investigation/references/provenance.md),
[diagnostics provenance](skills/troubleshoot-observability/references/azure-diagnostics/references/provenance.md)
and [Foundry provenance](skills/troubleshoot-observability/references/microsoft-foundry/references/provenance.md).

## Verification boundaries

Offline helper tests and building the draft do not certify Copilot selection,
service execution, permission enforcement, or recovery. Installed-client
checks and receiving-repository validation remain separate.
