# Steps 3–5 — Download Results, Cluster Failures, Dive Into Category

## Step 3 — Download Results

`evaluation_get` returns run metadata but **not** full per-row output. Write a Python script (save to `scripts/`) to download detailed results:

1. Initialize `AIProjectClient` with the selected environment's project endpoint and `DefaultAzureCredential`
2. Get OpenAI client via `project_client.get_openai_client()`
3. Call `openai_client.evals.runs.output_items.list(eval_id=..., run_id=...)`
4. Serialize each item with `item.model_dump()` and save to `.foundry/results/<environment>/<eval-id>/<run-id>.json` (use `default=str` for non-serializable fields)
5. Print summary: total items, passed, failed, errored counts

> ⚠️ **Data structure gotcha:** Query/response data lives in `datasource_item.query` and `datasource_item['sample.output_text']`, **not** in `sample.input`/`sample.output` (which are empty arrays). Parse `datasource_item` fields when extracting queries and responses for analysis.

> ⚠️ **Show Data Viewer deeplinks (for VS Code runtime only):** Append a Data Viewer deeplink immediately after reference to an evaluation result file in your response. Format: `[Open in Data Viewer](vscode://ms-windows-ai-studio.windows-ai-studio/open_data_viewer?file=<file_path>&source=microsoft-foundry-skill) for details and perform analysis`.

## Step 4 — Cluster Failures by Root Cause

Analyze every row in the results. Group failures into clusters:

| Cluster | Description |
|---------|-------------|
| Incorrect / hallucinated answer | Agent gave a wrong or fabricated response |
| Incomplete answer | Agent missed key parts |
| Tool call failure | Agent failed to invoke or misused a tool |
| Safety / content violation | Flagged by safety evaluators |
| Runtime error | Agent crashed or returned an error |
| Off-topic / refusal | Agent refused or went off-topic |

Produce a prioritized action table:

| Priority | Cluster | Suggested Action |
|----------|---------|------------------|
| P0 | Runtime errors or failing `P0` test cases | Check container logs or fix blockers first |
| P1 | Incorrect answers on key flows | Optimize prompt or tool instructions |
| P2 | Incomplete answers or broader quality gaps | Optimize prompt or expand context |
| P3 | Tool call failures | Fix tool definitions or instructions |
| P4 | Safety violations | Add guardrails to instructions |

**Rule:** Prioritize runtime errors first, then sort by test-case priority (`P0` before `P1` before `P2`) and count × severity.

## Step 5 — Dive Into Category

When the user wants to inspect a specific cluster, display the individual rows: test-case ID, input query, the agent's original response, evaluator scores, and failure reason. Let the user confirm which category or test case to optimize.

## Next Steps

After clustering -> proceed to [Step 6: Optimize Prompt](optimize-deploy.md).
