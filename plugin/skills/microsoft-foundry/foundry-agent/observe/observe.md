# Agent Observability Loop

Orchestrate the full eval-driven optimization cycle for a Foundry agent. This skill manages the **multi-step workflow** for a selected agent root and environment: reusing or refreshing `.foundry` cache in that folder only, auto-creating evaluators, generating test datasets, running batch evals, clustering failures, optimizing prompts, redeploying, and comparing versions. Use this skill instead of calling individual `azure` MCP evaluation tools manually.

## When to Use This Skill

USE FOR: evaluate my agent, run an eval, test my agent, check agent quality, run batch evaluation, analyze eval results, why did my eval fail, cluster failures, improve agent quality, optimize agent prompt, compare agent versions, re-evaluate after changes, set up CI/CD evals, agent monitoring, eval-driven optimization, set up continuous monitoring, production quality monitoring, why are eval scores dropping.

> [!] **DO NOT manually call** `evaluation_agent_batch_eval_create`, `evaluator_catalog_create`, `evaluation_comparison_create`, `prompt_optimize`, or `continuous_eval_create` **without reading this skill first.** This skill defines required pre-checks, environment selection, cache reuse, artifact persistence, and multi-step orchestration that the raw tools do not enforce.

## Quick Reference

| Property | Value |
|----------|-------|
| MCP server | `azure` |
| Key MCP tools | `evaluator_catalog_get`, `evaluation_agent_batch_eval_create`, `evaluator_catalog_create`, `evaluation_comparison_create`, `evaluation_get`, `prompt_optimize`, `agent_update`, `continuous_eval_create`, `continuous_eval_get`, `continuous_eval_delete` |
| Prerequisite | Agent deployed and running (use [deploy skill](../deploy/deploy.md)) |
| Local cache | selected `.foundry/agent-metadata*.yaml` file, `.foundry/evaluators/`, `.foundry/datasets/`, `.foundry/results/` |
| Workspace standard | See [.foundry Workspace Standard](../../references/foundry-workspace.md) for layout, agent types, and setup references |

## Entry Points

| User Intent | Start At |
|-------------|----------|
| "Deploy and evaluate my agent" | [Step 1: Auto-Setup Evaluators](references/deploy-and-setup.md) (deploy first via [deploy skill](../deploy/deploy.md)) |
| "Agent just deployed" / "Set up evaluation" | [Step 1: Auto-Setup Evaluators](references/deploy-and-setup.md) (skip deploy, run auto-create) |
| "Evaluate my agent" / "Run an eval" | [Step 1: Auto-Setup Evaluators](references/deploy-and-setup.md) first if `.foundry/evaluators/` or `.foundry/datasets/` cache is missing, stale, or the user requests refresh, then [Step 2: Evaluate](references/evaluate-step.md) |
| "Why did my eval fail?" / "Analyze results" | [Step 3: Analyze](references/analyze-results.md) |
| "Improve my agent" / "Optimize prompt" | [Step 4: Optimize](references/optimize-deploy.md) |
| "Compare agent versions" | [Step 5: Compare](references/compare-iterate.md) |
| "Set up CI/CD evals" | [Step 6: CI/CD & Monitoring](references/cicd-monitoring.md) |
| "Enable continuous monitoring" / "Set up production monitoring" / "Evaluation results dropping" | [Continuous Eval](references/continuous-eval.md) |

> [!] **Important:** Before running any evaluation (Step 2), always resolve the selected agent root, metadata file, and environment, then inspect that metadata file plus `.foundry/evaluators/` and `.foundry/datasets/` in that root only. If the cache is missing, stale, or the user wants to refresh it, route through [Step 1: Auto-Setup](references/deploy-and-setup.md) first - even if the user only asked to "evaluate." Do **not** merge `.foundry` cache or source context from sibling agent folders or sibling metadata files.

## Before Starting - Detect Current State

1. Resolve the target agent root, selected metadata file, and environment from `.foundry/agent-metadata*.yaml`.
2. Use `agent_get` and `agent_container_status_get` to verify the environment's agent exists and is running.
3. Inspect the selected environment's `evaluationSuites[]` plus cached files under `.foundry/evaluators/` and `.foundry/datasets/` in the selected agent root only. If the metadata still uses older `testSuites[]` or legacy `testCases[]`, normalize that list to evaluation suites first using the shared migration rule.
4. Use `evaluation_get` to check for existing eval runs.
5. Jump to the appropriate entry point.

## Loop Overview

```text
1. Auto-setup evaluators or refresh .foundry cache for the selected environment
   -> ask: "Run an evaluation to identify optimization opportunities?"
2. Evaluate (batch eval run)
3. Download and cluster failures
4. Pick a category or evaluation suite to optimize
5. Optimize prompt
6. Deploy new version (after user sign-off)
7. Re-evaluate (same env + same evaluation suite)
8. Compare versions -> decide which to keep
9. Loop to next category or finish
10. Prompt: enable CI/CD pipeline evals and/or continuous production monitoring
```

## Behavioral Rules

Follow the [behavioral rules](references/behavioral-rules.md) for cache reuse, context visibility, evaluator management, legacy metadata migration, and artifact persistence.

## Two-Phase Evaluator Strategy

Follow the [Two-Phase Evaluator Strategy](references/two-phase-evaluators.md). Phase 1 uses <=5 built-in evaluators for a fast baseline. Phase 2 adds targeted custom evaluators after analyzing the first run's failures.

> See [Two-Phase Evaluator Strategy](references/two-phase-evaluators.md) for the full strategy, including the Phase 1/Phase 2 table and custom evaluator examples.

## Related Skills

| User Intent | Skill |
|-------------|-------|
| "Analyze production traces" / "Search conversations" / "Find errors in App Insights" | [trace skill](../trace/trace.md) |
| "Debug hosted agent issues" / "Hosted-agent logs" | [troubleshoot skill](../troubleshoot/troubleshoot.md) |
| "Deploy or redeploy agent" | [deploy skill](../deploy/deploy.md) |
| "Enable continuous evaluation" / "Set up ongoing monitoring" | [Continuous Eval](references/continuous-eval.md) (reference within this skill) |
