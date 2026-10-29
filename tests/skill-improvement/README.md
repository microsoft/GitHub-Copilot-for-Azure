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

### Development vs. held-out evaluations

**Development tests guide the changes; held-out tests check whether the selected
improvement generalizes.** Think of the development set as practice tests and
the held-out set as a final exam.

#### Why held-outs matter

Repeatedly improving against the same examples or evaluations can produce a Skill
that is better at those examples without being generally better. Held-out
validation helps detect that.

#### Example workflow

1. Run the original Skill on the development set.
2. Run improvement iterations on the development set.
   - For example, iteration 3 passes development acceptance and is saved as an
     accepted candidate. Later iterations may still run.
3. After the iteration loop ends, run held-out tests:
   - Once on the original Skill.
   - Once on the selected accepted candidate.
4. Compare those held-out results for final acceptance.

```text
Original Skill
    |
    v
Evaluate on development set -> baseline for comparison
    |
    v
Improvement loop (up to maxIterations)
    Edit Skill using development feedback
        -> evaluate on development set
        -> check acceptance and refinement criteria
        -> continue if iterations and actionable failures remain
    |
    v
Select latest candidate that passed development acceptance
    |
    v
Final held-out validation (when enabled and tests exist)
    Original Skill ------> held-out results ---+
                                              +--> compare -> accept or reject
    Selected candidate --> held-out results ---+
```

Held-out validation runs after the iteration loop, not after each iteration.
For example, if iteration 3 passes development acceptance but iterations 4 and 5
do not, the held-out comparison uses the original Skill and iteration 3. If
iteration 5 also passes, it is selected instead; selection uses the latest
accepted candidate, not necessarily the highest-scoring one.

Both versions run on the same held-out set at this final stage, providing a
like-for-like comparison. Held-out validation requires it to be enabled, held-out
tests to exist, and a candidate to have passed development acceptance.

**The current runner does not feed held-out results back into the improvement
loop.**

- **Development results** guide the agent's changes across iterations.
- **Held-out results** are used afterward to accept or reject the selected candidate.
- If held-out validation fails, the run rejects the candidate; it does **not**
  start another improvement iteration using those failures.

Held-out results provide stronger evidence of generalization, not a guarantee.
If those results are manually used to tune a later revision, use a fresh held-out
set for an independent final check. See
[Held-out acceptance fields](specs/README.md#held-out-acceptance-fields)
for configuration.

### Baseline-only evaluations

Set `improvementAgent.enabled: false` to run baseline-only. A run with
`improvementAgent.enabled: true` must configure `limits.maxIterations` to at
least `1`; zero iterations with an enabled improvement agent is rejected during
run-spec validation, before resource preparation or evaluation.
The report labels a successful baseline-only run **BASELINE EVALUATION COMPLETED**.
Candidate acceptance and rejection do not apply; correctness results still
describe the baseline arms, not proof that every individual trajectory passes.
Failed baseline runs remain **RUN FAILED**.

### Tokens and evaluation answer AI-credit usage

Skill token growth compares estimated candidate Markdown tokens, including
references, against the original baseline, not the previous iteration.
The engine sums Markdown characters and estimates one token per four
characters, rounded up. This size gate is not a cost budget. Trajectory token
usage is reported separately and includes input/output/cache usage across
model calls, not just the final answer.

**Evaluation answer AIC** measures Vally evaluation sessions using the Copilot SDK
to generate answers with the baseline or candidate Skill.
**Skill-improvement AIC** measures the separate Copilot CLI invocation that reads
evaluation feedback and edits the Skill. Neither includes judge consumption.

Evaluation answer trajectories store provider-reported `copilot_usage.totalNanoAiu` in
`metadata.evaluationAnswerBilling`. Sum the `assistant.usage` request values and divide
by **1,000,000,000** to obtain answer AI credits; do not add the shutdown
aggregate again or infer credits from tokens or model-call counts.
`usageEvents` counts received SDK `assistant.usage` events, not independently
verified requests. `usageEventsWithBilling` counts those with valid billing,
including zero. Interrupted requests may never emit an event, so matching
counts alone do not establish completeness; callers must explicitly pass
session completion to the collector.
`reportedAiCredits` preserves the available event sum, while `completeAiCredits`
is complete provider-reported consumption, not invoice charges, and is null unless
billing and session completion are complete. Both answer and component
`reportedAiCredits` use null when no usable billing values were reported.
An optional `reason` explains incomplete accounting: session not completed,
no usage events, or usage events missing billing. Missing usage is
unknown, not zero. A provider-reported zero is a valid measurement.
Aborted or timed-out SDK trajectories retain earlier reported credits as partial,
because the interrupted request may be missing from the event stream.
On failed generation, valid JSONL records are recovered for billing and malformed
records are warned about and left unmeasured; successful generation remains strict.

The summary and detailed reports keep correctness/token comparisons separate
from a focused credit table: **Batch, Model, Arm, Tests, Repetitions, Billing
coverage, Avg AIC / test, Total evaluation answer AIC**. Tests counts distinct prompts;
repetitions counts configured answers per prompt. The average is per test per
repetition. Total evaluation answer AIC includes all repetitions and is calculated from
unrounded measurements. For example, two tests averaging 3 credits per
repetition with two repetitions consume 12 answer credits.
Answer usage is averaged across repeated judgment records, not summed across
judges. Complete billing and balanced configured judge counts are required
for a complete average and total. With incomplete billing, the average remains
unavailable but the total column shows a **partial reported subtotal** when
available credits can be safely deduplicated. Unbalanced judge groups are excluded;
raw generation billing remains available in batch accounting.
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

### AI-credit summary by phase

`report.json` also persists category summaries collected as work runs, including
available measurements from failed generation attempts and completed agent
invocations. The phase summary has **Phase, Evaluation answer AIC, Skill-improvement AIC,
Total reported AIC, Coverage**, with baseline,
iteration, held-out, and run-total rows. It counts raw answer trajectories
once, independently of grading duplication. Coverage explicitly counts
answer trajectories and agent invocations.

The code uses `EvaluationAnswerBilling`, `collectEvaluationAnswerBilling`, and
`collectSkillImprovementBilling` to distinguish these activities. In `report.json`,
each `PhaseBilling` uses `phase` to identify a workflow stage and contains
`BillingCategorySummary` values under the explicit `evaluationAnswers` and
`skillImprovement` keys. `fullyMeasured` counts units with complete measurements;
`reportedAiCredits` separately preserves available partial subtotals.
Individual trajectory metadata uses `metadata.evaluationAnswerBilling`.

The improvement CLI's final `--usage-output-file` JSON supplies the
authoritative session `totalNanoAiu` aggregate. Divide this once by
1,000,000,000; never add its model/provider/agent breakdowns or shutdown totals.
An invocation is measured only with `aiCreditsStatus: "complete"` and a
terminal JSONL `result` containing an exit code. This supports finalized
failed invocations as well as successes. Aggregates with provider status `partial`,
or `complete` without finalization, are labeled partial; missing exports and
unknown/unavailable provider status remain unavailable.
Unreadable, truncated, or
invalid billing exports are reported as unavailable without changing the original
agent process outcome. Stale output files are removed before launching.
Each invocation belongs only to its iteration,
including iterations discarded before candidate evaluation. Baseline and
held-out agent consumption is **N/A**, not measured zero. Internal model
retries are included only to the extent the provider's complete aggregate
accounts for them; the runner does not retry improvement invocations.

**Judge AI credits are out of scope** because Vally's supported grading API does
not expose judge AI-credit usage. Evaluation AIC therefore covers answer
generation only, not judging. Skill-improvement AIC is collected separately
from the CLI export; no judge credits are inferred from tokens.
Totals cover answers and improvement agents only, not full-workflow consumption.
Azure infrastructure charges and invoice costs are also excluded.

A component total requires complete expected coverage. The combined amount
is a **partial reported subtotal** whenever an applicable component is unavailable or
attempt accounting is incomplete. It includes available credits from both complete
and incomplete units, without extrapolating missing usage. No reported values
means unavailable; a reported zero can still be partial. Run totals for the two
in-scope components require complete coverage and finalized accounting on a
completed run. Missing historical ledgers remain unavailable.
Generation disables Vally trial retries; unreturned failed trajectories and
unreported model retries remain coverage gaps rather than zero consumption.

For example, four of five request-usage events reporting 1.25 AIC produce:

| Evaluation answer AIC | Request billing coverage | Meaning |
| --- | --- | --- |
| 1.250000 (partial reported subtotal) | 4/5 in trajectory metadata | Available requests only; actual total unknown |

Coverage in report tables still counts fully billed answer trajectories or
finalized improvement invocations, not usage events. Event counts remain in
`metadata.evaluationAnswerBilling.usageEvents` and `usageEventsWithBilling`.

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

### Incremental acceptance versus completion

An **ACCEPTED** candidate is a safe improvement, not proof that all tests pass.
Use two stages for near-ceiling skills such as Kusto:

1. **Improve:** retain useful progress without requiring every failure to be
   fixed in one edit. The Kusto spec requires 0.5 quality points, zero net
   per-eval/per-model regression, 100% Skill invocation, and at most 15% Skill
   Markdown token growth. With 364 matched outcomes, one net additional pass
   is about 0.275 points; the 0.5-point threshold requires two. Refinement
   permits score progress of 0.5 points but no aggregate pass-rate regression.
2. **Verify completion:** freeze the chosen commit and rerun both Skill-enabled
   arms across the intended answer models, repeated trials, and held-out
   scenarios. Require every individual trajectory to pass, not merely 100%
   majority-aggregated outcomes. Record models, judge configuration, missing
   results, disagreements, and remaining failures before claiming completion.

Zero regression limits apply to group pass rates, not individual outcomes or
individual arms: a newly passing prompt can offset another failing prompt.
Inspect changed outcomes and each arm separately. The runner currently has no
absolute 100% pass-rate gate; completion verification is a separate review.
An already-perfect baseline cannot satisfy a positive improvement threshold;
verify it directly rather than demanding another improvement.

The Kusto improvement spec deliberately leaves held-out evaluation disabled.
Its listed held-out suite therefore provides no evidence in this stage.
When enabling `heldOutAcceptance.enabled`, account for the baseline and
candidate held-out calls and configure its independent improvement and
regression thresholds. Do not expose held-out failures to the improvement
agent or tune acceptance after seeing them.

Before changing thresholds, record baseline counts and desired additional
passes; choose the smallest meaningful step, keep regression and safety checks
strict, and calibrate score progress against repeated-run noise. Looser gates
do not repair invalid KQL or missing test fixtures. Review an impossible live
test's environment separately; never teach the Skill to invent missing tables
to satisfy a rubric.

### Token growth and cost evidence

Skill token growth compares the candidate's estimated Markdown tokens
(including references) with the original baseline, not the previous iteration.
The engine estimates one token per four characters, rounded up after summing
all Markdown characters. A 15%
limit is a cumulative size allowance, not a cost budget; shrinking is allowed.
Reported answer tokens are trajectory usage, not Skill size or dollars.

The current Kusto plan compares `gpt-5.6-sol` and `claude-sonnet-5`: 364 baseline
generations plus up to four 364-generation candidate batches:
**1820 generations and 1820 judge calls**.
Enabling held-out comparison adds 80 of each for one repetition and two models.
More answer models, repetitions, or judges increase these totals; validate
before dispatch. Four iterations is a maximum, not a guarantee: no actionable
failures, time limits, or errors can stop the run earlier.

Reusable AI-credit collection and report enhancements come from main rather
than this Kusto experiment. Credit measurements below are historical evidence
from run `38649557149` at the pre-split commit `81ac404a`. They cover answer
consumption, not judges, improvement agents, invoice charges, or workflow totals.

`iteration-<n>-agent-usage.json` records the improvement
agent's CLI usage. Optional `improvementAgent.maxAiCredits` applies separately
to each improvement-agent invocation, not evaluations, judges, or the whole
workflow. Do not infer credits from token or call counts; record account usage
with its source and attribution limitations, or mark credits **not measured**.
ADX resource cost is separate: the cluster stays running across iterations and
cleanup requests a stop once after the engine exits.

### Run history

Append actual evidence after each run; never replace observed failures with a
planned target. Link the artifact/report and identify the evaluated commit.
For improvement runs, record candidate acceptance reasons, each arm/model's
individual and majority pass counts, regressions, invocation, baseline and
candidate Skill tokens, growth, actual calls, duration, and credit source.

| Run / commit | Correctness and acceptance | Skill tokens / growth | Usage / AI credits |
| --- | --- | --- | --- |
| [37889993216](https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/runs/37889993216) / `9e876272` | Baseline only; no candidate acceptance. Skill only: 86/91 majority, 420/455 individual. Skill + MCP: 86/91 majority, 421/455 individual. One answer model (`gpt-5.6-sol`), one judge (`claude-opus-4.8`), five repetitions; not 100% or cross-model evidence. | Engine baseline: 495; no candidate, growth N/A. | 1820 generations, 1820 judge calls, 242.9 engine minutes; credits not measured. |
| [38649557149](https://github.com/microsoft/GitHub-Copilot-for-Azure/actions/runs/38649557149) / `81ac404a` | Completed, NOT ACCEPTED; all four candidates rejected and not retained. Baseline 323/364; iteration 3 highest aggregate 346/364; iteration 4 341/364. One repetition, one judge; no held-out evidence or 100% result. | Baseline 483; iterations 1/3: 604 (+25.05%); iteration 2: 551 (+14.08%); iteration 4: 547 (+13.25%). | 1820 generations, 1820 judge calls, 255.4 engine minutes. Answer billing survived generation and grading; 1818/1820 outcomes measured, two unavailable in iteration 1. Judge/agent credits and invoice charges excluded. |

#### Run 38649557149 findings

All cells below use 91 prompts per arm/model. There was one repetition and one
judge (`claude-opus-4.8`), so majority and individual verdict counts coincide;
these are not repeated-run reliability estimates. I3 is the highest aggregate
candidate, not an accepted or retained version. I4 is the last candidate.

| Model / arm | Baseline passes | I3 passes | I4 passes | I4 invocation | Mean trajectory tokens: baseline / I4 | Mean consumed answer credits: baseline / I4 (delta) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| gpt-5.6-sol / Skill only | 84/91 | 90/91 | 88/91 | 91/91 | 36630 / 35759 | 8.429970 / 8.445990 (+0.016020) |
| gpt-5.6-sol / Skill + MCP | 87/91 | 89/91 | 89/91 | 91/91 | 133910 / 160045 | 12.452424 / 20.868074 (+8.415650) |
| claude-sonnet-5 / Skill only | 78/91 | 87/91 | 84/91 | 88/91 | 65795 / 67650 | 4.201792 / 4.345117 (+0.143325) |
| claude-sonnet-5 / Skill + MCP | 74/91 | 80/91 | 80/91 | 71/91 | 201022 / 208961 | 7.296442 / 7.662496 (+0.366054) |

Iteration 1 failed per-eval regression (discovery -5 points), size, and
invocation gates. Iteration 2 failed telemetry regression (-3.57 points) and
invocation. Iteration 3 failed dashboard regression (-2.50 points), size, and
invocation. Iteration 4 passed the improvement, regression, and size gates but
failed invocation (341/364, 93.7%, versus 100% required). None passed refinement,
so no cumulative refinement chain or final candidate patch was produced.

GPT's best observed arm reached 90/91, not 100%. Sonnet's MCP-enabled arm had
lower correctness and invocation than its Skill-only arm; this single run
does not establish a causal or universal model-family effect. Recurring schema
and stored-function failures include absent/unretrieved schemas, speculative
field mappings, and missing concrete remediation/rollback guidance. Separate
fixture availability from Skill behavior before tuning further; do not lower
correctness criteria to reward invented metadata.

Raw baseline generation and judgment artifacts both retain `answerBilling` on
364/364 trajectories. Iteration 1 retains it on all 364 but two have incomplete
request billing, correctly suppressing the corresponding GPT mean/delta.
Later candidate reports have complete coverage. Larger token usage did not map
uniformly to credits: GPT + MCP became substantially more expensive despite
only 13.25% Skill Markdown growth in I4. Consumption is not invoice charges.
Engine cleanup requested cluster stop; workflow fallback observed `Stopping`,
not a verified final `Stopped` state.

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
