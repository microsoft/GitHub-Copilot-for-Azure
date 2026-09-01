# Run Inspection

Use these commands to inspect or compare Foundry experiment runs. Replace placeholders with values supplied by the user or obtained from `run list`.

```bash
azd ai project run list
azd ai project run history-keys --run-id <run-id>
azd ai project run summary --run-id <run-id>
azd ai project run metrics --run-id <run-id>
azd ai project run system-metrics --run-id <run-id> --name <metric>
azd ai project run logs --run-id <run-id>
azd ai project run log-records --run-id <run-id>
azd ai project run traces --run-id <run-id>
azd ai project run trace show --run-id <run-id> --trace-id <trace-id>
azd ai project run compare --run-id <first-run> --run-id <second-run> --metric <metric>
```

`compare` accepts the two repeated `--run-id` values in comparison order. Add `--min` and `--max` only when the user wants to constrain the metric range.

Follow the parent azd guidance and set `AZURE_DEV_USER_AGENT=microsoft_foundry_skill` inline when executing each command. Preserve the complete JSON response. For trace chat or span filtering, use [Span and trace queries](span-trace-queries.md).
