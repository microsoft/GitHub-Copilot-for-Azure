---
description: |
  Analyzes a GitHub Actions workflow run (given its run ID or URL) and creates
  GitHub issues for each failing test found in the run's artifacts and logs.

on:
  workflow_dispatch:
    inputs:
      run-id-or-url:
        description: "GitHub Actions run ID or run URL to analyze"
        required: true
        type: string

permissions:
  contents: read
  actions: read
  issues: read

network: {}

tools:
  github:
    toolsets: [actions, issues, labels]

safe-outputs:
  create-issue:
    max: 10
    labels: [bug, test-failure]

engine: copilot
---

# Analyze Test Run

You are analyzing a GitHub Actions workflow run to identify test failures and create GitHub issues for each failure.

## Input

The user has provided a run ID or URL: `${{ inputs.run-id-or-url }}`

## Your Task

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

```
## Failed Test

- **Workflow Run**: [<run-name> #<run-id>](https://github.com/${{ github.repository }}/actions/runs/<run-id>)
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

## Important Notes

- If the run is still in progress, report that and stop — do not analyze incomplete runs.
- If the run succeeded with no failures, report success and create no issues.
- Deduplicate: if the same test appears to have failed in multiple jobs, create only one issue and mention all affected jobs.
- Limit issue creation to at most 10 issues. If there are more failures, note them in a final summary comment on the last issue.
- The `bug` and `test-failure` labels must exist in the repository for label assignment to succeed. If they are missing, the issues will still be created without labels.
