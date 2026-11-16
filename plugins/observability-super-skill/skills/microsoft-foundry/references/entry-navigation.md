# Conditional Foundry entry guidance

Reading grants no execution approval. The compact entry and execution boundaries
supersede automatic setup, cache, invocation, jobs, edits and deployment. Supplied
evidence needs none of these; insufficient evidence remains INCONCLUSIVE.

Choose only the topic needed now. These are retained detailed instructions,
not a checklist to read on load.

| Current need | Selected guidance |
|---|---|
| Standalone or ambiguous current intent | [Availability and intent](entry--standalone-availability-gate-current-request-intent-gat.md), then [intent/presentation details](entry--current-request-intent-gate.md) only if relevant |
| Reusing evidence or planning the initial read | [Evidence-first entry](entry--evidence-first-entry.md) |
| Completed findings or SRE/next-action review | [Continuation](entry--evidence-first-entry-4.md); check shared availability first |
| An accepted visual choice or unresolved platform boundary | [Visual choices and platform handoff](entry-handoff-and-visuals.md); check shared availability first |
| An explicit CLI/lifecycle action | [Pre-execution requirements](entry--pre-execution-requirements-dependency-check-and-setup-w.md); then only its selected workflow |
| Selecting a separately approved lifecycle capability | [Lifecycle navigation](lifecycle-navigation.md) |
| Approved local workspace/advanced setup | [Workspace and setup](entry--agent-foundry-workspace-standard-agent-setup-references.md) |
| Missing deployment-context hints in an explicitly selected workflow | [Root and environment](entry--step-1-discover-agent-roots-and-azd-context-step-2-reso.md) |
| Explicit metadata overlay/eval intent | [Overlay and eval.yaml](entry--step-3-select-metadata-overlay-and-resolve-environment-.md) |
| Approved metadata write or unresolved configuration | [Common configuration and writes](entry--step-5-resolve-common-configuration-step-6-write-metada.md) |
| Classifying a selected agent | [Agent types](entry--agent-agent-types.md) |
| Selected authentication/convention or network question | [Tool/auth/network guidance](entry--tool-usage-conventions-azure-authentication-additional-.md); [network errors](entry--network-isolation-errors.md) only for that symptom |

Known facts need no re-discovery. Metadata and source hints do not prove live
deployment or access. Missing/denied/empty telemetry does not establish an
instrumentation gap. Host activation, available tools and execution are separate.

For packaging/context verification only, see [context reduction](context-reduction.md).
