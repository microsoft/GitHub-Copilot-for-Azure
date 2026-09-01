# Run Inspection

Use these commands to inspect or compare Foundry experiment runs. Replace placeholders with values supplied by the user or obtained from `run list`.

```bash
azd ai loom run list
azd ai loom run history-keys --run-id <run-id>
azd ai loom run summary --run-id <run-id>
azd ai loom run metrics --run-id <run-id>
azd ai loom run system-metrics --run-id <run-id> --name <metric>
azd ai loom run logs --run-id <run-id>
azd ai loom run log-records --run-id <run-id>
azd ai loom run trace list --run-id <run-id>
azd ai loom run trace show --run-id <run-id> --trace-id <trace-id>
azd ai loom run compare --run-id <first-run> --run-id <second-run> --metric <metric>
```

`compare` accepts the two repeated `--run-id` values in comparison order. Add `--min` and `--max` only when the user wants to constrain the metric range.

`run list`, `summary`, `metrics`, `system-metrics`, `logs`, `log-records`, and `trace list` accept `--take <count>` and default to 10 results. Increase `--take` when the user needs more than the default; the CLI requires a positive value.

Follow the parent azd guidance and set `AZURE_DEV_USER_AGENT=microsoft_foundry_skill` inline when executing each command. Preserve the complete JSON response. For trace chat or span filtering, use [Span and trace queries](span-trace-queries.md).
