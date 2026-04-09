# Step 6 — CI/CD Evals & Continuous Production Monitoring

After confirming the final agent version through the observe loop, present two complementary monitoring options. The user may choose one, both, or neither.

## Option 1 — CI/CD Pipeline Evaluations (Pre-Deploy Gate)

*"Would you like to add automated evaluations to your CI/CD pipeline so every deployment is evaluated before going live?"*

CI/CD evals run batch evaluations as part of your deployment pipeline, catching regressions **before** they reach production.

If yes, generate a GitHub Actions workflow (for example, `.github/workflows/agent-eval.yml`) that:

1. Triggers on push to `main` or on pull request
2. Reads test-case definitions from `.foundry/agent-metadata.yaml`
3. Reads evaluator definitions from `.foundry/evaluators/` and test datasets from `.foundry/datasets/`
4. Runs `evaluation_agent_batch_eval_create` against the newly deployed agent version
5. Fails the workflow if any evaluator score falls below the configured thresholds for the selected environment/test case
6. Posts a summary as a PR comment or workflow annotation

Use repository secrets for the selected environment's project endpoint and Azure credentials. Confirm the workflow file with the user before committing.

## Option 2 — Continuous Production Monitoring (Post-Deploy)

*"Would you like to set up continuous evaluations to monitor your agent's quality in production?"*

Continuous evaluation uses Foundry-native MCP tools to automatically assess agent responses on an ongoing basis — no external pipelines required. This catches regressions that emerge **after** deployment from changing data, user patterns, or upstream service drift.

### Enable Continuous Evaluation

Use the [continuous evaluation reference](continuous-eval.md) to configure monitoring. The workflow:

1. **Check existing config** — call `continuous_eval_get` to see if monitoring is already active.
2. **Select evaluators** — recommend starting with the same evaluators used in batch evals for consistency:
   - **Quality evaluators** (require `deploymentName`): groundedness, coherence, relevance, task_adherence
   - **Safety evaluators**: violence, indirect_attack, hate_unfairness
3. **Enable** — call `continuous_eval_create` with the selected evaluators. The tool auto-detects agent kind and configures the appropriate backend (real-time for prompt agents, scheduled for hosted agents).
4. **Confirm** — present the returned configuration to the user.

### Acting on Monitoring Results

Monitoring is only complete when score drops trigger investigation and remediation.

#### Reading Evaluation Scores

The `continuous_eval_get` response includes an `evalId` linking to the evaluation group. Use this to pull actual scores:

```
Step 1: Get the continuous eval config
Tool: continuous_eval_get
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
→ Note the evalId from the response

Step 2: Read evaluation run results
Tool: evaluation_get
Arguments:
  projectEndpoint: <project endpoint>
  evalId: <evalId from step 1>
  isRequestForRuns: true
→ Returns evaluation runs with per-evaluator scores and timestamps
```

Review the returned runs for:
- **Scores below threshold** — any evaluator consistently scoring below your acceptable baseline
- **Score degradation over time** — scores trending downward across recent runs
- **Safety flags** — any non-zero safety evaluator scores (violence, indirect_attack, etc.)

#### Responding to Score Drops

When continuous evaluation detects a regression:

```text
Continuous eval detects score drop
  → Read scores: evaluation_get with evalId from continuous_eval_get
  → Triage: identify failing evaluators, correlate with traces
  → Diagnose: route into observe loop (Steps 3-4)
  → Fix: optimize prompt or agent config
  → Deploy: push fix via deploy skill
  → Verify: read scores from next continuous eval cycle
```

**Triage steps:**

1. Use `evaluation_get` with the `evalId` and `isRequestForRuns: true` to get the actual scores per evaluator per run. Identify which evaluators are below threshold and when the drop started.
2. Use the [trace skill](../../trace/trace.md) to find conversations that triggered low scores — look for patterns in query types, tool-call failures, or grounding gaps.
3. Compare against the last batch eval baseline in `.foundry/results/` to determine if this is a new regression or a pre-existing gap.

**Remediation routing:**

| Symptom | Route To |
|---------|----------|
| Quality scores dropping | [Step 3: Analyze](analyze-results.md) → [Step 4: Optimize](optimize-deploy.md) |
| Safety evaluators flagging | [trace skill](../../trace/trace.md) → update agent instructions |
| Scores regressed after deploy | [Step 5: Compare](compare-iterate.md) current vs. previous version |
| Grounding failures | Check data source health, update knowledge index or tool config |

**Verification after fix:**

After deploying a fix, close the loop:

1. Re-run a batch eval ([Step 2](evaluate-step.md)) against the same test cases to confirm the improvement immediately.
2. Read continuous eval scores from the next cycle using `evaluation_get` with the `evalId` to verify production recovery.
3. If the regression exposed a gap in evaluator coverage, use `continuous_eval_create` to update the monitoring configuration with additional evaluators.

The observe loop does not end at deployment. Continuous monitoring closes the loop: **observe → optimize → deploy → monitor → observe**. Always offer to set up monitoring after completing an optimization cycle.

## Reference

- [Azure AI Foundry Cloud Evaluation](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/develop/cloud-evaluation)
- [Hosted Agents](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/hosted-agents)
- [Continuous Evaluation Reference](continuous-eval.md)
