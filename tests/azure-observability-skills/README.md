# Azure observability contributor tests

## Run offline regressions

From the repository root:

```powershell
npm --prefix tests test -- azure-observability-skills
npm --prefix tests run typecheck
npm --prefix tests run lint -- azure-observability-skills
node tests/node_modules/@microsoft/vally-cli/dist/index.js lint --eval-spec evals/azure-observability-skills --strict
npm --prefix scripts run vally -- validate-stimulus
```

Use the repository's existing Node/test dependencies, Python 3 (standard library
only), and Git. Set `OBS_TEST_PYTHON` to an interpreter executable if `python`
is not on PATH. No Python unittest suite, pip requirements, tokenizer, npm
dependency addition, Azure access or credentials are needed.

The TypeScript tests invoke the actual shipped helpers under
`plugins/azure-observability-skills/skills`. Deterministic assessment tests
call the helpers' public `assess(value, now)` functions through a small Python
subprocess adapter; CLI regressions invoke the scripts directly. Fixtures
contain synthetic scope/IDs and measured aggregates, never production data.
Temporary files and isolated Git repositories are removed after each test.
No Bash or platform-specific shell syntax is used.

Covered behaviors:

- Recovery fractions/means/p95, threshold boundaries, original-symptom and
  target coverage, confirmation/version/workload gates, freshness, chronology,
  observed span and sample sufficiency; required violation precedence over
  missing baseline/guardrail and supporting evidence.
- Readiness distinguishes supplied usable/empty/denied/stale/partial data;
  optional gaps limit coverage instead of proving health.
- Strict JSON/size/number/identity checks and sanitized errors; mapping
  persistence requires consent, a Git-ignored untracked non-redirected path,
  explicit replacement, and subsequent live revalidation.
- SVG label escaping, unavailable data, measured annotations, invalid chart
  inputs; trace-item UUID/time/table/duration validation and semantic URL payload.

## Complete prompt list for review/sharing

[prompt-inventory.md](prompt-inventory.md) is the self-contained full list:
all preserved journey/intent/matching/trace/preflight/acceptance cases, complete
host-acceptance documents, and the current four suites' natural-language
prompts and outcome rubrics. It preserves expectations and approval/evidence
boundaries, not just prompt strings.

The `fixtures/runtime-source` tree is an archival snapshot from before runtime
cleanup. Identical shared copies are consolidated into the coordinator's
`troubleshoot-observability/references` copy. Historical specialist directories
in this **test fixture archive** do not ship skills or require specialists.
Provenance is retained for contributor reference. Old six-skill/package/layout
claims and broken runtime-relative links are historical, not current gates.
Current runtime consists of four skills; azure-skills specialists are optional
external dependencies.

### Maintenance strategy

- Attach or link the complete prompt inventory as a PR artifact for review
  with the azure-skills team; this repository artifact does not mean it has
  already been sent to them.
- Maintain a small, stable risk-based scenario set: natural-language skill
  selection, stage continuity, missing/denied/empty/stale evidence,
  permission/no-write limits, and recovery-precedence outcomes. Keep the
  complete inventory available without multiplying near-duplicate evals.
- Rerun the stable scenarios when the model, agent or runtime changes.
  Run helper regressions and strict metadata lint independently of model runs;
  record model/host versions and actual outcomes, including unobservable gates.
- Add focused regressions for reported failures, with sanitized evidence and
  explicit expected/forbidden outcomes. Promote representative cases to the
  stable set rather than preserving brittle prose, file-layout or copy hashes.

Regenerate after editing source fixtures or evals:

```powershell
node --import ./tests/node_modules/tsx/dist/loader.mjs tests/azure-observability-skills/prompt-inventory.ts --write
```

## Evaluation and coverage limitations

The four Vally suites use natural-language supplied-evidence scenarios,
repository `prompt` rubrics, invocation/completion graders, tool-call
prohibitions and explicit scoring. Static lint does **not** run these model
outcomes. For a separately authorized model run, use
`npm --prefix tests run test:vally -- --plugin azure-observability-skills --skill <skill>`.
No Azure provisioning or network resource operations belong in these prompts.

Vitest's V8 coverage cannot instrument Python subprocesses. Passing test counts
are behavioral regression evidence, **not an 80% Python line/branch coverage
claim**. Local helper and metadata tests do not establish installed-host
routing, live telemetry, portal navigation, rendered UI, real permission
enforcement, resource setup or specialist availability. VS Code and Copilot CLI
host acceptance remain independently unrun. Renderer schema hardening and
portal host/resource validation beyond existing helper behavior are not added
here: runtime Python behavior is deliberately unchanged.
