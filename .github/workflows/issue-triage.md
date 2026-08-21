---
name: Issue Triage
description: |
  Agentic issue triage for microsoft/GitHub-Copilot-for-Azure.
  Applies classification and routing labels, sets issue fields, and leaves a concise rationale comment.

on:
  issues:
    types: [opened, reopened]
  roles: all
  workflow_dispatch:
    inputs:
      issue_number:
        description: Issue number to triage manually.
        required: true
        type: string

# Skip the tracking issue that report-incomplete creates for this workflow.
if: github.event_name != 'issues' || !startsWith(github.event.issue.title, '[incomplete] Issue Triage')

permissions:
  copilot-requests: write
  contents: read
  issues: read

concurrency:
  group: "gh-aw-${{ github.workflow }}-${{ github.event.issue.number || inputs.issue_number || github.run_id }}"

engine: copilot

tools:
  bash: []
  github:
    toolsets: [issues, labels, repos]
    min-integrity: none
    allowed-repos: ["microsoft/github-copilot-for-azure"]

network:
  allowed:
    - github

timeout-minutes: 15

safe-outputs:
  add-comment:
    max: 1
    target: "*"
  add-labels:
    allowed:
      - bug
      - enhancement
      - assign-to-copilot
      - skills
      - integration-test
      - agentic-workflows
      - "area:docs"
      - "area:release"
      - "area:testing"
      - azure-ai
      - azure-aigateway
      - azure-cloud-migrate
      - azure-compliance
      - azure-compute
      - azure-cost
      - azure-cost-optimization
      - azure-deploy
      - azure-diagnostics
      - azure-enterprise-infra-planner
      - azure-hosted-copilot-sdk
      - azure-kubernetes
      - azure-kusto
      - azure-messaging
      - azure-prepare
      - azure-quotas
      - azure-rbac
      - azure-reliability
      - azure-resource-lookup
      - azure-resource-visualizer
      - azure-storage
      - azure-upgrade
      - azure-validate
      - entra-agent-id
      - entra-app-registration
      - microsoft-foundry
      - python-appservice-deploy
      - appinsights-instrumentation
      - airunway-aks-setup
      - telemetry
      - functions
      - vscode
      - github_actions
      - auth
      - sign-in
      - intent-detection
      - hallucination
      - too-many-tools
      - linux
      - mac
      - codespace
    max: 5
    target: "*"
  remove-labels:
    allowed: [untriaged]
    max: 1
    target: "*"
  set-issue-type:
    allowed: [Bug, Feature, Task]
    max: 1
    target: "*"
  set-issue-field:
    allowed-fields: [Priority]
    max: 1
    target: "*"
  noop:
    report-as-issue: false
  report-incomplete:
    max: 1

---

# Issue Triage

<!-- After editing run 'gh aw compile issue-triage' -->

Triage exactly one issue in **microsoft/GitHub-Copilot-for-Azure**.

Target issue: **#${{ inputs.issue_number || github.event.issue.number }}**

## Guardrails

- Process only the target issue. Never process a pull request.
- Add labels only from the approved safe-output list. Never replace or remove labels except `untriaged`.
- Never close, lock, or assign the issue.
- Preserve valid values already set by a reporter or maintainer. Do not add a second classification label or overwrite an existing Issue Type or Priority.
- Treat `bug` and `enhancement` as mutually exclusive. If the existing classification appears wrong, recommend the correction in the comment instead of changing it.
- If required labels or field values are unavailable or ambiguous, use `report-incomplete` with the missing details. Do not remove `untriaged` when triage is incomplete.

## Process

1. Fetch the target issue's full title, body, current labels, Issue Type, and Priority.
2. List the repository's available labels.
3. Classify the issue and select only labels that are directly supported by its content.
4. Read `.github/CODEOWNERS` and identify one primary owner only when the affected area is clear.
5. Apply the safe outputs described below.

## Triage outputs

### 1) Classification

Choose one dominant classification:

- `bug`: broken existing behavior, regression, crash, error, failing CI, authentication failure, or documented behavior that does not work.
- `enhancement`: a new capability or improvement to existing behavior.
- `task`: guidance, investigation, documentation, maintenance, or internal engineering work.

Add `bug` or `enhancement` only when neither classification label is present. There is no classification label for `task`.

Set a missing Issue Type from the classification:

- `bug` -> `Bug`
- `enhancement` -> `Feature`
- `task` -> `Task`

### 2) Routing labels

Add up to three routing labels in addition to a classification label:

- The exact skill label when the issue clearly concerns one skill, such as `azure-deploy`, `azure-diagnostics`, `microsoft-foundry`, or `entra-app-registration`.
- `skills` for cross-skill or general skill-system work.
- `integration-test`, `agentic-workflows`, `telemetry`, `functions`, `vscode`, `github_actions`, `area:testing`, `area:docs`, or `area:release` when directly relevant.
- A platform or problem label such as `linux`, `mac`, `codespace`, `auth`, `sign-in`, `hallucination`, or `too-many-tools` only when the issue explicitly supports it.

Skip uncertain labels and labels that do not exist.

### 3) Priority field

Set Priority only when it is missing, using the configured value exactly:

- `Urgent`: active repository-wide blocker, release blocker, security incident, or CI failure blocking broad pull request flow.
- `High`: regression, deploy/provision/auth failure, data corruption, severe customer bug, or active initiative blocker.
- `Medium`: important bug or feature gap with clear impact but no broad blocker, including contained documentation and quality work.
- `Low`: backlog idea, exploratory work, or low-urgency cleanup.

### 4) Coding agent label

Add `assign-to-copilot` only when the issue is sufficiently scoped for a coding agent to make a concrete repository change. Do not add it for support questions, incomplete reports, architectural decisions, external service problems, or work that needs credentials or live Azure access.

### 5) Owner recommendation

Recommend one primary owner in the comment, but do not assign anyone:

- Prefer a specific code owner for the affected skill or area.
- Use the repository-wide CODEOWNERS team for cross-cutting work.
- If confidence is low, state that the owner is left for maintainer review.

## Final action

When triage is complete:

1. Add the selected labels and set any missing fields.
2. Remove `untriaged` if it is present.
3. Post one concise comment with the classification reason, routing labels, Priority, Issue Type, and owner recommendation.

Do not promise a fix or timeline. Do not repeat the issue body.
