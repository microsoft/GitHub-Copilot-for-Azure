# Investigation validation gates

All cases below are synthetic acceptance criteria, **not executed host results**.
Run VS Code and Copilot CLI separately with this installed candidate and record
host/version, actual load paths, operations, approvals, outcomes and gaps.
Do not invoke a real service to pass offline tests.

## Standalone availability gate

Check availability before reading cross-skill host-test guidance below.
Use available shared guidance unchanged; never download, install or require a
missing sibling-file read. If absent, keep these local acceptance criteria,
record unavailable shared cases and installed-host behavior as UNRUN, and
continue permitted standalone investigation. Missing test guidance is not
telemetry access, optional-service approval or evidence of live execution.

For 0.3.37 direct diagnostics, also run the shared
[SRE recommendation gates](../../../host-tests.md)
without loading the coordinator for presentation. Verified connection/advantage
may justify one review choice only. Accepted review performs no service
operation, thread, transfer, persistence or new read. Explicit requests enter
review directly. Recommendations and SRE execution
are unrun separately in VS Code and CLI; the 0.3.36 trace gates remain unchanged.

Isolated 0.3.29 adds operation-based trace analysis and direct/optional-service
selection guards. Run the shared coordinator
`references/trace-selection-cases.json` from this installed package without
claiming that reading fixtures loads that skill. Confirm relevant Monitor
evidence proceeds without mandatory AppLens; retain applicable platform
diagnostics only for an unanswered question. Verify sufficient results do not
trigger redundant service delegation and SRE explicit requests retain real
coverage/permissions blockers and separate action consent.
These are unrun installed-host gates, not observed model behavior.

| Case | Expected behavior |
|---|---|
| Named web/API failure; supplied evidence only | Loads diagnostics workflow, retains scope/window, no Python/auth/network/save or broad health; separates observed mechanism and cause |
| Several ranked findings | Developer selects original rank; no rank-1 assumption, substitution or reassessment |
| Failed agent tool with caught exception/fallback | Foundry handles AI semantics; diagnostics handles only unresolved dependency boundary; no handoff loop |
| Denied Prometheus, healthy Perf, running pod | Permission/coverage gap, not pressure ruled out or healthy; no helper auto-run |
| Empty/stale/malformed/truncated evidence | Distinct evidence states; INCONCLUSIVE where material; bounded schema correction consumes budget |
| Fix recommendation only | No edits/deploy/recovery claim; comparator only after an actual approved change and supplied before/after evidence |

Offline tests exercise public Prometheus scope/parse/failure behavior with mocks plus
instruction/resource contracts. They cannot establish skill selection or service
eligibility. Installed/direct-tool/portal navigation/recovery gates remain
unrun until separately approved access and execution are available.
