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

Run ID or URL: `${{ inputs.run-id-or-url }}`

{{#runtime-import .github/skills/analyze-test-run/SKILL.md}}
