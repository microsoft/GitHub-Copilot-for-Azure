# Microsoft Foundry E2E Evaluation Report Prompt

You are generating the final Markdown report for a Microsoft Foundry E2E Vally evaluation workflow.

## Overall Guidance

Create the report as a Markdown file at the path specified by the `REPORT_MD` environment variable. Create parent directories if needed. Do not print the report to stdout; write the complete report to `REPORT_MD`. After writing and verifying the file, the final chat response should only say `Report written to ` followed by the report path.

In CI, Vally writes `eval-results.md` and `results.jsonl` under timestamped subdirectories of `tests/results/`; the CI runner uses the same repository-relative path. Find all `results.jsonl` files under `tests/results/`, and merge every `eval-results.md` found under `tests/results/` into the combined Raw Results table. Analyze `results.jsonl` directly. Do not invent numbers.

Only read existing result files in the current working directory and write the final Markdown file to `REPORT_MD`. Do not scan sibling repositories or user directories. Do not run Vally, tests, package install commands, deployment commands, `azd`, `git`, or any command that creates a new evaluation run. Do not create or modify any file except `REPORT_MD` and its parent directory.

The report file must contain Markdown only. Do not wrap the report in a code fence. Use normal Markdown pipe tables, not terminal box-drawing tables. Do not include preamble, progress narration, raw event logs, or free-form stage notes outside the requested sections.

Only analyze test records in `results.jsonl` where `trajectory.stimulus.name` starts with `Golden Path`. Ignore all other stimuli and ignore the final `run-summary` record. Determine each trial's model from `trajectory.metadata.model` first, then from `trajectory.metrics.tokenUsage.model`, then from the last `token_usage` event with `data.model`.

## Output Report Structure

The output report must use this section order:

1. `# Microsoft Foundry E2E Evaluation Report`
2. `## Golden Path Result`
3. `## Golden Path Time Cost`
4. `## Golden Path Token Cost`
5. `## Golden Path Model Performance`
6. `## Download`
7. `## Raw Results`

Do not add other top-level sections. Do not create a `## Links` section. The schemas below show the required shape and example formatting; calculate the actual values from the input files.

## Section: Golden Path Result

Purpose: highlight the Golden Path result first, without mixing in non-Golden Path stimuli.

Guidance:

- Include only Golden Path trials.
- This section is the Sonnet 4.6 baseline: include only Golden Path trials whose model is `claude-sonnet-4.6`.
- Report the overall Golden Path outcome as `PASS` only if every Golden Path trial passed; otherwise report `FAIL`.
- Add one table row per Golden Path trial, in chronological trial order.
- Use `-` in `Notes` for passed trials. For failed trials, keep the note short and based on the eval result.

Schema example:

```markdown
# Microsoft Foundry E2E Evaluation Report

## Golden Path Result

**Outcome:** PASS

**Golden Path trials analyzed:** 2

**Passed:** 2

**Failed:** 0

| Run | Stimulus | Result | Notes |
|---|---|---|---|
| Run 1 | Golden Path - create and deploy Foundry agent | PASS | - |
| Run 2 | Golden Path - create and deploy Foundry agent | PASS | - |
```

## Section: Golden Path Time Cost

Purpose: show Golden Path runtime first as an overall average, then as per-run stage timing.

Guidance:

- Runtime is measured from the first `user_message` event to the last `assistant_message` event for each Golden Path trial.
- This section is the Sonnet 4.6 baseline: include only Golden Path trials whose model is `claude-sonnet-4.6`.
- `Total average runtime` must equal the average of the per-run `Total` row values.
- Each stage duration is the AI-driven full wall-clock time for that stage: start when the AI begins working on that stage, and end when the AI completes that stage and moves to the next stage. Include AI reasoning, command execution, waiting, result inspection, retries, and verification within the stage.
- Each run column's stage durations must sum exactly to that run's `Total` row. Assign all elapsed wall-clock time to exactly one stage.
- Report time in `x min Y s` format. Round seconds to an integer. If shorter than 1 minute, report only `Y s`.
- Always include spaces before units: use `54 s`, not `54s`; use `22 min 45 s`, not `22 min 45s`.
- Use the event timeline and event content semantically to divide each Golden Path trial into stages. Do not rely on one exact tool name or one exact command string.
- If there is only one Golden Path trial, use the single-trial schema with `Stage` and `Average` columns. Do not use a `Run 1` column.
- If there are multiple Golden Path trials, use one `Run N` column per Golden Path trial. Do not add an `Average` column.
- Always include the final `Total` row.
- Use `N/A` when a stage did not happen in that trial.

Main stages:

- Collect prerequisite info for agent creation
- Scaffold agent code and customize for B2B
- Foundry resources creation
- Test agent locally
- Deploy agent to Foundry
- Test agent by remote invocation
- Eval suite
- Final Output

Notes:

- `Foundry resources creation` starts when the AI begins declaring or working on Foundry project/resource creation, `azd provision`, or equivalent `azd provision` tool-call signals, and ends when `azd provision` has fully completed successfully.
- `Test agent locally` includes creating the local virtual environment, installing `uv`, installing project packages from requirements or equivalent package files, starting the local agent server, and invoking the local agent to verify it responds.

Single-trial schema example:

```markdown
## Golden Path Time Cost

1 Golden Path trials analyzed.

**Total average runtime:** 15 min 43 s

| Stage | Average |
|---|---:|
| Collect prerequisite info for agent creation | 54 s |
| Scaffold agent code and customize for B2B | 1 min 13 s |
| Foundry resources creation | 1 min 30 s |
| Test agent locally | 5 min 10 s |
| Deploy agent to Foundry | 1 min 50 s |
| Test agent by remote invocation | 4 min 54 s |
| Eval suite | N/A |
| Final Output | 12 s |
| Total | 15 min 43 s |
```

Multi-trial schema example:

```markdown
## Golden Path Time Cost

2 Golden Path trials analyzed.

**Total average runtime:** 16 min 7 s

| Stage | Run 1 | Run 2 |
|---|---:|---:|
| Collect prerequisite info for agent creation | 55 s | 4 min 33 s |
| Scaffold agent code and customize for B2B | 1 min 13 s | 3 min 1 s |
| Foundry resources creation | 1 min 30 s | 1 min 50 s |
| Test agent locally | 5 min 9 s | 3 min 18 s |
| Deploy agent to Foundry | 1 min 50 s | 2 min 55 s |
| Test agent by remote invocation | 4 min 54 s | 36 s |
| Eval suite | N/A | 5 s |
| Final Output | 12 s | 13 s |
| Total | 15 min 43 s | 16 min 31 s |
```

## Section: Golden Path Token Cost

Purpose: show average token usage and AI credit cost for Golden Path trials only.

### Pricing Table

Use this GitHub Copilot pricing table. Prices are USD per 1M tokens. The `Model` column uses the Copilot CLI model id. OpenAI and Microsoft models do not have a separate cache write price in GitHub Copilot pricing, so use `N/A` for `Cache write` and treat cache write tokens as regular input tokens when calculating cost.

| Model | Input | Cached input | Cache write | Output |
|---|---:|---:|---:|---:|
| claude-opus-4.8 | $5.00 | $0.50 | $6.25 | $25.00 |
| claude-sonnet-4.6 | $3.00 | $0.30 | $3.75 | $15.00 |
| claude-sonnet-5 | $2.00 | $0.20 | $2.50 | $10.00 |
| gpt-5.3-codex | $1.75 | $0.175 | N/A | $14.00 |
| gpt-5-mini | $0.25 | $0.025 | N/A | $2.00 |
| mai-code-1-flash | $0.75 | $0.075 | N/A | $4.50 |

Guidance:

This section is the Sonnet 4.6 baseline: include only Golden Path trials whose model is `claude-sonnet-4.6`.

Step 1: calculate average token usage.

- Calculate token usage directly from `trajectory.metrics.tokenUsage`.
- Each Golden Path trial has complete token usage fields: `inputTokens`, `cacheReadTokens`, `cacheWriteTokens`, and `outputTokens`.
- Average these four fields across Golden Path trials only: `inputTokens`, `cacheReadTokens`, `cacheWriteTokens`, and `outputTokens`.
- Calculate `Total tokens` as average `inputTokens` plus average `outputTokens`.
- Round token counts to integers and format them with thousands separators.

Step 2: calculate average AIC.

- `100` AI credits equals `$1.00`.
- Determine the model used by each Golden Path trial from `trajectory.metrics.tokenUsage.model`, then use the matching model row in the Pricing Table for `inputRate`, `cachedInputRate`, `cacheWriteRate`, and `outputRate`.
- Calculate `averageAic = ((((averageInputTokens - averageCacheReadTokens - averageCacheWriteTokens) * inputRate) + (averageCacheReadTokens * cachedInputRate) + (averageCacheWriteTokens * cacheWriteRate) + (averageOutputTokens * outputRate)) / 1,000,000) * 100`.
- If `Cache write` is `N/A` for the model, calculate `averageAic = ((((averageInputTokens - averageCacheReadTokens) * inputRate) + (averageCacheReadTokens * cachedInputRate) + (averageOutputTokens * outputRate)) / 1,000,000) * 100`.
- Format `Average AIC` with two decimal places.

Schema example:

```markdown
## Golden Path Token Cost

2 Golden Path trials analyzed.

| Metric | Average |
|---|---:|
| Input tokens | 120,000 |
| cacheReadTokens | 30,000 |
| cacheWriteTokens | 5,000 |
| Output tokens | 8,000 |
| Total tokens | 128,000 |
| Average AIC | 8.40 |
```

## Section: Golden Path Model Performance

Purpose: compare Golden Path performance across every model run in the workflow.

Guidance:

- Include every Golden Path trial from every `results.jsonl` file found under `tests/results/`.
- Group trials by model. If a model has multiple Golden Path trials across files or repeated `--runs`, average all of that model's Golden Path trials.
- Runtime for each trial is measured from the first `user_message` event to the last `assistant_message` event, using the same timing rule as `## Golden Path Time Cost`.
- Use token usage from `trajectory.metrics.tokenUsage` to calculate `Avg total tokens` and `Avg AIC`; do not include input/cache/output token detail columns in this table.
- `Avg total tokens` is average `inputTokens` plus average `outputTokens`.
- Calculate `Avg AIC` using the Pricing Table and the same cost formula as `## Golden Path Token Cost`.
- Round `Avg total tokens` to an integer and format it with thousands separators.
- Format average runtime in `x min Y s` format.
- Order rows by the `VALLY_MODELS` environment variable if it is available. Otherwise, order rows by the first chronological appearance of each model in the result files.
- Use `N/A` for unavailable metrics or missing pricing rows. Format `Avg AIC` with two decimal places when it is available.

Schema example:

```markdown
## Golden Path Model Performance

N models analyzed.

| Model | Avg total tokens | Avg time cost | Avg AIC |
|---|---:|---:|---:|
| claude-opus-4.8 | 139,000 | 18 min 22 s | 70.25 |
| claude-sonnet-4.6 | 128,000 | 15 min 43 s | 40.28 |
| gpt-5.3-codex | 125,500 | 17 min 9 s | 26.11 |
```

## Section: Download

Purpose: provide the Vally artifact download link using the existing workflow style.

Guidance:

- If the `ARTIFACT_URL` environment variable is available and non-empty, include exactly `[Download Vally results artifact](${ARTIFACT_URL})`.
- If `ARTIFACT_URL` is missing or empty, include exactly `Vally results artifact URL is unavailable.`
- Do not include workflow links here.

Schema example:

```markdown
## Download

[Download Vally results artifact](https://example.com/artifact)
```

## Section: Raw Results

Purpose: keep the original Vally summary available, but put it last so Golden Path analysis is emphasized first.

Guidance:

- Include the results table from every `eval-results.md` under `tests/results/`, and merge them into one combined table so all models appear together.
- Make sure every row shows its model by keeping (or adding) a `Model` column.
- If a source file starts with a `## Eval Results` heading, omit that heading so `## Raw Results` remains the final top-level report section.

Schema example:

```markdown
## Raw Results

| Stimulus | Skills | Model | Graders | Pass Rate | Duration | Tokens | Verdict |
|---|---|---|---|---|---|---|---|
| Golden Path - create and deploy Foundry agent | `microsoft-foundry` | claude-sonnet-4.6 | ✅ skill-invocation 1/1<br>✅ completed 1/1 | 1/1 | 15m 43s | 128,000 | ✅ |
| Golden Path - create and deploy Foundry agent | `microsoft-foundry` | claude-opus-4.8 | ✅ skill-invocation 1/1<br>✅ completed 1/1 | 1/1 | 18m 22s | 139,000 | ✅ |
```

Before finishing, verify that `REPORT_MD` exists and contains all required report sections.
