# Report Format

## Single Run Report

```markdown
## Test Results Overview

| Metric | Value |
|--------|-------|
| **Total tests** | {total} |
| **Executed** | {executed} |
| **Skipped** | {skipped} |
| **Passed** | {passed} |
| **Failed** | {failed} |
| **Test Pass Rate** | **{rate}%** ({passed}/{executed}) |

### Executed Tests

| # | Test | Duration | Result |
|---|------|----------|--------|
| {n} | {describe} > {test-name} | {Xm Ys} | **Pass** / **Fail** ({reason}) |

---

## Skill Invocation Rate

> **Note:** The three-column matrix below (azure-prepare, azure-validate, azure-deploy) applies **only to azure-deploy integration tests**, which exercise the full deployment chain. For all other integration tests, use the single-skill format shown after this section.

### azure-deploy tests (full chain)

| Test | azure-prepare | azure-validate | azure-deploy |
|------|:---:|:---:|:---:|
| {n}. {short-test-name} | **Yes** / No | **Yes** / No | **Yes** / No |

#### Summary

| Skill | Invocation Rate |
|-------|----------------|
| **azure-deploy** | **{rate}%** ({n}/{total}) |
| **azure-prepare** | **{rate}%** ({n}/{total}) |
| **azure-validate** | **{rate}%** ({n}/{total}) |
| **Full skill chain** (prepare → validate → deploy) | **{rate}%** ({n}/{total}) |
| **Overall test pass rate** | **{rate}%** per skill report ({n}/{total} soft-pass), **{rate}%** per JUnit ({n}/{total} hard-pass) |
| **Average confidence** | **{avg}%** |

### All other integration tests (single skill)

| Test | {skill-under-test} |
|------|:---:|
| {n}. {short-test-name} | **Yes** / No |

#### Summary

| Skill | Invocation Rate |
|-------|----------------|
| **{skill-under-test}** | **{rate}%** ({n}/{total}) |
| **Overall test pass rate** | **{rate}%** per skill report ({n}/{total} soft-pass), **{rate}%** per JUnit ({n}/{total} hard-pass) |
| **Average confidence** | **{avg}%** |

### Key Issues

- {bullet summary of the most impactful problems}
```

## Comparison Report (two runs)

When a second run is provided, append a comparison section after the single-run report for the **second** run.

```markdown
## Run Comparison: {skill} ({test-group})

| | **Run #{earlier-id}** (earlier) | **Run #{later-id}** (later) | **Delta** |
|---|---|---|---|
| **Date** | {date-earlier} | {date-later} | {delta} |
| **Duration** | {dur-earlier} | {dur-later} | {delta} |
| **Tests Executed** | {n} | {n} | — |

### JUnit Hard Pass Rate

| Test | Run #{earlier-id} | Run #{later-id} | Change |
|------|:---:|:---:|:---:|
| {test-name} | **Pass** / **Fail** | **Pass** / **Fail** | Improved / Regressed / Same |

### Skill Invocation Comparison

> For azure-deploy tests, show the full chain. For other tests, show only the skill under test.

#### azure-deploy tests

| Test | Run #{earlier-id} | Run #{later-id} |
|------|---|---|
| {n}. {short-name} | prepare: Yes/No, validate: Yes/No, **deploy: Yes/No** | ... |

| Metric | Run #{earlier-id} | Run #{later-id} | Delta |
|--------|:---:|:---:|:---:|
| **azure-deploy invoked** | **{rate}%** ({n}/{t}) | **{rate}%** ({n}/{t}) | **+/-{delta}%** |
| **azure-prepare invoked** | **{rate}%** ({n}/{t}) | **{rate}%** ({n}/{t}) | **+/-{delta}%** |
| **azure-validate invoked** | **{rate}%** ({n}/{t}) | **{rate}%** ({n}/{t}) | **+/-{delta}%** |
| **Full chain (P→V→D)** | **{rate}%** ({n}/{t}) | **{rate}%** ({n}/{t}) | **+/-{delta}%** |

#### All other integration tests

| Test | Run #{earlier-id} | Run #{later-id} |
|------|:---:|:---:|
| {n}. {short-name} | **Yes** / No | **Yes** / No |

| Metric | Run #{earlier-id} | Run #{later-id} | Delta |
|--------|:---:|:---:|:---:|
| **{skill-under-test} invoked** | **{rate}%** ({n}/{t}) | **{rate}%** ({n}/{t}) | **+/-{delta}%** |

### Report Confidence & Pass Rate

| Metric | Run #{earlier-id} | Run #{later-id} | Delta |
|--------|:---:|:---:|:---:|
| **Skill Report Pass Rate** | {rate}% | {rate}% | {delta}% |
| **Avg Confidence** | {avg}% | {avg}% | {delta}% |

### Key Takeaways

1. {numbered insight referencing data from both runs}
```

## Guidelines

- Always bold **Yes** and **Pass** values for visual scanning
- Use `:---:` centered alignment for Yes/No and Pass/Fail columns
- Convert JUnit `time` attribute (seconds) to human-readable `Xm Ys` format
- For deltas, use `+` prefix for improvements and `-` for regressions
- Round percentages to one decimal place
