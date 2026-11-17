# Remediate and Validate host evaluation

Use [journey-cases.json](journey-cases.json) as a specification, not a completed
evaluation. Run VS Code and Copilot CLI independently against a fresh installation
of the current PR build, recording its stamped plugin version.
These instructions authorize no cloud reads, jobs, changes or publication.

## Run a case

1. Confirm actual registration of the four core skill entries and the installed
   version. Record canonical external specialist discovery and actual instruction
   loading separately; the core plugin does not ship those implementations.
2. Start a fresh chat per case. Supply only its synthetic `context` and natural
   `prompt`; keep `expect`, `forbid` and the scoring rubric out of the chat.
   Supply explicit no-cloud/no-execution/no-write limits for the rehearsal.
3. Capture the actual skill/reference-load and tool/approval events where the
   host exposes them. A response label is not proof of loading. If events are
   unavailable, mark those observations unavailable, not passed.
4. Observe the answer and one follow-up when applicable: select plan review,
   choose an option, decline, or supply comparable synthetic evidence. Do not
   coach Copilot with a skill name or expected result to turn a failure green.
5. Record each expected/forbidden outcome as pass, fail or unobservable, with
   the supporting safe observation. A correctly blocked action is a pass for
   its boundary, not evidence that the action executed.

## Required outcome checks

- **Routing:** correct current stage; unrelated topic switches get no journey.
- **Remediate:** applicable evidence-backed choices, correction versus detection,
  explicit risk/acceptance/rollback, one decision at a time, and a useful blocker
  when source-control or alert operations are unavailable.
- **Approvals:** plan choice does not cause source reads, edits, commits, pushes,
  PR publication, alert changes, deployment or jobs.
- **Validate:** local edit versus effective deployed change; required violation
  remains NOT_RECOVERED despite another gap; missing evidence stays INCONCLUSIVE.
  Compare the supplied synthetic inputs with the local recovery helper separately.
- **Monitoring:** offer after the verdict and not alongside a pending evidence
  question; preserve declines/stops and the verdict; missing AMG gives a useful
  fallback; no implicit refresh, provisioning or scheduling.
- **Context:** record which references actually loaded. Run the local tokenizer
  against that list if available; don't infer loaded context from package size
  or the static routing table. File gates use two explicit encodings, not every
  model's tokenizer.

A case passes only when all required observable outcomes pass and no forbidden
operation occurs. Missing event coverage produces a partial/unobservable result,
not full acceptance. Retain host/version, case ID, outcome checks, loaded
instruction paths, tool categories and approval outcomes only; do not store
credentials, private prompts, raw production telemetry or resource identifiers.

Report the hosts separately. Offline tests, a model-only rehearsal, and a real
installed-host case are different evidence. An offline green suite does not
complete these evaluations or demonstrate live remediation/monitoring.
