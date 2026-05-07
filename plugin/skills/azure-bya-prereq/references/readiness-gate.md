# Readiness Gate — Step 4

## Write Artifacts

⛔ **You MUST read [`prereq-artifacts.md`](prereq-artifacts.md) using the `view` tool** for the complete artifact write procedures (prereq-output.json, context.json, readiness-report.md) and phase exit checklist.

---

## Overall Health Gate

**Overall health gate:** Compute `overallHealth` from component verdicts: if ANY component has ❌ FAIL verdict → set `overallHealth: "blocked"` in `prereq-output.json`. The gate presented depends on the **severity tier** of the finding:

> **Severity tiers — three levels, no ambiguity:**
>
> | Tier | Icon | Meaning | Examples | User choice |
> |------|------|---------|----------|-------------|
> | **Critical** | ❌ | Deployment will visibly fail or produce a broken result. Must fix before proceeding. | Missing entry point, web app with no port binding | No skip — fix required or cancel. |
> | **Highly Recommended Fix** | 🔧 | App deploys but has real issues that affect quality or security. Prereq should offer to fix. | Broken static asset references, missing dependency manifest, hardcoded secrets in source code | Fix / Continue with known risks / Cancel. |
> | **Warning** | ⚠️ | Informational, non-consequential. Does not affect deployment outcome. | No health endpoint, sparse README, no `.dockerignore`, no `engines` field | Non-blocking — noted in findings only. |

---

## Critical Readiness Gate

> ⛔ **Critical readiness gate — automatic FAIL verdicts.** The following MUST produce ❌ FAIL regardless of other axis results. These are **hard blockers** — the app WILL fail or look broken on Azure.
> 1. **App crashes on startup** — missing entry point, unresolved imports (e.g., `require('db')` when `db.js` doesn't exist), syntax errors in main file.
> 2. **End-of-life or unsupported runtime** — .NET Framework 4.x, ASP.NET Core 2.1, Python 2.x, Node.js < 18, Java < 11. These cannot be deployed safely to current Azure services.
> 3. **Intentionally vulnerable applications** — any app whose README, description, or project metadata contains phrases like "deliberately vulnerable", "intentionally insecure", "security training", "penetration testing practice", or "exploit this application." These must NOT be deployed to Azure.
>
> **🔧 Highly Recommended Fix — enumerated list.** The following produce ❌ FAIL but are NOT hard blockers — the app deploys but has real quality or security issues. The user may choose to skip these.
> 1. **Broken static asset references** — CSS, JS, or image files referenced in HTML (`<link href>`, `<script src>`, `<img src>`) that don't exist on disk. The deployed site renders without styles or scripts — users see a broken page. Prereq should offer to fix (create missing files or correct references).
> 2. **Missing dependency manifest** (non-static app) — no `package.json`, `requirements.txt`, `*.csproj`, etc. The app may fail to install dependencies on Azure but doesn't crash immediately at startup.
> 3. **Hardcoded secrets in source** — API keys, connection strings, or passwords in source files. The app runs but has a security risk. Prereq should suggest moving secrets to environment variables or Key Vault.
> 4. **Dockerfile EXPOSE port mismatch** — `EXPOSE` port doesn't match app listening port. Causes 502 after container deploy but is fixable without code changes.
> 5. **Hard dependencies on non-Azure cloud SDKs** — `aws-sdk`, `@aws-sdk/*`, `boto3`, `google-cloud-*`, `AWSSDK.*` NuGet packages, or any import that requires a non-Azure cloud provider's runtime. Flag each dependency, map it to the Azure equivalent (e.g., `google-cloud-pubsub` → Azure Service Bus, `@aws-sdk/client-dynamodb` → Cosmos DB, `google-cloud-tasks` → Azure Queue Storage, `boto3 s3` → Azure Blob Storage), and set verdict to `CLOUD_SDK_DEPENDENCY` (🔧 Highly Recommended Fix). Include the mapping in `prereq-output.json.cloudSdkSwaps[]` so scaffold can perform inline SDK swaps. The app deploys with code changes — NOT a hard blocker.
>
> See [completeness-check.md § Verdict → Severity Tier Mapping](completeness-check.md) for the full check-by-check mapping.

---

## Batch-Then-Approve Flow

> ⛔ **Batch-then-approve flow — ALWAYS, even for a single blocker:**
>
> This flow is MANDATORY regardless of how many blockers exist. Do NOT shortcut to fixing when there's "only one issue." The sequence is always: **scan → present → ask → fix → revalidate.**
>
> 1. **Detect ALL issues first** — complete the full 3-axis scan for all components before presenting. Do NOT stop at the first blocker.
> 2. **Present ALL findings at once** — grouped summary: **"🔍 Readiness: N blockers, N warnings"** — ⛔ blockers first, then ⚠️ warnings.
> 3. **Include a fix plan** — for each blocker, describe WHAT you would change and WHY.
>
>    ⛔ **Fix plan covers ONLY ❌ Critical and 🔧 Highly Recommended items — NEVER ⚠️ warnings.** Blocker count must match fixes count exactly.
> 4. **Wait for user approval** — present choices in this EXACT order:
>
>    ⛔ **Choice ordering — fix is ALWAYS first when blockers exist:**
>    1. **Fix issues** (recommended — default)
>    2. **Continue with warnings acknowledged**
>    3. **Override / deploy as-is**
>    4. **Other (user input)**
>
>    ⛔ **NEVER present "deploy as-is" or "continue" before "fix" when blockers are present.** The fix option is ALWAYS first.
>
>    ⛔ **Two-gate rule — Step 2 approval ≠ Step 3 gate.** If the user agreed to fix issues during Step 2 (intent gathering / quick probe), that is a *strategy* approval — NOT a *fix execution* approval. You MUST still present the "Approve fixes?" prompt here even if the user previously agreed to fix. Prior approvals from other steps do NOT satisfy this gate.
>
> 5. **After approval** → apply fixes per Step 6 remediation loop (code-gen only, static verification). ⛔ Static verification = reading files and grepping — NOT `npm install` or `npm test`.

---

## Fast-Track

> 💡 **Fast-track:** Single-component + no DB + no auth + **no Dockerfile** → set `fastTrackEligible: true` in `prereq-output.json`. A Dockerfile means the prepare phase must evaluate the Dockerfile routing decision tree (SWA vs Container Apps vs App Service B1+) — that is NOT fast-track.

---

## Present Findings (Step 5)

⛔ Do NOT skip this step — the user must see scan results before the pipeline continues. Show verdicts per component grouped by severity: ❌ FAIL first (with fix suggestions), then ⚠️ WARN, then ✅ PASS. Writing artifacts without presenting findings to the user is a violation. Answer FAQ-style questions as informational responses during presentation.

**Severity tiers:** ⛔ CRITICAL findings (data loss risk — e.g., SQLite on App Service with no persistent disk, in-memory sessions, local file storage) require explicit user acknowledgment before proceeding. ⚠️ WARNING findings are informational and non-blocking.

> ⛔ **ARTIFACT CHECKPOINT.** After presenting findings to the user, VERIFY all 3 artifacts exist on disk: (1) `context.json`, (2) `prereq-output.json`, (3) `readiness-report-*.md`. If ANY are missing, write them NOW before proceeding to Step 6 or Step 8. Do NOT exit the prereq phase without all 3 artifacts confirmed.
