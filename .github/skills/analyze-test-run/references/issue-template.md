# Issue Template

Use this template for every GitHub issue created for a test failure.

## Issue Title

```
Integration test failure: {skill} – {keywords} [{root-cause-category}]
```

### Title Construction

| Component | Description | Example |
|-----------|-------------|--------|
| `{skill}` | The skill under test | `azure-deploy` |
| `{keywords}` | 2-4 keywords extracted from the test name — app type + IaC type | `function app Terraform`, `function app Bicep`, `static web app` |
| `{root-cause-category}` | Root cause in brackets | `Skill not invoked`, `Timeout`, `Deployment failure` |

**Keyword extraction rules:**
- Include the app/service type: `function app`, `static web app`, `container app`, `URL shortener`
- Include IaC type if specified: `Terraform`, `Bicep`
- Include trigger type if relevant: `Service Bus trigger`, `Event Grid trigger`
- Omit filler words like "creates", "deploys", "with", "using", "infrastructure"
- Keep to 2-4 meaningful keywords

**Examples:**
- `Integration test failure: azure-deploy – function app Terraform [Timeout]`
- `Integration test failure: azure-deploy – event-driven function app [Skill not invoked]`
- `Integration test failure: azure-deploy – function app Service Bus Terraform [Deployment failure]`
- `Integration test failure: azure-prepare – static web app Bicep [Assertion mismatch]`

## Labels

```
bug, integration-test
```

## Issue Body

````markdown
## Prompt

```
{the prompt string from the test}
```

## Summary

**Run:** [{run-name} #{run-number}]({run-url})
**Test:** `{full-test-name}`
**Result:** {Fail / Timeout}
**Duration:** {Xm Ys}

## Root Cause Category

<!-- One of: Skill not invoked, Deployment failure, Timeout, Assertion mismatch, Quota exhaustion -->
**{category}**

## Diagnosis

### What was expected
{Describe what the test asserts — e.g., "expects deploy links in assistant output", "expects .bicep files in workspace"}

### What actually happened
{Describe the agent's actual behavior based on agent-metadata — e.g., "agent manually ran azd up instead of invoking azure-deploy skill", "deployment timed out after 30 minutes"}

### Why it failed
{1-2 sentences root cause — e.g., "The agent did not recognize the prompt as a skill-triggering intent and fell back to manual commands. No deploy links were produced because the deployment hit RBAC errors."}

### Suggested fix
{One of:}
- Update skill triggers/description to better match this prompt pattern
- Update test assertions or timeout
- Fix RBAC/quota pre-flight checks in skill
- Investigate model behavior (agent bypassing skill)

## {skill} Skill Invocation

<!-- For azure-deploy integration tests, show the deploy skill status with a note about the full chain -->
<!-- For all other integration tests, show only the primary skill under test -->

### azure-deploy tests

| Skill | Invoked |
|-------|---------|
| **azure-deploy** | **Yes** / No |

> In azure-deploy integration tests, the full skill chain is azure-prepare → azure-validate → azure-deploy. {Describe whether the full chain was invoked or which skills were bypassed.}

### All other integration tests

| Skill | Invoked |
|-------|---------|
| **{skill-under-test}** | **Yes** / No |

## Skill Report Context

<details>
<summary>Per-test section from SKILL-REPORT.md (click to expand)</summary>

{PASTE THE RELEVANT PER-TEST SECTION FROM THE SKILL-REPORT HERE}

</details>

## Environment

- **Runner OS:** ubuntu-latest
- **Node.js:** (from workflow)
- **Model:** claude-sonnet-4.5 (or as overridden)
- **Run URL:** {run-url}
- **Commit:** {commit-sha}
````

## Rules

- One issue per failed test. Do not batch multiple failures into one issue.
- If multiple failures share the same root cause, note this in each issue body with a cross-reference.
- Do NOT include Error Details (JUnit XML) or Agent Metadata sections — keep issues concise.
- For azure-deploy integration tests, include the skill invocation section showing azure-deploy status and note the full chain (azure-prepare → azure-validate → azure-deploy).
- For all other integration tests, include a skill invocation section showing only the primary skill under test.
