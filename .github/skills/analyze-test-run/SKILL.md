---
name: analyze-test-run
description: "Analyzes a GitHub Actions workflow run (given its run ID or URL) to identify test failures and automatically creates GitHub issues for each failing test. Use when you need to analyze test runs, diagnose workflow run failures, or create issues for test failures. TRIGGERS: analyze test run, analyze workflow run, test failures, create issues for test failures, workflow run failures, run ID analysis."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Analyze Test Run

## Quick Reference

| Property | Value |
|----------|-------|
| Tools | GitHub MCP: `actions`, `issues`, `labels` |
| Output | Up to 10 issues labeled `bug` + `test-failure` via `safe-outputs.create-issue` |
| Best for | Diagnosing CI failures and filing actionable bug reports |

## When to Use This Skill

- A GitHub Actions workflow run has failed and you want issues filed for each test failure
- You have a run ID or run URL and want a summary of what failed
- You want to automate triage of CI test results

## Steps

### Step 1: Resolve the Run ID

If the input looks like a URL (contains `https://`), extract the numeric run ID from it.
The run ID is the number at the end of a URL like:
`https://github.com/<owner>/<repo>/actions/runs/<run-id>`

### Step 2: Fetch the Workflow Run

Use the GitHub actions tool to fetch details about the workflow run:
- Get the run's status, conclusion, and name
- Get the run's jobs and their conclusions

### Step 3: Identify Failures

For each failed job in the run:
- Fetch the job details including step names and conclusions
- Note which steps failed and any available error messages

### Step 4: Fetch Test Artifacts

Check if the run has uploaded test result artifacts (e.g., JUnit XML files, test reports).
If artifacts are available, download and inspect them for:
- Failed test names and error messages
- Test file locations and line numbers
- Stack traces or assertion details

### Step 5: Create Issues for Failures

For each distinct test failure found, create a GitHub issue with:
- **Title**: `Test failure: <test name> in <job name>`
- **Body** following this template:

```markdown
## Failed Test

- **Workflow Run**: [<run-name> #<run-id>](https://github.com/<owner>/<repo>/actions/runs/<run-id>)
- **Job**: <job-name>
- **Test**: <test-name>
- **Status**: Failed

## Error

<error message or assertion failure>

## Details

<stack trace, location (file:line), or step output if available>

## Steps to Reproduce

1. Trigger the `<workflow-name>` workflow or wait for the next scheduled run
2. Check job `<job-name>` in the run results
```

### Step 6: Summarize

After processing all failures, provide a summary:
- Total jobs in the run
- Number of failed jobs
- Number of issues created
- Links to each created issue

## Error Handling

| Situation | Action |
|-----------|--------|
| Run is still in progress | Report status and stop — do not analyze incomplete runs |
| Run succeeded with no failures | Report success and create no issues |
| Same test fails in multiple jobs | Create one issue and mention all affected jobs |
| More than 10 failures | Create 10 issues and note remaining failures in a summary comment on the last issue |
| `bug` or `test-failure` labels missing | Create issues without labels and note the missing labels |
