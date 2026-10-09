# Skill improvement runner

This bounded runner evaluates a baseline, asks Copilot CLI to edit only the
target Skill directory, reruns candidate evaluations, and accepts a candidate
only when every configured quality, regression, invocation, and Skill-size gate
passes. The same TypeScript engine runs locally and in the manual **Skill
Improvement** workflow.

## Choosing experiment arms

An **arm** is one test configuration. Every run needs at least one arm with the
target Skill enabled so the runner can compare the current Skill with proposed
revisions. No-Skill control arms are optional.

Choose only the arms needed to answer your question:

| Goal | Configure these arms | What the run tells you |
| --- | --- | --- |
| Improve the Skill without MCP | **Skill only** | Whether a revised Skill is better than the current Skill without MCP |
| Improve the Skill with MCP | **Skill + MCP** | Whether a revised Skill is better than the current Skill with MCP |
| Improve across both environments | **Skill only** and **Skill + MCP** | Whether a revision works both without and with MCP |
| Measure the Skill's value without MCP | **Agent only** and **Skill only** | What changes when the Skill is added |
| Measure the Skill's value with MCP | **MCP only** and **Skill + MCP** | What changes when the Skill is added while MCP remains available |
| Measure Skill and MCP effects separately | All four arms | Skill effect, MCP effect, and their combined behavior |

The available arms are:

| Arm | Target Skill | Azure MCP |
| --- | --- | --- |
| Agent only | Disabled | Disabled |
| Skill only | Enabled | Disabled |
| MCP only | Disabled | Enabled |
| Skill + MCP | Enabled | Enabled |

Candidate iterations rerun only Skill-enabled arms. No-Skill arms provide
attribution for the baseline report, but they do not need to be rerun because
the candidate changes only the Skill.

More arms cost more. Validate the plan before running paid evaluations. For
`P` prompts, `A` answer models, `R` repetitions, `B` configured baseline arms,
`S` Skill-enabled arms, `I` iterations, and `J` judges:

- baseline generations = `P * A * R * B`
- candidate generations = `P * A * R * S * I`
- judge calls = `(baseline + candidate generations) * J`

## Decisions and evidence

Pass/fail uses judge majority and response score uses the median judge score.
Acceptance uses pass-rate improvement, per-model and per-eval regression
limits, target-Skill invocation, and estimated **Skill Markdown token growth**.
Average generated-answer token change is diagnostic only, not the Skill-size
gate.

Iterations use a separate refinement boundary. A candidate that has not yet
met final acceptance can still become the starting point for the next
iteration when it makes the configured score progress without crossing the
aggregate quality-regression boundary, Skill invocation threshold, or Skill
size limit. Final acceptance is always measured against the original baseline,
so several retained refinements can cumulatively reach the acceptance target.
When a candidate crosses the refinement boundary and is discarded, its patch
is still supplied to the next improvement agent for selective reapplication
rather than being silently lost.

See [Acceptance and refinement configuration](specs/README.md) for definitions,
point calculations, tuning guidance for new and mature skills, and instructions
for changing a run specification.

Each run writes:

- `report-summary.md`: decision-first Actions/job summary with separate baseline
  arms, candidate pass rates, all rejection/validation reasons, acceptance
  gates, and changed outcomes/regressions;
- `report.md` and `report.json`: detailed results;
- raw generation/judgment JSONL, agent output, relative candidate patches, and
  Skill snapshots.

The workflow always appends `report-summary.md` to `GITHUB_STEP_SUMMARY` and
retains the complete GitHub artifact for 30 days. `output.issue: never` creates
no issue; `output.issue: always` remains an explicit opt-in. Draft PR creation
still requires an accepted candidate and does not require a result issue.

In the `skill-improvement-evals` GitHub environment, configure both repository
variables `REPORT_STORAGE_ACCOUNT` and
`SKILL_IMPROVEMENT_STORAGE_CONTAINER`. **Publish report to Azure Storage**
uploads a repository-standard best-effort-redacted copy of the complete run
output using OIDC and `--auth-mode login` to:

`${REPORT_STORAGE_ACCOUNT}/${SKILL_IMPROVEMENT_STORAGE_CONTAINER}/<UTC-date>/<GitHub-run-id>/<skill>/`

If `REPORT_STORAGE_ACCOUNT` is absent, publishing is skipped and the complete
30-day GitHub artifact remains available. When it is set, publishing is
required: a missing or empty `SKILL_IMPROVEMENT_STORAGE_CONTAINER` fails
explicitly before Azure CLI is invoked, and an Azure Storage failure fails the
job.

The configured storage account and container must identify a pre-existing
private destination. Access is OIDC/RBAC-based; no keys, SAS tokens, connection
strings, or public URLs are emitted. Successful uploads are quiet; upload
errors still fail the workflow. Raw trajectories can contain prompts, outputs,
and tool evidence. Pattern-based redaction reduces known secret exposure but is
not comprehensive, so restrict container access and configure
lifecycle/retention according to repository policy.

## Commands

From `tests`:

```powershell
npm run skill-improvement -- validate `
  --config .\skill-improvement\specs\azure-kusto.yaml

npm run skill-improvement -- run `
  --config .\skill-improvement\specs\azure-kusto.yaml `
  --executor local
```

Local execution runs paid evaluations, judges, and the improvement agent; do
not run it for ordinary unit validation.

To dispatch the workflow, use `--executor github` with
`--workflow-ref <branch-containing-workflow>` and optional `--baseline-ref`,
`--pr-base`, and `--create-draft-pr`. The PR flag is only a request; no PR is
created unless every acceptance gate passes.

The workflow calls the internal `execute` command with an explicit `--output`
directory. Vally first saves answers with `--skip-grade`, then re-grades those
trajectories with each judge. The improvement agent receives development
failures and prior rejection reasons, never held-out evidence.

The workflow job allows 420 minutes. This leaves 40 minutes of setup and
cleanup headroom beyond the current 360-minute engine limit plus the managed
Kusto cluster's 20-minute startup timeout; the engine deadline remains the
authoritative evaluation limit.

Run specifications may reference only filenames inside either a
repository-relative `tests/skill-improvement/evals/<name>` root or an existing
`evals/<plugin>/<skill>` root. Suites under `tests/skill-improvement/evals/` are
opt-in and are not discovered by the nightly integration workflow; suites under
`evals/` retain their normal nightly behavior.

Conditions may add `developmentEvaluations` or `heldOutEvaluations`. Use this
for suites that require capabilities available only in that arm, such as live
Azure MCP access. Common evaluation files still run in every configured arm.
Condition-specific held-out files count only on Skill-enabled candidate arms,
matching the held-out baseline and candidate batches executed by the engine.

An optional `resources.kusto` block manages a persistent ADX test cluster. The
local and GitHub executors start the stopped cluster, wait for the management
state and a data-plane health query, run evaluations, and request a stop in a
`finally` path. The workflow also performs an independent `always()` cleanup
as a fallback. Schema and deterministic seed data for the Kusto environment
are externally maintained; `resources/azure-kusto/` documents the persistent
environment and its lifecycle contract.

Resource lifecycle can also be exercised independently from `tests`:

```powershell
npm run skill-improvement -- prepare-resources `
  --config .\skill-improvement\specs\azure-kusto.yaml

npm run skill-improvement -- cleanup-resources `
  --config .\skill-improvement\specs\azure-kusto.yaml
```
