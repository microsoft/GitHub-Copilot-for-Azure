# Validation, Manifest & Approval — Steps 10–12.5

## Step 10 — CI/CD

Do NOT auto-generate workflow files or create branches/PRs. Scaffold only writes IaC files. This step activates only when `context.json.repo.remote` is non-null AND user explicitly requests branch/PR creation. When `repo.remote` is absent or user declines, write IaC directly to working tree. If the user asks for CI/CD, or after deploy completes, suggest it as a follow-up: call `mcp_azure_mcp_deploy` → `deploy_pipeline_guidance_get` with `is-azd-project: false`, `pipeline-platform: "github-actions"`, `deploy-option: "provision-and-deploy"` and present the guidance for the user to apply.

## Step 11 — Validate Generated IaC

> ⛔ **Validation MUST happen BEFORE the manifest is written.** The manifest requires `validationResult` — you cannot write it without completing validation first. Do NOT write `scaffold-manifest.json` until validation has run.

> ⛔ **Do NOT call `{"skill": "azure-validate"}`, `{"skill": "azure-deploy"}`, `{"skill": "azure-prepare"}`, or any other skill during scaffold or deploy.** Loading a skill hijacks the conversation — the skill's own "Next" instructions chain away from the AppOnboard pipeline, bypassing deploy-result.json, deploy-audit.log, portal links, and SCM re-disable. Use CLI validation directly. This rule is in pipeline-rules.md and is non-negotiable.

Run these checks directly. All must pass.

**11a. Bicep compilation:**
```bash
az bicep build --file infra/main.bicep --stdout > $null
```
Pass: exit 0. Fail: fix errors and retry.

**11b. Template validation via what-if (validates + previews in one call):**
```bash
az deployment sub what-if --location {region} --template-file infra/main.bicep --parameters @infra/main.parameters.json --subscription {subscriptionId} --no-pretty-print
```
Pass: exit 0 + resource change list. Fail: fix and retry per [self-healing.md](self-healing.md). The what-if command validates the template AND shows the resource change preview — no separate validate step needed.

> ⛔ **If what-if fails (403 insufficient permissions, RG doesn't exist, or any error):** fall back to `az bicep build --file infra/main.bicep --stdout > $null` as sufficient scaffold-time validation. Log: "Subscription-level what-if unavailable — bicep build passed. Full what-if will run at deploy time." Write `validationResult.checks[]` with `{ "name": "what-if", "result": "SKIPPED", "detail": "deferred to deploy" }`. Do NOT try `az deployment group what-if` at scaffold time — the RG doesn't exist yet. Do NOT create the RG just for validation. Do NOT spiral through alternatives.

> ⛔ **Do NOT use `az deployment sub validate` or `az deployment group validate`** — these commands hit a known Azure CLI bug (HTTP response stream consumed error on CLI 2.75.0+). Use `what-if` instead — it calls a different API path that works correctly and provides strictly more information (validation + change preview).

**11c. Static RBAC review** — review generated Bicep for correct role assignments per [rbac-roles.md](rbac-roles.md). Every managed identity ↔ resource pair must have a `Microsoft.Authorization/roleAssignments` resource with the correct role GUID.

**11d. Write `validationResult`** — after all checks pass, write:
```json
{
  "validationResult": {
    "status": "Validated",
    "checks": [
      { "name": "bicep build", "result": "PASS" },
      { "name": "what-if (validate + preview)", "result": "PASS", "detail": "N resources to create" },
      { "name": "RBAC review", "result": "PASS" }
    ]
  }
}
```

**Terraform path:** Replace 11a–11b with `terraform init -backend=false && terraform validate` + `terraform plan -detailed-exitcode`.

- If validation finds FIXABLE errors: edit IaC → re-run self-review (L1–L4) → re-validate (max 3 attempts). ⛔ **You MUST read [self-healing.md](self-healing.md) before entering the healing loop** — it defines FIXABLE vs BLOCKING classification and auto-fix strategies.
- If BLOCKING errors remain after 3 attempts: surface to user and halt.

## Step 12 — Write `scaffold-manifest.json`

⛔ **You MUST read [`session-schemas-deploy.ts`](../../references/session-schemas-deploy.ts)** to get the exact `ScaffoldManifest` interface. Write to the session folder with ALL fields populated: `files[]`, `selfReview.findings[]`, AND `validationResult` (from Step 11). This is a single write — validation is already complete.

> ⛔ **Phase exit gate: `scaffold-manifest.json.validationResult` MUST NOT be null.** If validation ran: `{ status: 'Passed'/'Failed', details }`. If skipped: `{ status: 'Skipped', reason }`. Null = incomplete scaffold.

**You MUST also update `context.json`** per `AppOnboardContext` in [`session-schemas.ts`](../../references/session-schemas.ts): append `"scaffold"` to `completedPhases`, set `currentPhase` to `"deploy"`, update `lastModifiedUtc`.

**Write `deployment-summary.md`** — write to `.copilot-azure/sessions/{uuid}/deployment-summary.md` using the template in [`deployment-summary-template.md`](../../references/deployment-summary-template.md). Fill: What's Being Deployed, Architecture Decisions, and Generated Files from `prepare-plan.json`, `prereq-output.json`, and `scaffold-manifest.json`. Set status to `Scaffolded`. Leave Deployment Links, Health, and Cleanup empty with "*(Populated after deploy)*".

## Step 12.5 — Deploy Approval Gate

Present the user with: files generated, selfReview findings, **validation results** (pass/fail per check from Step 11), services + SKUs, secure-defaults applied. End with: **"Ready to deploy? (Yes / Run manually / Edit plan / Cancel)"** — do not continue until the user approves.

> ⛔ **Self-check before presenting the deploy gate.** Does `scaffold-manifest.json` contain a `validationResult` field with `status` set? If NO → you skipped Step 11. Go back and run validation. Do NOT present the deploy gate with `validationResult: null`.

> ⛔ **Quota gate — MANDATORY CHECK.** Read `prepare-plan.json.quotaValidation`. If `verified == false`, `method == "unverifiable"`, OR `method` is not `"cli"` for quota-constrained services: **you MUST read [`sku-quota-validation.md`](../../prepare/references/sku-quota-validation.md) § Deploy Gate Re-Validation** with the `view` tool and follow the procedure before presenting the deploy gate.
> ⛔ **Do NOT use `az vm list-usage`, `az appservice list-locations`, or `mcp_azure_mcp_quota`** for quota checks. They return misleading data — see Anti-Patterns in [`sku-quota-validation.md`](../../prepare/references/sku-quota-validation.md).


> ⛔ **Azure service compatibility warnings.** Read `prereq-output.json.warnings[]` for any warnings with IDs starting with `W-REDIS-TLS`, `W-PG-SSL`, or `W-SERVICE-`. If present, surface EACH at the deploy gate: "⚠️ Azure compatibility: {warning summary}. I need to {specific change — config file, code modification, or env var}. Approve? (Yes / Skip this service / Cancel)". Code modifications require explicit user approval here — they are NOT auto-applied. If the user skips, note in `postDeployRecommendations[]`. If approved, apply the minimal change during deploy code-deployment phase (Step 6).

> ⛔ **Phase exit — NOT complete until ALL done:**
> 1. `scaffold-manifest.json` written with `files[]`, `selfReview.findings[]`, AND `validationResult`
> 2. `context.json`: `"scaffold"` appended to `completedPhases`, `currentPhase` → `"deploy"`, `lastModifiedUtc` updated
> 3. `deployment-summary.md` written to session folder using [`deployment-summary-template.md`](../../references/deployment-summary-template.md) — status `Scaffolded`, sections 1–5 populated from plan + manifest
> 4. `deploy-checklist.md` written to session folder using [`deploy-checklist-template.md`](../../deploy/references/deploy-checklist-template.md) — fill in real values from `prepare-plan.json`, `scaffold-manifest.json`, and `prereq-output.json`, delete sections that don't apply to this deployment's compute target. **This MUST be written at scaffold exit, NOT deferred to deploy Step 5b** — if context compaction hits at the scaffold/deploy boundary, the deploy phase can recover by reading this checklist.
