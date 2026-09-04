# Skill Test Report: `{skill-name}`

**Test Run:** `{test-run-name}`
**Date:** {test-date}
**Report Generated:** {report-date}
**Skill Under Test:** `{skill-name}`
**Skill Description:** {skill-description}

### Tests Executed

List every test that was run against this skill, grouped by test type.

| # | Test Name | Runs |
|---|-----------|------|
| {n} | {test-name} | {run-count} |
| ... | ... | ... |

## 📊 Overall Statistics

| Metric | Value |
|--------|-------|
| **Overall Test Pass Rate** | **{rate}%** ({passed}/{total}) |

The per-test report gives the binary pass/fail result for each test. Compute a pass/fail rate across all tests and present it here.

## 🔍 Per-Test Case Results

Each test's consolidated report includes a summary of its trajectories. Replicate them here for all the tests.

### Test {n}: {test-name}

**Prompt:** "{user-prompt-used}"  
**Trials:** {trial-count} | **Pass Rate:** {rate}% ({passed}/{total})

{Replicated trajectory summary, including what happened, what went well, what went wrong and token usage}

Include this note once after all test results to help reader understand what Credit Score means.

> **Credit score formula:** $\text{Credit Score} = (\text{Uncached Input} + 0.1 \times \text{Cached Input}) + 5 \times \text{Output}$. 5 is the estimated cost multiplier for output tokens compared to uncached input tokens. This score estimates relative monetary token cost; the actual monetary token cost depends on the actual price of the model.

*(Repeat this subsection for each test case)*

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

### MCP Tools Used

List MCP tools that have been used during the tests.

| Tool Name | MCP Server | Invocations | Purpose | Test(s) |
|-----------|------------|-------------|---------|---------|
| `{tool-name}` | {mcp-server-name} | {count} | {brief description of why it was used} | Test {n} |
| ... | ... | ... | ... | ... |

## 🚀 Recommended Actions

Each test's consolidated report includes recommended actions. Replicate them here for all the tests.

### Test {n}: {test-name}

{recommended actions for this test}

*Per-skill report generated on {report-date} for skill `{skill-name}` — {total-test-cases} test cases across {total-runs} total runs.*
