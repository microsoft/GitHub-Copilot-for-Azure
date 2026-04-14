---
name: analyze-skill-issues
description: "Query the integration-test storage account to find why a specific skill's tests are failing. Reads blob-stored test result files and surfaces error details. TRIGGERS: why is skill failing, skill test failures, debug skill tests, skill failing tests, analyze skill failures, why are tests failing for skill, skill test errors, investigate skill issues. DO NOT USE FOR: analyzing a GitHub Actions run report or comparing test runs across runs (use analyze-test-run)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Analyze Skill Issues

Queries the `strdashboarddevveobvk` Azure Storage account that stores all integration test results and retrieves error details for a given skill.

## Quick Reference

| Property | Value |
|----------|-------|
| Storage account | `strdashboarddevveobvk` |
| Container | `integration-reports` |
| Blob path pattern | `{date}/{run_id}/{skill_name}/[{test_name}/]<file>` — see [Blob Path Layout](references/blob-structure.md#blob-path-layout) |
| **Blob discovery** | `mcp_azure_mcp_storage_blob_get` — list blobs to find the right paths |
| **Blob content download** | `az storage blob download ... --file "$env:TEMP\<filename>"` — local path reported in summary |
| Best for | Diagnosing why a skill's integration tests are failing |

> **TOOL USAGE — MANDATORY:** Use `mcp_azure_mcp_storage_blob_get` to enumerate and identify the correct blob paths. Then use `az storage blob download` to download and read the content of those blobs. These tools serve different purposes and are both always required — they are not alternatives.

## When to Use

- User asks why a skill's tests are failing
- User asks to debug or investigate a skill's recent test failures
- User wants to see errors from integration test runs for a specific skill
- User asks what errors or exceptions caused skill test failures

## Skill Name Mapping

Resolve the user's skill name to its canonical directory name using the [Skill Name Mapping](references/blob-structure.md#skill-name-mapping).

## MCP Tools

MCP tools are used exclusively for **blob discovery** — finding which blob paths exist. All calls require `account: "strdashboarddevveobvk"` and `container: "integration-reports"`. Use `az storage blob download` (see Phase 2) to read blob content.

| Tool | Purpose | Key parameters |
|------|---------|----------------|
| `mcp_azure_mcp_storage_blob_get` | List blob names and metadata (does **not** return file content) | `account`, `container`; omit `blob` to list all |
| `mcp_azure_mcp_storage_blob_container_get` | Verify the container exists | `account`, `container` |

## Output Requirements

Every response **MUST** include all of the following. Do not omit any item:

- [ ] Root cause explanation of why the skill has low confidence or failing tests
- [ ] Per-test breakdown (test name, pass/fail, confidence or error)
- [ ] **Referenced Files** section listing every downloaded file as a `vscode://file/` link

> ⚠️ **MANDATORY:** The Referenced Files section is not optional. Always resolve `$env:TEMP` to the actual path (run `echo $env:TEMP`) and include a clickable link for every file downloaded. If this section is missing from your response, the output is incomplete.

---

## Workflow

> **TOOL RESPONSIBILITIES:** `mcp_azure_mcp_storage_blob_get` is used exclusively for **blob discovery** (listing available paths). `az storage blob download` is used exclusively for **reading blob content**. Both are always required.

### Phase 1 — Enumerate Recent Blobs for the Skill

1. Resolve the skill name using the [Skill Name Mapping](references/blob-structure.md#skill-name-mapping).

2. List all blobs in the container to discover available date/run paths:
   ```javascript
   mcp_azure_mcp_storage_blob_get({ account: "strdashboarddevveobvk", container: "integration-reports" })
   ```
   This returns a flat list of all blob names. Filter for entries that:
   - Start with a date string matching `yyyy-mm-dd` within the last **7 days**
   - Contain `/{skill_name}/` in the path
   - Do **not** end with `token-usage.json` or `agent-metadata.json`

3. Group the matching blobs by date (descending) and by run ID (the second path segment).

4. **Limit scope:** If the user specified a date in their prompt, use only that date. Otherwise, take the **3 most recent dates** from the filtered results and discard the rest. Do not process more than 3 dates.

### Phase 2 — Read Test Result Files

For each matching blob path identified in Phase 1, download it to a local temp file and read its content:

```powershell
az storage blob download --account-name strdashboarddevveobvk --container-name integration-reports `
  --name "<full-blob-path>" --file "$env:TEMP\<filename>" --auth-mode login --no-progress
```

Use just the last path segment as `<filename>`.

> ⚠️ **REQUIRED:** After each download, immediately append the resolved local path to your working list of referenced files. Run `echo $env:TEMP` once to resolve the actual temp directory. Every downloaded file **must** appear in the Referenced Files section of your final response — this is not optional.

**Priority order for files to read** (most useful first):

1. Any `*.json` files that are NOT `token-usage.json` or `agent-metadata.json` — these contain test pass/fail results and error messages
2. `*-SKILL-REPORT.md` or `*report*.json` files — contain skill invocation details and test narratives
3. `junit.xml` blobs if present — contain structured test failure messages

### Phase 3 — Extract Failure Information

For each test result file, extract:

- **Test name** — the test case identifier
- **Status** — passed / failed / error / skipped
- **Error message** — the exception or assertion failure text
- **Stack trace** — if present in the file
- **Date and run ID** — for traceability

Look specifically for fields such as:
- `"status": "failed"` or `"passed": false`
- `"error"`, `"errorMessage"`, `"failureMessage"`, `"message"` JSON keys
- `<failure>` or `<error>` XML elements in JUnit format
- Any `Error:` or `FAIL` prefixed lines in text reports

### Phase 4 — Summarize Failures

Present the findings grouped by test name:

```
## Failures for <skill-name> — <date> (Run: <run_id>)

### <test-name>
- **Status:** failed
- **Error:** <error message>
- **Detail:** <stack trace or additional context, truncated to ~10 lines>

### <test-name-2>
...
```

At the end of the summary, include a **Referenced Files** section listing every file that was downloaded as a clickable VS Code link. Resolve `$env:TEMP` to the actual Windows temp path (e.g. `C:\Users\<user>\AppData\Local\Temp`) and format each entry as a markdown link using the `vscode://file/` URI scheme with forward slashes:

```
## Referenced Files
- [<filename1>](vscode://file/C:/Users/<user>/AppData/Local/Temp/<filename1>)
- [<filename2>](vscode://file/C:/Users/<user>/AppData/Local/Temp/<filename2>)
- ...
```

To resolve the actual temp path, run `echo $env:TEMP` in the terminal before constructing the links.

Include:
- Total failing tests vs. total tests found
- Most recent run date analyzed
- Common error patterns across multiple tests (e.g., all failing due to auth, quota, timeout)

**Date iteration rule:** Process the most recent date first. Only proceed to the next date if the current date yields zero failures. Stop as soon as failures are found — do not process all 3 dates if the first one has results.

See [Blob Path Layout](references/blob-structure.md#blob-path-layout) for the full container tree structure.

## Error Handling

| Error | Cause | Remediation |
|-------|-------|-------------|
| No blobs found for skill | Skill has not run tests recently, or name is wrong | Verify skill name using the mapping table; tests run Tue–Sat on a schedule |
| Blob list is empty | Container access issue or wrong account | Confirm `account: "strdashboarddevveobvk"` and that the user has Azure CLI credentials |
| Blob content not readable | File is binary or corrupted | Skip that blob and try adjacent blobs for the same test |
| All tests show as skipped | The skill's test schedule hasn't run yet today | Check `tests/skills.json` for the skill's schedule and check a prior day's date prefix |
| `token-usage.json` / `agent-metadata.json` only | Correct path but no result files | The test run may have crashed before writing results; check the run ID in GitHub Actions |
