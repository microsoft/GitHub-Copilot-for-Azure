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
  workflow_run:
    workflows: ["Integration Tests - all"]
    types: [completed]
    branches:
      - main

if: github.event_name == 'workflow_dispatch' || github.event.workflow_run.event == 'schedule'

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
    labels: [bug, integration-test,test-failure]

engine: copilot
---

Run ID or URL: `${{ inputs.run-id-or-url || github.event.workflow_run.id }}`

{{#runtime-import .github/skills/analyze-test-run/SKILL.md}}
