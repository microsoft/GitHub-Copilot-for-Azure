# Readiness Gate — Step 4

## Write Artifacts

⛔ **You MUST read [`prereq-artifacts.md`](prereq-artifacts.md)** for the complete artifact write procedures (prereq-output.json, context.json, readiness-report.md) and phase exit checklist.

---

## Overall Health Gate

**Overall health gate:** Compute `overallHealth` from component verdicts:
- ALL components ✅ PASS → `"ready"`
- Any ⚠️ WARN but no ❌ FAIL → `"readyWithCaveats"`
- ANY component has ❌ FAIL verdict → `"blocked"`

Set the value in `prereq-output.json`. The gate presented depends on the **severity tier** of the finding:

> **Severity tiers:**
>
> | Tier | Icon | When |
> |------|------|------|
> | **Hard Halt** | 🛑 | App is designed to be exploited (security training tool). Nothing to fix. |
> | **Major Migration** | 🔶 | EOL runtime/framework upgrade, archived+EOL repo, or >5-file scope. Agent attempts but warns about scope. |
> | **Critical** | ❌ | Deployment will fail. Agent can fix (≤5 files, config-level). |
> | **Recommended Fix** | 🔧 | App deploys but has quality/security issues. |
> | **Warning** | ⚠️ | Informational. No deployment impact. |
>
> User choices per tier are defined in [Batch-Then-Approve Flow](#batch-then-approve-flow) step 4.

---

## Critical Readiness Gate

⛔ **Classify findings using the verdict tables and detection rules from the reference files you already read in Step 3.** Do NOT rely on the tier table above — it defines the gate flow only, not what produces each verdict. If a file has been evicted from context, re-read it.

| Tiers | Reference file | Sections |
|-------|---------------|----------|
| 🛑 🔶 🔧 ⚠️ | [`dependency-compatibility.md`](dependency-compatibility.md) | Intentionally Vulnerable (🛑), EOL Runtimes/Frameworks (🔶/❌), Archived Repos (🔶), Cloud SDK swaps (🔧), Platform/DB/Dockerfile (⚠️) |
| ❌ 🔧 | [`completeness-check.md`](completeness-check.md) | Entry Point, Dependency Manifest, Configuration (hardcoded secrets) |
| ❌ | [`build-check.md`](build-check.md) | Import → Manifest Cross-Check |
---

## Batch-Then-Approve Flow

> ⛔ **Sequence: scan → present → ask → fix → revalidate.** ALWAYS, even for a single blocker.
>
> 1. **Detect ALL issues first** — full 3-axis scan, all components. Don't stop at the first blocker.
> 2. **Present ALL findings at once** — lead with a summary line (e.g., "🔍 Readiness: 2 critical, 1 recommended fix, 3 warnings"), then list grouped: 🛑 → 🔶 → ❌ → 🔧 → ⚠️.
> 3. **Fix plan** — for ❌, 🔧, and 🔶 items: describe WHAT you'd change and WHY. For 🔶, include scope estimate. Never include ⚠️ or 🛑 in the fix plan. Blocker count must match fixes count exactly.
> 4. **User choice** — based on highest-severity finding. ⛔ **"Fix issues" is ALWAYS the first option when blockers exist.**
>    - **🛑 present:** Pipeline stops. Present the findings, suggest local alternatives (e.g., `docker compose up`), and hand off — let the user decide what to do next. No formal gate prompt needed.
>    - **🔶 present (no 🛑):** "Attempt migration" / "Cancel" / "Continue as-is (not recommended)".
>    - **❌ or 🔧 only:** "Fix issues" / "Continue with known risks" / "Cancel".
> 5. **After approval** → apply fixes per [remediation-protocol.md](remediation-protocol.md). ⛔ Static verification = reading files and grepping — NOT `npm install` or `npm test`.
>
> ⛔ **Two-gate rule:** Step 2 (intent) approval ≠ Step 3 (readiness) gate. If the user agreed to fix issues during intent gathering, that is a *strategy* approval — NOT a *fix execution* approval. You MUST still present the fix prompt here.

---

## Fast-Track

> 💡 **Fast-track:** Single-component + no DB + no auth + **no Dockerfile** → set `fastTrackEligible: true` in `prereq-output.json`. A Dockerfile means the prepare phase must evaluate the Dockerfile routing decision tree (SWA vs Container Apps vs App Service B1+) — that is NOT fast-track.

---

## Present Findings (Step 5)

⛔ Do NOT skip this step — the user must see scan results before the pipeline continues. Show verdicts per component grouped by severity: ❌ FAIL first (with fix suggestions), then ⚠️ WARN, then ✅ PASS. Writing artifacts without presenting findings to the user is a violation. Answer FAQ-style questions as informational responses during presentation.

**Severity tiers:** ⚠️ WARN findings with data-loss risk (e.g., SQLite on App Service with no persistent disk, in-memory sessions, local file storage) require explicit user acknowledgment before proceeding. Other ⚠️ WARN findings are informational and non-blocking.

> ⛔ **ARTIFACT CHECKPOINT.** After presenting findings to the user, VERIFY all 3 artifacts exist on disk: (1) `context.json`, (2) `prereq-output.json`, (3) `readiness-report.md`. If ANY are missing, write them NOW before proceeding to Step 6 or Step 8. Do NOT exit the prereq phase without all 3 artifacts confirmed.
