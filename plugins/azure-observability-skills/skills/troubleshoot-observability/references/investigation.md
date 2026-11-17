# Investigate the affected path

Use the named incident or developer-selected finding, not a mandatory health
sweep. This is local observability guidance, not a bundled replacement for the
broader Azure diagnostics or Foundry skill.

1. Read [availability](investigation/availability.md) and
   [retain scope](investigation/scope.md).
2. Select the [execution path](investigation/execution.md): sufficient supplied
   evidence or existing authorized direct telemetry is the default.
3. Use [bounded evidence collection](investigation/evidence.md) only for
   unanswered material questions; inherit tighter read/time/row ceilings.
4. [Validate confidence](investigation/confidence.md) before asserting a cause.
5. [Return findings](investigation/reporting.md) and an unexecuted next-action
   proposal. New edits, deployment and recovery collection need separate approval.

For service/platform diagnosis, prefer an available `azure-diagnostics` skill.
For AI-specific trace/troubleshoot analysis, prefer available `microsoft-foundry`.
Resolve actual host loading and instructions; never assume these are local
sibling folders or install them silently. If needed and missing, offer approved
installation through the host's Azure skills marketplace, then verify availability.
Without them, analyze sufficient supplied evidence under these local bounds and
name unsupported questions explicitly. Never claim an absent specialist ran.
