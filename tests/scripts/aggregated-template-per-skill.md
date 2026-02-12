# Skill Test Report: `{skill-name}`

**Test Run:** `{test-run-name}`  
**Date:** {test-date}  
**Report Generated:** {report-date}  
**Skill Under Test:** `{skill-name}`  
**Skill Description:** {skill-description}  

### Tests Executed

List every test that was run against this skill, grouped by test type.

| # | Test Name | Test Type | Runs |
|---|-----------|-----------|------|
| {n} | {test-name} | Skill Invocation / Integration / End-to-End | {run-count} |
| ... | ... | ... | ... |

---

## 📊 Overall Statistics

| Metric | Value |
|--------|-------|
| **Total Test Cases** | {total-test-cases} |
| **Total Individual Runs** | {total-runs} |
| **Skill Invocation Success Rate**¹ | **{rate}%** ({invoked}/{total}) |
| **Overall Test Pass Rate** | **{rate}%** ({passed}/{total}) |
| **Average Confidence** | **{avg-confidence}%** |

> ¹ Skill Invocation Success Rate is calculated only from skill-invocation test cases. If no skill-invocation tests were run, mark as **N/A**.

---

## 🔍 Per-Test Case Results

For each test case, provide a narrative summary of what happened during execution, what went well, and what went wrong. One subsection per test case.

### Test {n}: {test-name}

**Type:** Skill Invocation / Integration
**Prompt:** "{user-prompt-used}"  
**Runs:** {run-count} | **Pass Rate:** {rate}% ({passed}/{total}) | **Avg Confidence:** {confidence}%  

**What Happened:**  
{Narrative description of the test execution flow. Describe the key steps the agent took, which tools were called, and the final outcome. Be specific — reference actual agent behavior observed in the logs.}

**✅ What Went Well:**  
- {Positive observation — e.g., "Skill was correctly invoked on all runs", "Agent produced accurate output matching expected response"}
- ...

**❌ What Went Wrong:**  
- {Negative observation — e.g., "Skill was not invoked in 2 of 5 runs; agent used a tool directly instead", "Response was missing required fields"}
- ...

> Include footnotes for edge cases such as: skill invoked but task failed due to missing workspace files, agent bypassed skill and used a tool directly, or task paused awaiting user input.

*(Repeat this subsection for each test case)*

---

## 🌍 Environment Changes

Document any side effects or changes made to the local or cloud environment during test execution. If no changes were detected, state "No environment changes detected."

### Azure Resources

List any Azure resources that were created, modified, or deleted during the test run.

| Resource Type | Resource Name | Resource Group | Resource URL | Action | Test(s) |
|---------------|---------------|----------------|--------------|--------|---------|
| {resource-type, e.g., Static Web App} | {resource-name} | {resource-group} | {URL to view the Resources in Azure Portal} | Created / Modified / Deleted | Test {n} |
| ... | ... | ... | ... | ... | ... |

### Local File Modifications

List any files created, modified, or deleted on the local filesystem during testing.

| File Path | Action | Test(s) |
|-----------|--------|---------|
| {file-path} | Created / Modified / Deleted | Test {n} |
| ... | ... | ... |

### CLI Commands Executed

List notable CLI commands that were run during testing (e.g., `az` commands, `npm` commands, `git` operations).

| Command | Purpose | Test(s) |
|---------|---------|---------|
| `{command}` | {brief description of why it was run} | Test {n} |
| ... | ... | ... |

---

## 📈 Token Usage

Report token usage per test case. Indicate when data is missing or estimated.

| # | Test Name | Runs | Input Tokens | Output Tokens | Total Tokens |
|---|-----------|------|-------------|---------------|--------------|
| {n} | {test-name} ({run-count} run(s)) | {run-count} | ~{input} | ~{output} | ~{total} |
| ... | ... | ... | ... | ... | ... |

### Aggregate Token Summary

| Metric | Value |
|--------|-------|
| **Total Tokens (all tests)** | **~{total}+** |
| **Highest Single Run** | ~{value} ({test-name}) |
| **Lowest Single Run** | ~{value} ({test-name}) |
| **Average Per Run** | ~{value} |

> ⚠️ Token usage may not be recorded for all runs. Figures above are lower-bound estimates where data is incomplete.

---

## 🔑 Areas for Improvement

Actionable suggestions for the skill author based on problems discovered during testing. Each item should identify the problem, cite supporting evidence from test results, and propose a concrete fix or investigation.

1. **{area-title}** — {Description of the problem. Reference specific test cases, pass rates, or agent behaviors that surfaced this issue. Suggest what the skill author could change in the skill definition, prompts, triggers, or instructions to address it.}
2. **{area-title}** — {Description and suggestion}
3. ...

---

*Per-skill report generated on {report-date} for skill `{skill-name}` — {total-test-cases} test cases across {total-runs} total runs.*
