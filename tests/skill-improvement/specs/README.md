# Acceptance and refinement configuration

Run specifications use two related decisions:

- **Acceptance** decides whether a candidate is good enough to publish as the
  final result.
- **Refinement** decides whether a candidate that has not passed acceptance is
  still useful enough to become the starting point for the next iteration.

Final acceptance always compares a candidate with the original baseline.
Refinement compares a candidate with the version used to start its iteration.
This lets several safe, incremental changes accumulate without publishing a
candidate before it meets the final requirements.

## What a point means

Quality and score changes use **percentage points**, not percentages.

For example, moving from a 70% pass rate to a 73% pass rate is:

```text
73% - 70% = 3 percentage points
```

It is not a 3% relative increase. With 100 matched trials, one changed
pass/fail outcome is one quality point. With 166 matched trials, one outcome is
about 0.60 quality points:

```text
100 / 166 = 0.60 points per outcome
```

Per-eval and per-model regression points are calculated within that group. The
size of the group therefore matters. If an eval has five matched trials, one
pass-to-fail change is a 20-point regression. A five-point limit consequently
allows no changed failures in that eval.

Score points use the average normalized judge score. Moving from an average
score of 0.70 to 0.72 is a two-point score improvement.

## Acceptance fields

```yaml
acceptance:
  minimumQualityImprovementPoints: 1
  maximumEvalRegressionPoints: 15
  maximumModelRegressionPoints: 5
  minimumSkillInvocationRate: 0.8
  requireHeldOutImprovement: false
```

### `minimumQualityImprovementPoints`

The minimum aggregate pass-rate improvement over the original baseline.

- Increase it when the baseline is weak and substantial improvement should be
  possible.
- Decrease it when the baseline is already strong or near 100%, where few
  failed outcomes remain available to fix.
- Do not set it solely by intuition. Convert it to the number of outcomes that
  must change using `points * matched trials / 100`.

For 166 matched trials:

| Required points | Approximate additional passing outcomes |
| ---: | ---: |
| 0.5 | 1 |
| 1 | 2 |
| 2 | 4 |
| 5 | 9 |

### `maximumEvalRegressionPoints`

The largest permitted pass-rate regression in any individual eval file. This
prevents an aggregate improvement from hiding damage to one scenario area.

Choose this value with the smallest eval group in mind. A limit below the
effect of one changed outcome is equivalent to allowing no regression in that
group.

Use a lower value for safety-critical scenarios or large eval groups. Use a
higher value for small or noisy eval groups, while still requiring aggregate
quality improvement. Review the reported changed outcomes before accepting a
large local regression.

### `maximumModelRegressionPoints`

The largest permitted pass-rate regression for any answer model. This matters
when several answer models are configured. With only one answer model, it
largely duplicates the aggregate quality requirement.

Keep this strict when the skill must work consistently across models. Relax it
only when model-specific variance is expected and the aggregate evidence is
large enough to justify the tradeoff.

### `minimumSkillInvocationRate`

The minimum fraction of candidate trials that must invoke the target skill.
The value ranges from `0` to `1`; `0.8` means 80%.

A high threshold verifies that measured improvements actually exercise the
skill. Lower it when some prompts legitimately should not invoke the skill,
not merely to compensate for unreliable results.

### `requireHeldOutImprovement`

When `true`, the final candidate must also pass acceptance against eval files
that were not shown to the improvement agent. Held-out evidence reduces the
risk of overfitting but increases answer-generation and judge-call cost.

## Refinement fields

```yaml
refinement:
  minimumScoreImprovementPoints: 1
  maximumQualityRegressionPoints: 0
```

### `minimumScoreImprovementPoints`

The minimum average judge-score improvement needed to retain a candidate when
its pass rate has not improved. A candidate with any positive quality-point
improvement already satisfies the progress portion of the refinement decision.

This threshold recognizes partial progress that has not yet changed a judge's
final pass/fail decision. Set it above expected judge noise. Raising it keeps
only stronger intermediate changes; lowering it allows smaller changes to
accumulate but increases the chance of following noise.

### `maximumQualityRegressionPoints`

The aggregate pass-rate regression allowed between consecutive refinement
iterations. A value of `0` means an intermediate candidate may not lose any
aggregate quality.

This is a boundary for continuing automation, not final publication. Keep it
at `0` by default. A positive value should be used only when an intentional
temporary regression may enable a later improvement and enough iterations and
evaluation evidence exist to recover safely.

Refinement also enforces the configured skill-invocation threshold and Skill
Markdown token-growth limit.

## Suggested starting ranges

These are starting points, not universal defaults:

| Situation | Minimum quality improvement | Maximum per-eval regression | Refinement score improvement | Refinement quality regression |
| --- | ---: | ---: | ---: | ---: |
| New or weak skill | 2–5 points | 10–20 points | 1–2 points | 0 points |
| Established skill | 1–2 points | 10–15 points | 0.5–1 point | 0 points |
| Strong or near-ceiling baseline | 0.5–1 point | 10–20 points | 0.5–1 point | 0 points |
| Large, repeated evaluation set | 1–3 points | 5–10 points | 0.5–1 point | 0 points |

Smaller suites and single repetitions are noisier, so avoid interpreting very
small changes as conclusive. Prefer adding repetitions or held-out evals before
substantially loosening publication gates.

## Changing a specification

Edit the `acceptance` and `refinement` sections in the target YAML file, then
validate the configuration from the `tests` directory:

```powershell
npm run skill-improvement -- validate `
  --config .\skill-improvement\specs\azure-kusto.yaml
```

```bash
npm run skill-improvement -- validate \
  --config ./skill-improvement/specs/azure-kusto.yaml
```

The validation output includes `developmentPromptCount` and
`candidateAnswerGenerationsPerIteration`. Multiply the prompt count by the
number of Skill-enabled conditions, answer models, and repetitions to determine
the matched trial count used by the aggregate acceptance comparison.

After a run, use `report-summary.md` to inspect:

- the aggregate quality and score differences;
- the worst per-eval and per-model regressions;
- the target-skill invocation rate;
- whether an unaccepted candidate was retained for refinement;
- the individual pass-to-fail and fail-to-pass outcomes.

Tune thresholds based on repeated run evidence rather than changing them only
to make one candidate pass.
