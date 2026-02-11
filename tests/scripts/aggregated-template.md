# Combined Test Run Report: 

**Test Run:** `{test-run-name}`  
**Date:** {test-date}  
**Report Generated:** {report-date}  
**Total Test Cases:** {total-test-cases}  
**Total Runs:** {total-runs}  

---

## 📊 Overall Summary

| Metric | Value |
|--------|-------|
| **Total Test Cases** | {total-test-cases} |
| **Total Individual Runs** | {total-runs} |
| **Overall Skill Invocation Rate** | **{rate}%** ({invoked}/{total}) |
| **Overall Task Pass Rate** | **{rate}%** ({passed}/{total}) |
| **Average Confidence** | **{avg-confidence}%** |
| **Skills Tested** | {skill-count} |
| **Test Categories** | {comma-separated list of test category names} |

---

## 🎯 Results by Skill

Aggregate results per skill. One row per skill, sorted alphabetically. Include footnotes for any anomalies.

| Skill | Tests | Runs | Skill Invocation Rate | Task Pass Rate | Avg Confidence |
|-------|-------|------|-----------------------|----------------|----------------|
| `{skill-name}` | {test-count} | {run-count} | {rate}% ({invoked}/{total}) | {rate}% ({passed}/{total}) | {confidence}% |
| ... | ... | ... | ... | ... | ... |

> Include numbered footnotes (¹, ², ³, etc.) to explain anomalies such as mixed test types, partial data, or special conditions.

---

## 🏆 Top Performers (100% Pass Rate, ≥90% Confidence)

List all test prompts that achieved 100% pass rate AND ≥90% average confidence.

| Skill | Test Prompt | Pass Rate | Confidence |
|-------|-------------|-----------|------------|
| `{skill-name}` | {test-prompt-description} | 100% ({n}/{n}) | {confidence}% |
| ... | ... | ... | ... |

---

## 🔴 Lowest Performers

List all test prompts with ≤50% pass rate OR notably low confidence. Include the primary blocker for each.

| Skill | Test Prompt | Pass Rate | Confidence | Primary Blocker |
|-------|-------------|-----------|------------|-----------------|
| `{skill-name}` | {test-prompt-description} | {rate}% ({passed}/{total}) | {confidence}% | {brief description of root cause} |
| ... | ... | ... | ... | ... |

---

## 🚀 End-to-End Deployment Tests

If end-to-end deployment tests were run, list them here. Otherwise omit this section.

| Test | Status | Duration | Confidence | Skills Used |
|------|--------|----------|------------|-------------|
| {app-description} → {target-service} | ✅ PASSED / ❌ FAILED | ~{duration} | {confidence}% | {comma-separated skill names} |
| ... | ... | ... | ... | ... |

Include a summary line, e.g.: "All {n} end-to-end deployments succeeded with live, verified URLs." or "X of Y deployments failed."

---

## 📊 Per-Test Breakdown

### Skill Invocation Tests ({n} runs each)

One row per test prompt. Include the test number, prompt, target skill, pass/fail counts, rate, and average confidence.

| # | Test Prompt | Skill | Passed | Failed | Rate | Avg Confidence |
|---|-------------|-------|--------|--------|------|----------------|
| {n} | {test-prompt-description} | `{skill-name}` | {passed} | {failed} | {rate}% | {confidence}% |
| ... | ... | ... | ... | ... | ... | ... |

> Include numbered footnotes (², ³, ⁴, etc.) to explain edge cases such as:
> - Skill invoked but task failed due to missing workspace files
> - Agent bypassed skill and used a tool directly
> - Task paused awaiting user input

---

## 📈 Token Usage

Report token usage where data is available. Indicate when data is missing or estimated.

| Test / Skill | Input Tokens | Output Tokens | Total Tokens |
|--------------|-------------|---------------|--------------|
| {test-or-skill-description} ({n} run(s)) | ~{input} | ~{output} | ~{total} |
| ... | ... | ... | ... |

### Estimated Aggregate Token Usage (where data available)

| Metric | Value |
|--------|-------|
| **Estimated Total Tokens** | **~{total}+** |
| **Highest Single Run** | ~{value} ({test-description}) |
| **Lowest Single Run** | ~{value} ({test-description}) |
| **Highest Per-Test Average** | ~{value}/run ({test-description}) |
| **Lowest Per-Test Average** | ~{value}/run ({test-description}) |

> ⚠️ Token usage was not recorded for all tests. The figure above is a lower bound estimate.

---

## ⚠️ Warnings Summary (Non-Blocking)

Categorize all warnings encountered during testing. Note that warnings are non-blocking — they did not prevent task completion when tasks succeeded.

### By Category

Group warnings into categories. One row per category.

| Warning Category | Occurrences | Tests Affected | Impact |
|-----------------|-------------|----------------|--------|
| **{category-name}** | {count}+ | {affected-skills-or-tests} | {brief impact description} |
| ... | ... | ... | ... |

### Most Impactful Warnings

List the top warnings ranked by impact on test outcomes. Include a numbered list with description and effect.

1. **{warning-name}** — {description of the warning, which tests it affected, and why it matters}
2. **{warning-name}** — {description}
3. ...

---

## 🔑 Key Findings

### ✅ Strengths

Numbered list of positive findings. Each item should be a concise, data-backed observation.

1. **{finding-title}** — {description with supporting data, e.g., pass rates, confidence scores}
2. **{finding-title}** — {description}
3. ...

### ⚠️ Areas for Improvement

Numbered list of areas needing improvement. Each item should identify the problem, affected skill(s), and a suggested fix or investigation.

1. **{area-title}** — {description with data and suggested action}
2. **{area-title}** — {description}
3. ...

---

*Combined report generated on {report-date} from {total-test-cases} individual test reports across {total-runs} total runs.*
