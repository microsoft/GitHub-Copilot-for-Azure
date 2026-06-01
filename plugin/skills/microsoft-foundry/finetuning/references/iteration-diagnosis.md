# Iteration Diagnosis

When an auto-tune iteration returns ITERATE (lift < target), classify the root cause before generating the next candidate plan. Random HP changes waste budget; the diagnosis tells you **which dimension to vary**.

Use `scripts/diagnose_iteration.py` — it samples train/test rows + the rubric + per-candidate eval results, asks a strong judge model to pick one of seven causes, and returns a JSON recommendation.

## Root-Cause Taxonomy

| Bucket | Signal | Next-iteration action |
|--------|--------|----------------------|
| `wrong_hps_overfit` | Train loss << val loss; FT regressed on test | Lower LR (×0.5), reduce epochs to 1, deploy earlier checkpoint |
| `wrong_hps_underfit` | Train + val loss plateau high; FT ≈ baseline | Raise LR (×1.5), increase epochs (+1), or try larger base model |
| `data_quality` | Test cases the FT now fails are visibly similar to noisy training rows | Re-generate with `score_dataset.py --min-score 8`, or hand-curate seeds |
| `model_mismatch` | FT lift saturates across HP sweeps; base model picks wrong task framing on probes | Swap base model (nano→mini, mini→4.1, or try Llama / Ministral) |
| `distribution_shift` | Train and test obviously differ (held-out is a different topic / style) | Re-split: keep test rows that resemble train distribution; or augment train |
| `eval_problem` | Spot-check shows FT outputs are good but evaluator scores low | Fix the grader (clearer rubric, stronger judge, better reference answers) BEFORE more training |
| `task_genuinely_hard` | Multiple iterations across HPs + base models all regress; manual inspection shows task needs retrieval/external knowledge | **STOP**. Recommend RAG, tool use, or task decomposition. Fine-tuning won't help. |
| `success_actually` | Lift > target on a non-default metric (e.g., conciseness improved + correctness held) | SHIP the candidate. Re-examine which metric was the goal. |

## Inputs the Judge Sees

`diagnose_iteration.py` constructs a prompt containing:

1. **Task spec**: description, base model, teacher, rubric.
2. **Per-iteration leaderboard**: HP combo + metric values + lift.
3. **3 random train rows** (so the judge sees what the model learned from).
4. **3 random test rows the FT failed** (so the judge sees the failure mode).
5. **3 random test rows the FT passed** (if any).

The judge returns:

```json
{
  "root_cause": "wrong_hps_overfit",
  "evidence": "Iter1 (lr=1.0, ep=2): train_loss 0.04, val_loss 0.31, ratio 7.8. Test lift -4.5%. Two of three failed cases are exact duplicates of training rows the model now over-fits to a verbose phrasing.",
  "recommendation": "Try lr=0.3, epochs=1 with the same data. If still negative, lower lr further.",
  "confidence": 0.85
}
```

## Decision Rules

In the autopilot loop:

```
if diagnose.root_cause == "task_genuinely_hard":
    STOP — recommend RAG/tools
elif diagnose.root_cause == "eval_problem":
    PAUSE — surface evaluator issues for review before more training
elif diagnose.root_cause == "success_actually":
    SHIP candidate with explanatory note
else:
    apply the recommended sweep, increment iter, continue
```

**Hard rule**: never plan a 4th iteration if the previous 3 all regressed. Default to STOP and present the leaderboard.

## Calibration

If `diagnose_iteration.py`'s pick disagrees with manual inspection more than ~30% of the time:

1. Use a stronger judge (`--judge gpt-4.1` instead of `gpt-4.1-mini`)
2. Include more failed-row samples (`--samples 5`)
3. Pin the judge to known examples by adding `--task-priors path/to/notes.md`

## See Also

- `workflows/auto-tune.md` — Phase 8 invokes this diagnosis
- `workflows/diagnose-poor-results.md` — manual diagnosis checklist for single runs
- `references/training-curves.md` — overfit / underfit visual signatures
