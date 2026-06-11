# Microsoft Foundry E2E Evaluation Report Prompt

You are generating the final Markdown report for a Microsoft Foundry E2E Vally evaluation workflow.

Create the report as a Markdown file at the path specified by the `REPORT_MD` environment variable. Create parent directories if needed. Do not print the report to stdout; write the complete report to `REPORT_MD`. After writing and verifying the file, the final chat response should only say `Report written to <path>`.

In CI, Vally writes `eval-results.md` and `results.jsonl` under `tests/results/<run-timestamp>/`; the CI runner uses the same repository-relative path. Find the latest `tests/results/<run-timestamp>/results.jsonl`, then use the `eval-results.md` in the same directory. Analyze `results.jsonl` directly. Do not invent numbers.

Only read existing result files in the current working directory and write the final Markdown file to `REPORT_MD`. Do not scan sibling repositories or user directories. Do not run Vally, tests, package install commands, deployment commands, `azd`, `git`, or any command that creates a new evaluation run. Do not create or modify any file except `REPORT_MD` and its parent directory.

Required output:

1. Start with `# Microsoft Foundry E2E Evaluation Report`.
2. The first section must be `## Golden Path Result`. Highlight only Golden Path evaluation results. Summarize the Golden Path pass/fail outcome, number of Golden Path trials, and any failed Golden Path stimulus names if present. Do not summarize non-Golden Path stimuli here.
3. The second section must be `## Golden Path Time Cost`.
4. The third section must be `## Golden Path Token Cost`.
5. The fourth section must be `## Download`.
6. The final section must be `## Raw Results` and must include the `eval-results.md` content. Keep its table content intact. If the source content starts with `## Eval Results`, omit that source heading so `## Raw Results` remains the final top-level report section.
7. The report file must contain Markdown only. Do not wrap the report in a code fence. Do not include raw event logs.
8. Use normal Markdown pipe tables, not terminal box-drawing tables.
9. Do not include preamble, progress narration, or stage notes in the report.
10. Before finishing, verify that `REPORT_MD` exists and contains all required sections.

## Golden Path Filtering

Only analyze test records in `results.jsonl` where `trajectory.stimulus.name` starts with `Golden Path`. Ignore all other stimuli and ignore the final `run-summary` record.

If there are multiple Golden Path trials, calculate averages across those trials. If there is only one trial, report that single trial value as the average.

## Time Cost Analysis Guideline

Runtime is measured from when Copilot starts processing the prompt until Copilot emits its final output:

- Timing begins at the first `user_message` event for the trial.
- Timing ends at the last `assistant_message` event for the trial.
- Report time in `x min Y s` format. Round seconds to an integer. If shorter than 1 minute, report only `Y s`.
- Always include spaces before units: use `54 s`, not `54s`; use `22 min 45 s`, not `22 min 45s`.

Use the event timeline and event content semantically to divide each Golden Path trial into these stages. Do not rely on one exact tool name or one exact command string; identify the phase by what the agent is doing in the chronological event stream.

Main stages:

- Collect prerequisite info for agent creation
- Scaffold agent code and customize for B2B
- Foundry resources creation
- Install package
- Test agent locally
- Deploy agent to Foundry
- Test agent by remote invocation
- Eval suite
- Final Output

In the `Golden Path Time Cost` section, include:

- The number of Golden Path trials analyzed.
- The total average runtime first.
- If there is only one Golden Path trial, report only the average values. Use a table with columns `Stage` and `Average`; do not use a `Run 1` column.
- If there are multiple Golden Path trials, include one table for per-trial time cost:
  - First column: stage name.
  - One column per trial/run.
  - Rows are the main stages above, in the same order.
  - Each cell is that trial's duration for that stage.
  - Use `N/A` when a stage did not happen in that trial.
  - Do not add `Average` or `Total` columns or rows to the per-trial table.

## Golden Path Token Cost

For each Golden Path trial, calculate token usage from `trajectory.metrics.tokenUsage` when present. If that aggregate is missing, sum token usage from token usage events.

Report average token usage across Golden Path trials:

- Input tokens
- cacheReadTokens
- Input cache rate, calculated as average cacheReadTokens divided by average input tokens
- Output tokens
- Total tokens

Round token counts to integers and format them with thousands separators. Format input cache rate as a percentage with one decimal place.

## Download

Use this exact `## Download` section format:

- If the `ARTIFACT_URL` environment variable is available and non-empty, include `[Download Vally results artifact](${ARTIFACT_URL})`.
- If `ARTIFACT_URL` is missing or empty, include `Vally results artifact URL is unavailable.`

Do not create a `## Links` section.
