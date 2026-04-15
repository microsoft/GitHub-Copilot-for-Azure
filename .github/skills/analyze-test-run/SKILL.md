---
name: analyze-test-run
description: "Analyze a GitHub Actions integration test run and produce a skill invocation report with failure root-cause issues. TRIGGERS: analyze test run, skill invocation rate, test run report, compare test runs, skill invocation summary, test failure analysis, run report, test results, action run report"
license: MIT
metadata:
  author: Microsoft
  version: "1.0.6"
---

# Analyze Test Run

Downloads artifacts from a GitHub Actions integration test run, generates a summarized skill invocation report, and files GitHub issues for each test failure with root-cause analysis.

## When to Use

- Summarize results of a GitHub Actions integration test run
- Calculate skill invocation rates for the skill under test
- For azure-deploy tests: track the full deployment chain (azure-prepare → azure-validate → azure-deploy)
- Compare skill invocation across two runs
- File issues for test failures with root-cause context

## Input

| Parameter | Required | Description |
|-----------|----------|-------------|
| **Run ID or URL** | Yes | GitHub Actions run ID (e.g. `22373768875`) or full URL |
| **Comparison Run** | No | Second run ID/URL for side-by-side comparison |

## MCP Tools

All tools use `owner: "microsoft"` and `repo: "GitHub-Copilot-for-Azure"` as fixed parameters. `method` selects the operation within the tool.

| Tool | `method` | Key Parameter | Purpose |
|------|----------|---------------|---------|
| `actions_get` | `get_workflow_run` | `resource_id`: run ID | Fetch run status and metadata |
| `actions_list` | `list_workflow_run_artifacts` | `resource_id`: run ID | List all artifacts for a run |
| `actions_get` | `download_workflow_run_artifact` | `resource_id`: artifact ID | Get a temporary download URL for an artifact ZIP |
| `get_job_logs` | — | `run_id` + `failed_only: true` | Retrieve job logs when artifact content is inaccessible |
| `search_issues` | — | `query`: search string | Find existing open issues before creating new ones |
| `create_issue` | — | `title`, `body`, `labels`, `assignees` | File a new GitHub issue for a test failure |

## Workflow

### Phase 1 — Download & Parse

1. Extract the numeric run ID from the input (strip URL prefix if needed)
2. Fetch run metadata using the MCP `actions_get` tool:
   ```javascript
   actions_get({ method: "get_workflow_run", owner: "microsoft", repo: "GitHub-Copilot-for-Azure", resource_id: "<run-id>" })
   ```
3. List artifacts using the MCP `actions_list` tool, then download each relevant artifact:
   ```javascript
   // List artifacts
   actions_list({ method: "list_workflow_run_artifacts", owner: "microsoft", repo: "GitHub-Copilot-for-Azure", resource_id: "<run-id>" })
   // Download individual artifacts by ID
   actions_get({ method: "download_workflow_run_artifact", owner: "microsoft", repo: "GitHub-Copilot-for-Azure", resource_id: "<artifact-id>" })
   ```
   The download returns a temporary URL. Fetch the ZIP archive from that URL and extract it locally. If the environment restricts outbound HTTP (e.g. AWF sandbox), record in the analysis report that artifact content was unavailable and fall back to job logs via the `get_job_logs` MCP tool.

4. Locate these files in the downloaded artifacts:
   - `junit.xml` — test pass/fail/skip/error results
   - `*-SKILL-REPORT.md` — generated skill report with per-test details
   - `agent-metadata-*.md` files — raw agent session logs per test

   > ⚠️ **Note:** If artifact ZIP files cannot be downloaded due to network restrictions, or if downloaded files cannot be extracted, use the `get_job_logs` MCP tool to identify test failures and produce a best-effort analysis from whatever data is accessible.

### Phase 2 — Build Summary Report

Produce a markdown report with four sections. See [report-format.md](references/report-format.md) for the exact template.

**Section 1 — Test Results Overview**

Parse `junit.xml` to build:

| Metric | Value |
|--------|-------|
| Total tests | count from `<testsuites tests=…>` |
| Executed | total − skipped |
| Skipped | count of `<skipped/>` elements |
| Passed | executed − failures − errors |
| Failed | count of `<failure>` elements |
| Test Pass Rate | passed / executed as % |

Include a per-test table with name, duration (from `time` attribute, convert seconds to `Xm Ys`), and Pass/Fail result.

**Section 2 — Skill Invocation Rate**

Read the SKILL-REPORT.md "Per-Test Case Results" sections. For each executed test determine whether the skill under test was invoked.

The skills to track depend on which integration test suite the run belongs to:

**azure-deploy integration tests** — track the full deployment chain:

| Skill | How to detect |
|-------|---------------|
| `azure-prepare` | Mentioned as invoked in the narrative or agent-metadata |
| `azure-validate` | Mentioned as invoked in the narrative or agent-metadata |
| `azure-deploy` | Mentioned as invoked in the narrative or agent-metadata |

Build a per-test invocation matrix (Yes/No for each skill) and compute rates:

| Skill | Invocation Rate |
|-------|----------------|
| azure-deploy | X% (n/total) |
| azure-prepare | X% (n/total) |
| azure-validate | X% (n/total) |
| Full skill chain (P→V→D) | X% (n/total) |

> The azure-deploy integration tests exercise the full deployment workflow where the agent is expected to invoke azure-prepare, azure-validate, and azure-deploy in sequence. This three-skill chain tracking is **specific to azure-deploy tests only**.

**All other integration tests** — track only the skill under test:

| Skill | Invocation Rate |
|-------|----------------|
| {skill-under-test} | X% (n/total) |

For non-deploy tests (e.g. azure-prepare, azure-ai, azure-kusto), only track whether the primary skill under test was invoked. Do not include azure-prepare/azure-validate/azure-deploy chain columns.

**Section 3 — Report Confidence & Pass Rate**

Extract from SKILL-REPORT.md:
- Skill Invocation Success Rate (from the report's statistics section)
- Overall Test Pass Rate (from the report's statistics section)
- Average Confidence (from the report's statistics section)

**Section 4 — Comparison** (only when a second run is provided)

Repeat Phase 1–3 for the second run, then produce a side-by-side delta table. See [report-format.md](references/report-format.md) § Comparison.

### Phase 3 — File Issues for Failures

For every test with a `<failure>` element in `junit.xml`:

1. Read the failure message and file:line from the XML
2. Read the actual line of code from the test file at that location
3. Read the `agent-metadata-*.md` for that test from the artifacts
4. Read the corresponding section in the SKILL-REPORT.md for context on what the agent did
5. Determine root cause category:
   - **Skill not invoked** — agent bypassed skills and used manual commands
   - **Deployment failure** — infrastructure or RBAC error during deployment
   - **Timeout** — test exceeded time limit
   - **Assertion mismatch** — expected files/links not found
   - **Quota exhaustion** — Azure region quota prevented deployment
6. Search for existing open issue before creating a new one using the `search_issues` MCP tool:
   ```javascript
   search_issues({
     owner: "microsoft", repo: "GitHub-Copilot-for-Azure",
     query: "Integration test failure: {skill} in:title is:open"
   })
   ```
   Match criteria: an open issue whose title and body describe a similar problem. If a match is found, skip issue creation for this failure and note the existing issue number(s) in the summary report.
7. If no existing issue was found, create a GitHub issue using the `create_issue` MCP tool, assign the label with the name of the skill, and assign it to the code owners listed in .github/CODEOWNERS file based on which skill it is for:

```javascript
create_issue({
  owner: "microsoft", repo: "GitHub-Copilot-for-Azure",
  title: "Integration test failure: <skill> – <keywords> [<root-cause-category>]",
  labels: ["bug", "integration-test", "test-failure", "<skill>"],
  body: "<body>",
  assignees: ["<codeowners>"]
})
```

   **Title format:** `Integration test failure: {skill} – {keywords} [{root-cause-category}]`
   - `{keywords}`: 2-4 words from the test name — app type (function app, static web app) + IaC type (Terraform, Bicep) + trigger if relevant
   - `{root-cause-category}`: one of the categories from step 5 in brackets

Issue body template — see [issue-template.md](references/issue-template.md).

> ⚠️ **Note:** Do NOT include the Error Details (JUnit XML) or Agent Metadata sections in the issue body. Keep issues concise with the diagnosis, prompt context, skill report context, and environment sections only.
> ⚠️ **Note:** Do NOT create issues for skill invocation test failures.

> For azure-deploy integration tests, include an "azure-deploy Skill Invocation" section showing whether azure-deploy was invoked (Yes/No), with a note that the full chain is azure-prepare → azure-validate → azure-deploy. For all other integration tests, include a "{skill} Skill Invocation" section showing only whether the primary skill under test was invoked.

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `no artifacts found` | Run has no uploadable reports | Verify the run completed the "Export report" step |
| `HTTP 404` on `actions_get` | Invalid run ID or no access | Check the run ID and ensure the MCP token has repo access |
| `rate limit exceeded` | Too many GitHub API calls | Wait and retry; reduce concurrent MCP tool calls |
| Artifact ZIP download blocked | AWF sandbox restricts outbound HTTP to blob storage | Use `get_job_logs` MCP tool to get failure details from job logs; produce best-effort analysis from metadata |

## References

- [report-format.md](references/report-format.md) — Output report template
- [issue-template.md](references/issue-template.md) — GitHub issue body template
