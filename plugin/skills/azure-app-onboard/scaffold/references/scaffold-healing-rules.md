# Scaffold Healing Rules

Self-healing loop for scaffold validation failures. Supplements [self-healing.md](self-healing.md) (FIXABLE vs BLOCKING classification) with scaffold-specific escalation and plan-change rules.

## Healing Escalation Cadence

If Step 11 validation fails, classify each error as FIXABLE or BLOCKING per [self-healing.md](self-healing.md). For FIXABLE: edit IaC → re-validate via CLI (max 3 total before asking user). Each attempt must propose a *different* fix — never retry the same change twice. For BLOCKING: surface to user and halt.

> ⛔ **Ask user after 3 attempts, then every 5.** After 3 failed healing attempts, pause auto-healing and present a diagnosis:
>
> 1. **Explain the error pattern** — summarize what's failing and why across all 3 attempts (e.g., "Each retry fails on the same Cosmos DB Key Vault reference — the secret name in the Bicep doesn't match the Key Vault secret resource name").
> 2. **Propose a specific next fix** — state exactly what you would change and why. Never say "I'll try again" without naming the change.
> 3. **Ask the user** — present these options:
>    - **"Yes, try that"** → apply the proposed fix, continue for up to 5 more attempts.
>    - **"I have a suggestion"** → accept user input, apply their fix, retry.
>    - **"Stop"** → write `validationResult` with `status: "Failed"` and all accumulated errors. Do NOT proceed to deploy.
>
> After the user approves continuing, auto-heal for up to 5 more attempts before asking again. Ask again every 5 attempts thereafter.

> ⛔ **Docs fallback after 3 failed attempts on the same error.** If 3 consecutive healing attempts fail with the same error class (e.g., same Bicep compilation error, same ARM deployment error code), stop retrying and ⛔ **read [iac-resources.md](../../references/iac-resources.md)** for external documentation and validation tool links. Present the user with the relevant doc link + a suggested manual fix. Do NOT continue auto-healing the same error pattern.

## PLAN_LEVEL_CHANGE

> ⛔ If a validation failure requires changing the **service type** (e.g., App Service → Container Apps due to quota exhaustion) or **region** (e.g., eastus → westus2):
>
> 1. **STOP** — do not silently rewrite the IaC for a different service.
> 2. **Update `prepare-plan.json` FIRST** — change `services[]` to the new service type, update `naming.resources[]` with correct abbreviations (e.g., `app-` → `ca-`, `plan-` → `cae-`), update `costEstimate` with new pricing, update `deployStrategy` if code deploy path changes.
> 3. **Present abbreviated re-approval gate:** "⚠️ Plan change required: {old service} is unavailable ({reason}). Updated plan: {new service/SKU} in {region} (~${new cost}/mo, was ~${old cost}/mo). Approve? (Yes / Edit / Cancel)"
> 4. **Wait for user approval** — do NOT proceed until the user confirms.
> 5. **After re-approval, MUST update `prepare-plan.json`** — `services[]`, `naming.resources[]`, `costEstimate` — to reflect the new service set. Stale artifacts cause downstream inconsistency. Then regenerate IaC from the updated plan. Create NEW module files with correct names (e.g., `container-app.bicep` not `app-service.bicep` containing Container Apps code). Delete or rename stale module files. Re-run self-review and validation on the new IaC.
> 6. **Log the pivot** — write a [`ScaffoldHealingAttempt`](../../references/session-schemas-deploy.ts) entry with `planLevelChange: true`, `originalService`, and `newService` fields. This counts toward the 3-attempt healing cap.
>
> This rule applies to ANY service type or region change during scaffold — whether triggered by validation failure, quota exhaustion, or policy block. The deploy SKILL.md has the same rule for deploy-time errors. The principle is the same: **the user approved a specific plan — changing it requires re-approval.**

## Artifact Consistency After Service Changes

> ⛔ Whenever the service type, region, or SKU changes during self-healing (scaffold OR deploy), ALL upstream artifacts must be updated to reflect reality:
>
> | Artifact | What to update |
> |----------|---------------|
> | `prepare-plan.json` | `services[]` (type, SKU, region), `naming.resources[]` (abbreviations), `costEstimate`, `deployStrategy`, `quotaValidation` |
> | `scaffold-manifest.json` | `files[]` (new module paths), `selfReview` (re-run on new IaC) |
> | `context.json` | `statusSummary` (reflect actual state) |
> | IaC files | New modules with correct names — no stale files with wrong names |
>
> A session where `prepare-plan.json` says "App Service B1" but the deployed resources are Container Apps is **broken** — downstream analysis, resume, and cleanup all read the plan. The plan MUST match deployed reality.
