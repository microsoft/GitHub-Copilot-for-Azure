# Continuous Evaluation -- Acting on Results

When continuous evaluation detects quality degradation, follow this remediation workflow. Part of the [Continuous Evaluation](continuous-eval.md) skill.

Continuous evaluation generates ongoing scores -- but monitoring is only useful when you **act** on what it reveals. This section covers how to consume evaluation results and the remediation loop when scores degrade.

### Step 1: Read Evaluation Scores

The `continuous_eval_get` response includes an `evalId` that links to the evaluation group. Use this to retrieve actual run results:

```yaml
Tool: continuous_eval_get
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
# Note the evalId from the response
```

```yaml
Tool: evaluation_get
Arguments:
  projectEndpoint: <project endpoint>
  evalId: <evalId from continuous_eval_get>
  isRequestForRuns: true
# Returns evaluation runs with per-evaluator scores
```

Review the run results for score trends. Each run contains scores for every configured evaluator. Look for:
- **Scores below threshold** -- any evaluator consistently scoring below your acceptable baseline
- **Score degradation over time** -- scores that were previously healthy but are trending downward
- **Safety flags** -- any non-zero safety evaluator scores that indicate harmful content

### Step 2: Triage the Regression

1. **Identify the failing evaluators.** From the evaluation runs, note which specific evaluators are scoring low (e.g., `groundedness` dropping from 4.2 to 2.8).
2. **Correlate with traces.** Use the [trace skill](../../trace/trace.md) to search App Insights for the conversations that triggered low scores. Look for patterns: specific query types, tool-call failures, or grounding gaps.
3. **Compare to baseline.** If batch eval results exist in `.foundry/results/`, compare continuous eval scores against the last known-good batch run to determine whether this is a new regression or a pre-existing gap.

### Step 3: Remediate via the Observe Loop

Once you understand the failure pattern, use the [observe skill](../observe.md) to fix it:

| Symptom | Action |
|---------|--------|
| Quality scores dropping (coherence, relevance, task_adherence) | Run [Step 3: Analyze](analyze-results.md) to cluster failures, then [Step 4: Optimize](optimize-deploy.md) to improve the prompt |
| Safety evaluators flagging (violence, indirect_attack) | Review flagged traces via [trace skill](../../trace/trace.md), then update agent instructions or tool definitions to address the pattern |
| Grounding failures | Check whether the agent's data sources are still accessible and returning expected results; update knowledge index or tool configuration |
| Scores fluctuating after a deploy | Run [Step 5: Compare](compare-iterate.md) between the current and previous agent version to isolate the regression |

### Step 4: Verify the Fix

After deploying a fix through the observe loop:

1. **Re-run a batch eval** via [observe](../observe.md) Step 2 against the same test cases to confirm the fix.
2. **Read continuous eval scores** from the next evaluation cycle using `evaluation_get` with the `evalId` -- verify scores have recovered.
3. **Adjust evaluators if needed.** If the regression exposed a gap in evaluator coverage, use `continuous_eval_create` to update the configuration with additional or refined evaluators.

> Tip: The continuous eval -> observe -> deploy -> continuous eval cycle is the core production quality loop. Continuous eval detects; observe diagnoses and fixes; continuous eval verifies.
