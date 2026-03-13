# Agent Observability Loop

Orchestrate the full eval-driven optimization cycle for a Foundry agent. This skill manages the **multi-step workflow** for a selected agent root and environment: reusing or refreshing `.foundry` cache, auto-creating evaluators, generating test datasets, running batch evals, clustering failures, optimizing prompts, redeploying, and comparing versions. Use this skill instead of calling individual `azure` MCP evaluation tools manually.

## When to Use This Skill

USE FOR: evaluate my agent, run an eval, test my agent, check agent quality, run batch evaluation, analyze eval results, why did my eval fail, cluster failures, improve agent quality, optimize agent prompt, compare agent versions, re-evaluate after changes, set up CI/CD evals, agent monitoring, eval-driven optimization.

> ⚠️ **DO NOT manually call** `evaluation_agent_batch_eval_create`, `evaluator_catalog_create`, `evaluation_comparison_create`, or `prompt_optimize` **without reading this skill first.** This skill defines required pre-checks, environment selection, cache reuse, artifact persistence, and multi-step orchestration that the raw tools do not enforce.

## Quick Reference

| Property | Value |
|----------|-------|
| MCP server | `azure` |
| Key MCP tools | `evaluation_agent_batch_eval_create`, `evaluator_catalog_create`, `evaluation_comparison_create`, `prompt_optimize`, `agent_update` |
| Prerequisite | Agent deployed and running (use [deploy skill](../deploy/deploy.md)) |
| Local cache | `.foundry/agent-metadata.yaml`, `.foundry/evaluators/`, `.foundry/datasets/`, `.foundry/results/` |

## Entry Points

| User Intent | Start At |
|-------------|----------|
| "Deploy and evaluate my agent" | [Step 1: Auto-Setup Evaluators](references/deploy-and-setup.md) (deploy first via [deploy skill](../deploy/deploy.md)) |
| "Agent just deployed" / "Set up evaluation" | [Step 1: Auto-Setup Evaluators](references/deploy-and-setup.md) (skip deploy, run auto-create) |
| "Evaluate my agent" / "Run an eval" | [Step 1: Auto-Setup Evaluators](references/deploy-and-setup.md) first if `.foundry/evaluators/` or `.foundry/datasets/` cache is missing, stale, or the user requests refresh, then [Step 2: Evaluate](references/evaluate-step.md) |
| "Why did my eval fail?" / "Analyze results" | [Step 3: Analyze](references/analyze-results.md) |
| "Improve my agent" / "Optimize prompt" | [Step 4: Optimize](references/optimize-deploy.md) |
| "Compare agent versions" | [Step 5: Compare](references/compare-iterate.md) |
| "Set up CI/CD evals" | [Step 6: CI/CD](references/cicd-monitoring.md) |

> ⚠️ **Important:** Before running any evaluation (Step 2), always resolve the selected agent root and environment, then inspect `.foundry/agent-metadata.yaml` plus `.foundry/evaluators/` and `.foundry/datasets/`. If the cache is missing, stale, or the user wants to refresh it, route through [Step 1: Auto-Setup](references/deploy-and-setup.md) first — even if the user only asked to "evaluate."

## Before Starting — Detect Current State

1. Resolve the target agent root and environment from `.foundry/agent-metadata.yaml`.
2. Use `agent_get` and `agent_container_status_get` to verify the environment's agent exists and is running.
3. Inspect the selected environment's `testCases[]` plus cached files under `.foundry/evaluators/` and `.foundry/datasets/`.
4. Use `evaluation_get` to check for existing eval runs.
5. Jump to the appropriate entry point.

## Loop Overview

```text
1. Auto-setup evaluators or refresh .foundry cache for the selected environment
   -> ask: "Run an evaluation to identify optimization opportunities?"
2. Evaluate (batch eval run)
3. Download and cluster failures
4. Pick a category or test case to optimize
5. Optimize prompt
6. Deploy new version (after user sign-off)
7. Re-evaluate (same env + same test case)
8. Compare versions -> decide which to keep
9. Loop to next category or finish
10. Prompt: enable CI/CD evals and continuous production monitoring
```

## Behavioral Rules

1. **Keep context visible.** Restate the selected agent root and environment in setup, evaluation, and result summaries.
2. **Reuse cache before regenerating.** Prefer existing `.foundry/evaluators/` and `.foundry/datasets/` when they match the active environment. Ask before refreshing or overwriting them.
3. **Start with P0 test cases.** Run the selected environment's `P0` test cases before broader `P1` or `P2` coverage unless the user explicitly chooses otherwise.
4. **Auto-poll in background.** After creating eval runs or starting containers, poll in a background terminal. Only surface the final result.
5. **Confirm before changes.** Show diff/summary before modifying agent code, refreshing cache, or deploying. Wait for sign-off.
6. **Prompt for next steps.** After each step, present options. Never assume the path forward.
7. **Write scripts to files.** Python scripts go in `scripts/` - no inline code blocks.
8. **Persist eval artifacts.** Save local artifacts to `.foundry/evaluators/`, `.foundry/datasets/`, and `.foundry/results/` for version tracking and comparison.
9. **Use exact eval parameter names.** Use `evaluationId` only on batch-eval create calls that group runs; use `evalId` on `evaluation_get` and `evaluation_comparison_create`; use `evalRunId` for a specific run lookup.
10. **Show Data Viewer deeplinks (for VS Code runtime only).** Append a Data Viewer deeplink immediately after reference to a dataset file or evaluation result file in your response. Format: "[Open in Data Viewer](vscode://ms-windows-ai-studio.windows-ai-studio/open_data_viewer?file=<file_path>&source=microsoft-foundry-skill) for details and perform analysis". This applies to files in `datasets/`, `results/`.

## Related Skills

| User Intent | Skill |
|-------------|-------|
| "Analyze production traces" / "Search conversations" / "Find errors in App Insights" | [trace skill](../trace/trace.md) |
| "Debug container issues" / "Container logs" | [troubleshoot skill](../troubleshoot/troubleshoot.md) |
| "Deploy or redeploy agent" | [deploy skill](../deploy/deploy.md) |
