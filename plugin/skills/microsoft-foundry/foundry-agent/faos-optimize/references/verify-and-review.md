# FAOS Conversion -- Verify and Review

Verification and review phase for FAOS agent optimization conversion. Part of the [FAOS Optimize skill](../faos-optimize.md).

## Step 11: Verify

Run these checks where possible:

1. Python syntax check for changed files
2. Import smoke test for `agent_optimization.load_config`
3. Default config smoke test with no optimization env vars
4. Pylance or workspace diagnostics for changed files
5. Existing project tests if they are cheap and relevant

If Azure credentials or model endpoints are missing, do not treat live invocation failures as conversion failures. The required proof is that defaults load and the original runtime can still start or import as far as local configuration allows.

## Step 12: Stop for Review, Then Suggest Deploy

End the workflow with a review checkpoint. Summarize:

- Changed files
- FAOS knobs exposed
- Evaluator objectives considered
- Any global side effects, such as shared model clients
- Verification results

Ask the user to review the diff. Do not deploy automatically.

When the user approves deployment, route to [deploy](../../deploy/deploy.md), then [invoke](../../invoke/invoke.md). If the user wants to evaluate the deployed version, route to [observe](../../observe/observe.md).
