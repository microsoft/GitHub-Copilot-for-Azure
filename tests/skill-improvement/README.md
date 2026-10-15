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

### Evaluation concurrency

```yaml
limits:
  maxConcurrentVallyProcesses: 5
  generationWorkersPerVallyProcess: 1
```

`maxConcurrentVallyProcesses` is a required positive integer limiting simultaneous
Vally processes during both answer generation and grading. These are local
processes within one runner (one Actions runner for workflow execution), not
GitHub jobs. The old `maxConcurrentJobs` spelling is rejected; rename that field.

`generationWorkersPerVallyProcess` is an optional positive integer, defaulting to `1`.
It sets generation's `--workers` value only; it does not control a grader's
internal concurrency. With enough queued generation tasks and scenarios, the
maximum simultaneous answer sessions is the product of these two settings.
For example, `5` processes with `2` workers each permit up to `10` generation
sessions. Concurrency changes scheduling, not generation/judge budgets,
acceptance/refinement thresholds, or the Skill-size gate.

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

### Baseline-only evaluations

When `improvementAgent.enabled` is false or `limits.maxIterations` is zero,
the report labels a successful run **BASELINE EVALUATION COMPLETED**.
Candidate acceptance and rejection do not apply; correctness results still
describe the baseline arms, not proof that every individual trajectory passes.
Failed baseline runs remain **RUN FAILED**.

### Tokens and answer AI credits

Skill token growth compares estimated candidate Markdown tokens, including
references, against the original baseline, not the previous iteration.
The engine sums Markdown characters and estimates one token per four
characters, rounded up. This size gate is not a cost budget. Trajectory token
usage is reported separately and includes input/output/cache usage across
model calls, not just the final answer.

Answer trajectories store provider-reported `copilot_usage.totalNanoAiu` in
`metadata.answerBilling`. Sum the `assistant.usage` request values and divide
by **1,000,000,000** to obtain answer AI credits; do not add the shutdown
aggregate again or infer credits from tokens or model-call counts.
Each request must have billing data for an answer to be measured. Missing or
partial billing, including historical artifacts without these fields, is
**not measured**, not zero. A provider-reported zero is a valid measurement.
Aborted or timed-out SDK trajectories remain unmeasured even if earlier requests
have billing, because the interrupted request may be missing from the event stream.
On failed generation, valid JSONL records are recovered for billing and malformed
records are warned about and left unmeasured; successful generation remains strict.

The summary and detailed reports keep correctness/token comparisons separate
from a focused credit table: **Batch, Model, Arm, Tests, Repetitions, Billing
coverage, Avg AIC / test, Total answer AIC**. Tests counts distinct prompts;
repetitions counts configured answers per prompt. The average is per test per
repetition. Total answer AIC includes all repetitions and is calculated from
unrounded measurements. For example, two tests averaging 3 credits per
repetition with two repetitions consume 12 answer credits.
Answer usage is averaged across repeated judgment records, not summed across
judges. Complete billing and balanced configured judge counts are required
for both the average and total; incomplete coverage is shown explicitly.
Held-out batches use the same reporting when configured.

These are provider-reported answer-generation credits, not invoice charges
or full workflow cost. Judge and improvement-agent costs are excluded.
`iteration-<n>-agent-usage.json` records improvement-agent CLI usage;
`improvementAgent.maxAiCredits` applies separately to each agent invocation,
not evaluations, judges, or the whole workflow. Credits are diagnostic,
not an acceptance gate or permission to trade away correctness.
This addresses answer reporting in
[microsoft/mcp-pr#718](https://github.com/microsoft/mcp-pr/issues/718),
not full workflow-credit accounting.

### Batch and run credit accounting

`report.json` also persists a component billing ledger collected as work runs, including
available measurements from failed generation attempts and completed agent
invocations. The batch summary has **Batch, Answer AIC, Improvement-agent AIC,
Total measured AIC, Coverage**, with baseline,
iteration, held-out, and run-total rows. It counts raw answer trajectories
once, independently of grading duplication. Coverage explicitly counts
answer trajectories and agent invocations.

The improvement CLI's final `--usage-output-file` JSON supplies the
authoritative session `totalNanoAiu` aggregate. Divide this once by
1,000,000,000; never add its model/provider/agent breakdowns or shutdown totals.
An invocation is measured only with `aiCreditsStatus: "complete"` and a
terminal JSONL `result` containing an exit code. This supports finalized
failed invocations as well as successes; timeouts, missing exports, and
partial/unknown provider status remain unavailable. Unreadable, truncated, or
invalid billing exports are reported as unavailable without changing the original
agent process outcome. Stale output files are removed before launching.
Each invocation belongs only to its iteration,
including iterations discarded before candidate evaluation. Baseline and
held-out agent consumption is **N/A**, not measured zero. Internal model
retries are included only to the extent the provider's complete aggregate
accounts for them; the runner does not retry improvement invocations.

**Judge AI credits are out of scope** pending Vally billing support.
Totals cover answers and improvement agents only, not full-workflow consumption.
Azure infrastructure charges and invoice costs are also excluded.

A component total requires complete expected coverage. The combined amount
is a **measured subtotal** whenever an applicable component is unavailable or
attempt accounting is incomplete. It includes only fully measured units;
known fragments from incomplete units are excluded. Run totals for the two
in-scope components require complete coverage and finalized accounting on a
completed run. Missing historical ledgers remain unavailable.
Generation disables Vally trial retries; unreturned failed trajectories and
unreported model retries remain coverage gaps rather than zero consumption.

### Reading a run: baseline to iteration 1

The baseline is the starting Skill. A candidate is an edited version of that
Skill. Our engine coordinates the steps; Vally generates and grades the
evaluation answers.

| Step | What happens | Output / where to look |
| --- | --- | --- |
| 1. Generate baseline answers | Run eval prompts using the starting Skill and configured answer models. | `baseline/generation/` |
| 2. Grade baseline answers | Check saved answers against eval criteria, including rubric-based judging. | `baseline/judgments/` |
| 3. Prepare iteration 1 | The engine collects failed or judge-disputed test outcomes, judge explanations, and answer excerpts—not entire failed suites—and writes them into a packet for the improvement agent. | `iteration-1-failure-packet.md` |
| 4. Improve the Skill | A Copilot CLI improvement agent reads the packet and edits the Skill. It does not run the evals. | `iteration-1-agent.jsonl`, `iteration-1-agent.stderr.log`, `iteration-1-agent-usage.json` |
| 5. Save and validate candidate 1 | After the agent exits, the engine saves the edits and checks they are valid before evaluating them. | `iteration-1/candidate.patch` and `iteration-1/candidate-skill/` |
| 6. Generate candidate answers | Run eval prompts again, now using candidate 1. | `iteration-1/generation/` |
| 7. Grade and decide | Grade new answers. The engine decides whether to accept, retain for refinement, or reject the candidate. | `iteration-1/judgments/` and `report-summary.md` |
| 8. Continue to iteration 2 | Prepare feedback and repeat steps 4–7. A rejected candidate does not automatically become the next starting version. | `iteration-2-failure-packet.md` and `iteration-2/...` |

For later iterations, replace `iteration-1` with `iteration-n`.

**You usually don't need to read the raw improvement-agent files.** Start with
`report-summary.md` for results and `candidate.patch` for Skill changes. Open
the improvement-agent files only to investigate its tool calls, execution
problems, or token/AI-credit usage. They describe how the candidate was
created—not whether it passed the evals.

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
Hill-climbing stops with `no-actionable-failures` before another agent call
when no failed or disputed trials, invocation-rate failure, token-growth
failure, or candidate-validation failure remains.

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
