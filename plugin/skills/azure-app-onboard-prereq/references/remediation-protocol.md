# Remediation Protocol — Step 6

## Pre-check

> **🛑 Hard Halt?** If a 🛑 finding exists (intentionally vulnerable app), skip remediation. Set `overallHealth: "blocked"`, write artifacts, go to Step 7.
>
> **🔶 Major Migration?** If the user chose "Attempt migration," enter the loop normally. Be transparent during execution — warn that changes may need review afterward.

## Remediation Scope

> ⛔ **Fix ONLY Azure-deployment blockers.** Remediation must be scoped to issues that prevent the app from deploying to Azure:
> - Missing dependencies that cause build/startup failure
> - Missing entry point or main file
> - Startup crashes (unresolved imports, syntax errors)
> - Configuration required for Azure (port binding, env var externalization)
>
> Do NOT fix:
> - Code quality issues (null refs, memory leaks, race conditions) → `postDeployRecommendations[]`
> - Test failures → `postDeployRecommendations[]`
> - Documentation gaps → `postDeployRecommendations[]`
> - UI/UX issues → `postDeployRecommendations[]`
> - Refactoring or modernization beyond what's needed for deploy → `postDeployRecommendations[]`
>
> ⛔ **Fix plan choices must be scoped:** "Fix N deployment blockers? (Yes — fix blockers / Continue with known risks / Cancel)". NEVER offer "Fix all issues" or "Turn it into a working app."

## Remediation Loop

If any ❌ FAIL exists:
1. Present each failure with a specific fix suggestion.
2. After user fixes (manual or agent-applied per Rule 3), ⛔ **you MUST re-run the full Step 3 evaluation (all 3 axes) on the affected component(s).** This is not optional — static grep of exports is NOT sufficient. ⛔ **Re-read each reference file** — [build-check.md](build-check.md), [completeness-check.md](completeness-check.md), [deployability-check.md](deployability-check.md) — and re-evaluate. The re-scan may catch secondary issues the first scan missed.
3. ⛔ **Verify fixes via static analysis only — NEVER run terminal commands.** After creating or modifying a file to fix a blocker, verify it using ONLY this procedure:
   - ⛔ **Do NOT run `npm install`, `npm test`, `npx jest`, `node index.js`, `dotnet build`, `dotnet restore`, `dotnet test`, `pip install`, `pytest`, `go mod download`, `cargo build`, or ANY terminal command to verify.** This is the most commonly violated rule. Agents reflexively run install/test commands after applying a fix. THIS IS FORBIDDEN. Static analysis IS the verification.
   - **File exists:** Confirm the created file is on disk (you just wrote it — it is).
   - **Exports match imports:** `grep` the new file for `module.exports`, `exports.`, or `export` keywords. Then `grep` every file that imports it (found during the scan) and confirm the imported names match. Example: if a file does `const { fn1, fn2 } = require('./module')`, grep `module.js` for `fn1` and `fn2`.
   - **No syntax errors:** Read the file back and visually check for unclosed braces, missing semicolons, or obvious typos.
   - **Config values present:** If the fix adds env vars or config, confirm they appear in the file.
   This static check IS the verification. It is complete. Proceed to Step 6.4.
4. ⛔ **Re-read [SKILL.md](../SKILL.md) before applying any fix.** If you haven't read `azure-app-onboard-prereq/SKILL.md` in the current turn, re-read it before generating or applying code fixes. The remediation rules (no `npm install`, no test execution, static-only verification) are frequently violated when the skill context has been evicted. Do NOT apply fixes from memory — re-read the rules first.
5. ⛔ **After re-evaluation, you MUST print this exact line** (the integration test checks for it):
   ```
   🔄 Re-evaluation complete — ✅ N issues resolved, ❌ M remaining.
   ```
   Replace N and M with actual counts. If M = 0, the component is clear to proceed. If M > 0, loop back to step 1. Do NOT skip this output — Step 7 will reject `fixesApplied` status without it.
6. **Build-validation gate (agent-modified code only).** After re-evaluation passes (M = 0) AND the agent created or modified >2 source files, present: **"I've fixed {N} files. Want me to install dependencies, build, and run tests to verify? (Yes / Skip)"** ⛔ **You MUST present this prompt — do NOT skip it or reuse approvals from earlier steps.** If Yes: run `npm install` → `npm run build` → `npm test` (or equivalent: `pip install -e .` → `pytest`, `dotnet build` → `dotnet test`), fix errors (max 2 attempts). If Skip: proceed. ⛔ This gate applies ONLY to code the agent wrote/modified — the ABSOLUTE PROHIBITION on `npm install` still applies to unmodified existing code.
7. **Max 3 re-run cycles** — after 3 cycles, present remaining findings and stop.

## Post-Remediation Artifact Updates

> ⛔ **After ANY successful remediation, you MUST update all 3 artifacts:**
> 1. **Update `context.json`:** set `readiness.status: "fixesApplied"`, update `verdicts` to reflect post-fix state, record fixes in `fixes[]`.
> 2. **Update `prereq-output.json`:** update `overallHealth` and component `verdicts` to post-fix values.
> 3. **Append a "Post-Fix Re-evaluation" section** to the readiness report with the updated verdict table and list of fixes applied.
>
> Downstream phases read the current state from these files. If artifacts are not updated, downstream sees a blocked app even after fixes succeeded.

## Write Final State (Step 7)

> ⛔ **Components MUST be written to BOTH files.** Write detected components to `prereq-output.json.components[]` AND copy them to `context.json.components[]`. **`context.json.components[]` is the authoritative source** for downstream phases (prepare, scaffold). `prereq-output.json.components[]` is the prereq-phase snapshot at exit — downstream phases read `context.json`.

> ⛔ **`fixesApplied` requires re-evaluation evidence.** Before writing `readiness.status: "fixesApplied"`, verify you printed the `🔄 Re-evaluation complete` line from Step 6.5. If you applied a fix but did NOT re-run the full 3-axis scan, you MUST go back and run it now. Do NOT write `fixesApplied` based on static grep alone — the re-scan catches issues the original scan missed (B7).

Update `prereq-output.json` and `context.json` with final verdicts per `AppOnboardContext` in [`session-schemas.ts`](session-schemas.ts) (already loaded). Set `readiness.status` per component:
- All PASS → `ready`
- Fixes applied and **re-eval passed** (Step 6.5 printed `🔄 Re-evaluation complete — ✅ N issues resolved, ❌ 0 remaining`) → `fixesApplied`
- Unresolved FAILs → `needsFixes`

Update `context.json` phase lifecycle: append `"prereq"` to `completedPhases`, set `currentPhase` to `null`, update `lastModifiedUtc`. The orchestrator sets the next phase — prereq never decides what runs next.

> ⛔ **`overallHealth` MUST be one of:** `"ready"`, `"readyWithCaveats"`, `"blocked"`. Do NOT abbreviate or invent values (e.g., do NOT write `"caveats"` — use `"readyWithCaveats"`).

> ⛔ **`repo.lastScanCommit` is required.** Run `git rev-parse HEAD` and store the full 40-character SHA as `repo.lastScanCommit`. This is required for detecting repo changes between phases.

## Routing (Step 8)

- If entered via orchestrator (`azure-app-onboard`), return control to the orchestrator with completed artifacts. Do NOT directly invoke prepare — the orchestrator manages phase transitions.
- If entered directly, use `ask_user`: *"Evaluation complete. Would you like to continue with azure-app-onboard to plan your deployment?"* — if confirmed, recommend invoking `azure-app-onboard` for the full pipeline.
