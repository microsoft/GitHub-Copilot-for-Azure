---
name: analyze-test-run
description: "Analyze a GitHub Actions integration test run and produce a skill invocation report with failure root-cause issues. TRIGGERS: analyze test run, skill invocation rate, test run report, compare test runs, skill invocation summary, test failure analysis, run report, test results, action run report"
license: MIT
metadata:
  author: Microsoft
  version: "1.0.4"
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

## Workflow

### Phase 1 — Download & Parse

1. Extract the numeric run ID from the input (strip URL prefix if needed)
2. Fetch run metadata:
   Use `github` tool to list the Action run with the given `<run-id>` in the "microsoft/GitHub-Copilot-for-Azure" repo. Get its jobs, status, conclusion and name. 
3. Download this run's artifacts to a temp directory:
   Use `github` tool to download this run's artifacts to a local directory "$TMPDIR/gh-run-<run-id>".
4. Locate these files in the downloaded artifacts:
   - `junit.xml` — test pass/fail/skip/error results
   - `*-SKILL-REPORT.md` — generated skill report with per-test details
   - `agent-metadata-*.md` files — raw agent session logs per test

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

For Skill Invocation Success Rate that is available and is less than 80%, create a GitHub issue, assign the label with the same name as the skill, and assign it to the code owners listed in .github/CODEOWNERS file based on which skill it is for:

Use `create_issue` tool to create this issue.
```
create_issue:
   title: "Integration test failure: <skill> – skill-invocation" 
   labels: ["bug,integration-test,test-failure,skill-invocation,<skill>]
   assignees: [<codeowners-in-codeowners-file>]
   body: "<body>"
```

Issue body template — see [issue-template.md](references/issue-template.md).

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
6. Search for existing open issue before creating a new one:
   Use `github` tool to list issues in the "microsoft/GitHub-Copilot-for-Azure" repo with a given title pattern "Integration test failure: {skill} in:title". Focus on their issue number, title and body.

   Match criteria: an open issue whose title and body describe a similar problem. If a match is found, skip issue creation for this failure and note the existing issue number(s) in the summary report.
7. If no existing issue was found, create a GitHub issue, assign the label with the name of the skill, and assign it to the code owners listed in .github/CODEOWNERS file based on which skill it is for:

Use `create_issue` tool to create this issue.
```
create_issue:
   title: "Integration test failure: <skill> – <keywords> [<root-cause-category>]" 
   labels: ["bug,integration-test,test-failure,<skill>]
   assignees: [<codeowners-in-codeowners-file>]
   body: "<body>"
```

   **Title format:** `Integration test failure: {skill} – {keywords} [{root-cause-category}]`
   - `{keywords}`: 2-4 words from the test name — app type (function app, static web app) + IaC type (Terraform, Bicep) + trigger if relevant
   - `{root-cause-category}`: one of the categories from step 5 in brackets

Issue body template — see [issue-template.md](references/issue-template.md).

> ⚠️ **Note:** Do NOT include the Error Details (JUnit XML) or Agent Metadata sections in the issue body. Keep issues concise with the diagnosis, prompt context, skill report context, and environment sections only.

> For azure-deploy integration tests, include an "azure-deploy Skill Invocation" section showing whether azure-deploy was invoked (Yes/No), with a note that the full chain is azure-prepare → azure-validate → azure-deploy. For all other integration tests, include a "{skill} Skill Invocation" section showing only whether the primary skill under test was invoked.

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `gh: not authenticated` | GitHub CLI not authenticated | This workflow cannot authenticate to GH CLI with necessary permission by design. Use your Agent tools instead. |
| `no artifacts found` | Run has no uploadable reports | Verify the run completed the "Export report" step |
| `rate limit exceeded` | Too many GitHub API calls | Wait and retry, or use `--limit` on searches |

## References

- [report-format.md](references/report-format.md) — Output report template
- [issue-template.md](references/issue-template.md) — GitHub issue body template
