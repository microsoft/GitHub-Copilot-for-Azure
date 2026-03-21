# Steps 8–10 — Re-Evaluate, Compare Versions, Iterate

## Step 8 — Re-Evaluate

Use **`evaluation_agent_batch_eval_create`** with the **same `evaluationId`** as the baseline run. This places both runs in the same eval group for comparison. Use the same local test dataset (from `.foundry/datasets/`) and evaluator bundle from the selected environment/test case. Update `agentVersion` to the new version.

> ⚠️ **Parameter switch reminder:** Re-evaluation creation uses `evaluationId`, but follow-up calls to `evaluation_get` and `evaluation_comparison_create` must use `evalId`.

> ⚠️ **Eval-group immutability:** Reuse the same `evaluationId` only when `evaluatorNames` and thresholds are unchanged. If you add/remove evaluators or change thresholds, create a new evaluation group first, then compare runs within that new group.

Auto-poll for completion in a background terminal (same as [Step 2](evaluate-step.md)).

## Step 9 — Compare Versions

> **Critical:** `displayName` is **required** in the `insightRequest`. Despite the MCP tool schema showing `displayName` as optional (`type: ["string", "null"]`), the API will reject requests without it with a BadRequest error. `state` must be `"NotStarted"`.

### Required Parameters for `evaluation_comparison_create`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `insightRequest.displayName` | ✅ | Human-readable name. **Omitting causes BadRequest.** |
| `insightRequest.state` | ✅ | Must be `"NotStarted"` |
| `insightRequest.request.evalId` | ✅ | Eval group ID containing both runs |
| `insightRequest.request.baselineRunId` | ✅ | Run ID of the baseline |
| `insightRequest.request.treatmentRunIds` | ✅ | Array of treatment run IDs |

Use **`evaluation_comparison_create`** with a nested `insightRequest`:

```json
{
  "insightRequest": {
    "displayName": "V1 vs V2 Comparison",
    "state": "NotStarted",
    "request": {
      "type": "EvaluationComparison",
      "evalId": "<eval-group-id>",
      "baselineRunId": "<baseline-run-id>",
      "treatmentRunIds": ["<new-run-id>"]
    }
  }
}
```

> **Important:** Both runs must be in the **same eval group** (same `evaluationId` in Steps 2 and 8), but comparison requests and lookups use `evalId` for that same group identifier. That shared group assumes the evaluator bundle is fixed for all runs in the group.

Then use **`evaluation_comparison_get`** (with the returned `insightId`) to retrieve comparison results. Present a summary showing which version performed better per evaluator, and recommend which version to keep.

## Step 10 — Iterate or Finish

If more categories remain in the prioritized action table (from [Step 4](analyze-results.md)), loop back to **Step 5** (dive into next category) → **Step 6** (optimize) → **Step 7** (deploy) → **Step 8** (re-evaluate) → **Step 9** (compare).

Otherwise, confirm the final agent version with the user, then prompt for [CI/CD evals & monitoring](cicd-monitoring.md).
