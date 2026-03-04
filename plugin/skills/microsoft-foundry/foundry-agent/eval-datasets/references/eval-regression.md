# Eval Regression — Automated Regression Detection

Automatically detect when evaluation metrics degrade between agent versions. Compare each evaluation run against the baseline and generate pass/fail verdicts with actionable recommendations.

## Prerequisites

- At least 2 evaluation runs in the same evaluation group
- Baseline run identified (either the first run or the one tagged as `baseline`)

## Step 1 — Identify Baseline and Treatment

### Automatic Baseline Selection

1. Read `datasets/manifest.json` — find the dataset tagged `baseline`
2. Use **`evaluation_get`** to find the eval run that used this baseline dataset
3. The first run in the evaluation group serves as the baseline

### Treatment Selection

The latest (most recent) run in the evaluation group is the treatment.

## Step 2 — Run Comparison

Use **`evaluation_comparison_create`** to compare baseline vs treatment:

> **Critical:** `displayName` is **required** in the `insightRequest`. Despite the MCP tool schema showing it as optional, the API rejects requests without it.

```json
{
  "insightRequest": {
    "displayName": "Regression Check - v1 vs v4",
    "state": "NotStarted",
    "request": {
      "type": "EvaluationComparison",
      "evalId": "<eval-group-id>",
      "baselineRunId": "<baseline-run-id>",
      "treatmentRunIds": ["<latest-run-id>"]
    }
  }
}
```

Retrieve results with **`evaluation_comparison_get`** using the returned `insightId`.

## Step 3 — Regression Verdicts

For each evaluator in the comparison results, apply regression thresholds:

| Treatment Effect | Delta | Verdict | Action |
|-----------------|-------|---------|--------|
| `Improved` | > +2% | ✅ PASS | No action needed |
| `Changed` | ±2% | ⚠️ NEUTRAL | Monitor, no immediate action |
| `Degraded` | > -2% | 🔴 REGRESSION | Investigate and remediate |
| `Inconclusive` | — | ❓ INCONCLUSIVE | Increase sample size and re-run |
| `TooFewSamples` | — | ❓ INSUFFICIENT DATA | Need more test cases (≥30 recommended) |

### Example Regression Report

```
╔═══════════════════════════════════════════════════════════════╗
║              REGRESSION REPORT: v1 (baseline) → v4           ║
╠═══════════════════════════════════════════════════════════════╣
║ Evaluator          │ Baseline │ Treatment │ Delta  │ Verdict ║
╠════════════════════╪══════════╪═══════════╪════════╪═════════╣
║ Coherence          │ 3.2      │ 4.0       │ +0.8   │ ✅ PASS ║
║ Fluency            │ 4.1      │ 4.5       │ +0.4   │ ✅ PASS ║
║ Relevance          │ 2.8      │ 3.6       │ +0.8   │ ✅ PASS ║
║ Intent Resolution  │ 3.0      │ 4.1       │ +1.1   │ ✅ PASS ║
║ Task Adherence     │ 2.5      │ 3.9       │ +1.4   │ ✅ PASS ║
║ Safety             │ 0.95     │ 0.98      │ +0.03  │ ✅ PASS ║
╠═══════════════════════════════════════════════════════════════╣
║ OVERALL: ✅ ALL EVALUATORS PASSED — Safe to deploy           ║
╚═══════════════════════════════════════════════════════════════╝
```

### Example with Regression

```
╔═══════════════════════════════════════════════════════════════╗
║              REGRESSION REPORT: v3 → v4                      ║
╠═══════════════════════════════════════════════════════════════╣
║ Evaluator          │ v3       │ v4        │ Delta  │ Verdict ║
╠════════════════════╪══════════╪═══════════╪════════╪═════════╣
║ Coherence          │ 4.1      │ 4.0       │ -0.1   │ ⚠️ NEUT║
║ Fluency            │ 4.4      │ 4.5       │ +0.1   │ ✅ PASS ║
║ Relevance          │ 4.0      │ 3.6       │ -0.4   │ 🔴 REGR║
║ Intent Resolution  │ 4.2      │ 4.1       │ -0.1   │ ⚠️ NEUT║
║ Task Adherence     │ 3.8      │ 3.9       │ +0.1   │ ✅ PASS ║
║ Safety             │ 0.96     │ 0.98      │ +0.02  │ ✅ PASS ║
╠═══════════════════════════════════════════════════════════════╣
║ OVERALL: 🔴 REGRESSION DETECTED on Relevance (-10%)         ║
║ RECOMMENDATION: Do NOT deploy v4. Investigate relevance drop.║
╚═══════════════════════════════════════════════════════════════╝
```

## Step 4 — Remediation Recommendations

When regression is detected, provide actionable guidance:

| Regression Type | Likely Cause | Recommended Action |
|----------------|-------------|-------------------|
| Relevance drop | Prompt changes reduced focus on user query | Review prompt diff, restore relevance instructions |
| Coherence drop | Added conflicting instructions | Simplify prompt, use `prompt_optimize` |
| Safety regression | Removed safety guardrails | Restore safety instructions, add safety test cases |
| Task adherence drop | Tool configuration changed | Verify tool definitions, check for missing tools |
| Across-the-board drop | Dataset drift or model change | Check if evaluation dataset changed, verify model deployment |

## CI/CD Integration

Include regression checks in automated pipelines. See [observe skill CI/CD](../../observe/references/cicd-monitoring.md) for GitHub Actions workflow templates that:

1. Run batch evaluation after every deployment
2. Compare against baseline
3. Block deployment if any evaluator shows > 5% regression
4. Alert team via GitHub issue or Slack webhook

## Next Steps

- **View full trend history** → [Eval Trending](eval-trending.md)
- **Optimize to fix regression** → [observe skill Step 4](../../observe/references/optimize-deploy.md)
- **Roll back if critical** → [deploy skill](../../deploy/deploy.md)
