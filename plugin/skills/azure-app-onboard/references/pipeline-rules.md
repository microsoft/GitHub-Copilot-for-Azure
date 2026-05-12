# Pipeline Rules — Reference

Cross-cutting rules enforced across all workflow steps. Referenced from [SKILL.md](../SKILL.md) `## Pipeline Rules`.

## Approval gates

⛔ **Two separate approval gates are required — never merge them.**

1. **Scaffold gate (Step 6):** "✅ Ready to proceed with scaffolding? (Yes / Edit plan / Cancel)" — approves IaC generation only.
2. **Deploy gate (Step 8):** "🚀 Ready to deploy? (Yes / Run manually / Edit plan / Cancel)" — approves resource provisioning.

The scaffold gate does NOT grant deploy permission. After scaffold completes, you MUST present the deploy gate as a SEPARATE response. Never go from scaffold approval directly to `az group create` or `az deployment`.

⛔ **BOTH gates MUST show Subscription (name + ID), Resource Group, and Region** as standalone lines above the service table — users must see WHERE resources will be created before approving.

⛔ **NEVER create, write, or modify infrastructure files before the user explicitly says "Yes" to the scaffold gate.** No exceptions — not for simple apps, trivial plans, free-tier deployments, or single-component repos.

⛔ **Modifying existing IaC files (not AppOnboard-generated) requires explicit user approval.** Present: "I need to modify {file}: {change description}. Approve? (Yes / Edit / Cancel)". This applies to repos with existing Bicep/Terraform where AppOnboard adjusts SKUs, regions, or settings.

Each gate is the LAST content in its response — do NOT continue past a gate in the same turn.

> ❌ BAD: Writes Bicep without approval · scaffolds and deploys in same response · skips deploy gate after scaffold approval
> ✅ GOOD: Shows plan → user says Yes → scaffold → show validation summary → deploy gate → user says Yes → deploy

## Phase lifecycle

Set `currentPhase` at phase entry. At phase exit: append to `completedPhases`, set `currentPhase` to next phase (or `null` if pipeline complete), update `lastModifiedUtc`. Write the phase artifact before marking complete.

`currentPhase` must NEVER appear in `completedPhases` — if invariant violated, halt and report.

`context.json` is NOT write-once — each phase MUST update it on completion:
- Write `intent` after Step 2
- `components` after Step 3
- `azure.resourceGroup` after Step 7 (also written to `deploy-result.json.resourceGroupName`)
- Push to `completedPhases` after each step
- Update `statusSummary` at every phase exit — 1-line description. Templates:
  - prereq: `"{N} components, stack: {detectedStack}, health: {overallHealth}"`
  - prepare: `"{N} services, ~${monthlyUsd}/mo, region: {region}"` (if `quotaValidation.checkedRegions` >1, append fallback reason: `"region: westus2 (eastus quota full)"`)
  - scaffold: `"{N} files, self-review: {VERIFIED|FLAGGED count}"`
  - deploy: `"{healthStatus}, RG: {resourceGroupName}"`
  - cancel: `"Paused at {phase} — {reason}"`

## Session artifacts

**Session file writes: `New-Item -ItemType Directory` for directories, `create` tool for file content.** Create session directory via `New-Item -ItemType Directory -Path ".copilot-azure/sessions/{uuid}" -Force`, then `create` tool for all JSON/md content. Never use `Out-File`, `Set-Content`, or shell commands for file content.

## Post-compaction recovery

> ⛔ After ANY conversation compaction at ANY point in the pipeline, you MUST re-read the SKILL.md for the current phase and this `pipeline-rules.md`. Compaction evicts all reference file content — the agent MUST reload instructions before continuing.
>
> **If compaction occurs during scaffold or at the scaffold→deploy transition:**
> 1. Check if `scaffold-manifest.json` exists in the session folder — if not, write it now (self-review + validation results from the turn before compaction)
> 2. Check if `context.json.completedPhases` includes `"scaffold"` — if not, update it
> 3. When entering deploy: read `deploy/SKILL.md` fully — Step 5b generates the deploy-checklist.md that subsequent compaction recovery depends on

Begin your first response with: "Started session at `.copilot-azure/sessions/{uuid}/`" or "Resuming session from [date] — {statusSummary}".

⛔ **Session immutability:** NEVER write to any session folder other than the active session (the one `.copilot-azure/sessions/active-session.json` points to). Old sessions are read-only — no updates, no backfills, no status changes.

**Session TTL:** 7 days. Non-active sessions where `context.json.lastModifiedUtc` is >7 days ago are deleted on next invocation. The active session is never pruned.

## fastTrackEligible

`fastTrackEligible` (set by prereq in `prereq-output.json`) scopes to TWO things only:
1. Prereq readiness gate auto-approves (no user confirmation needed)
2. Prepare Step 3 simplifies alternative analysis (1 rejected alternative, skip `cloudarchitect_design`)

⛔ It does NOT skip phases, reference reads, approval gates, self-review, validation, or preflight checks. All phases run the same workflow.

**Schema source of truth:** Session artifact schemas are split across two files:
- [`session-schemas.ts`](session-schemas.ts) — shared + prereq + prepare:
  - [`AppOnboardContext`](session-schemas.ts) — `context.json`
  - [`PrereqOutput`](session-schemas.ts) — `prereq-output.json`
  - [`PreparePlan`](session-schemas.ts) — `prepare-plan.json`
- [`session-schemas-deploy.ts`](session-schemas-deploy.ts) — scaffold + deploy:
  - [`ScaffoldManifest`](session-schemas-deploy.ts) — `scaffold-manifest.json`
  - [`DeployResult`](session-schemas-deploy.ts) — `deploy-result.json`

## Deploy as-is

⛔ Do NOT refactor or upgrade working application code to fit a different architecture. Deploy what works. If the app uses SQLite, deploy with SQLite.

**Fixing broken code IS allowed** through the approval-gated list in Step 3 (build errors, missing deps).

**Upgrade suggestions** (e.g., "migrate to managed database") go to `prepare-plan.json.postDeployRecommendations[]` and surface in Step 8 — never act on them by rewriting code.

**Boundaries:**
- Infrastructure changes (adding Azure services) = allowed
- Application code changes (rewriting data access) = forbidden
- Azure service compatibility changes (TLS, SSL, port config) detected by prereq AND approved at the deploy gate = allowed

Never prompt for passwords in chat — auto-generate and store in Key Vault.

## Known Platform Bugs

See [`pipeline-rules-runtime.md`](pipeline-rules-runtime.md) § Known Platform Bugs for the full bug table and workarounds.

## No top-level skill invocation

⛔ **NEVER call `{"skill": "azure-validate"}`, `{"skill": "azure-deploy"}`, or any other skill OUTSIDE the AppOnboard family during the AppOnboard pipeline.** Loading an external skill hijacks the conversation — the skill's own "Next" instructions chain away from AppOnboard, bypassing deploy-result.json, deploy-audit.log, portal links, and SCM re-disable. All validation and deployment MUST use direct CLI commands (`az bicep build`, `az deployment sub what-if`, `az deployment sub create`, `az webapp deploy`).

**Allowed:** AppOnboard sub-skills (`azure-app-onboard-prereq`, `azure-app-onboard` orchestrator) — these are part of the pipeline.
**Blocked:** `azure-validate`, `azure-deploy`, `azure-prepare`, or any skill not prefixed with `azure-app-onboard`.

## Security baseline

⛔ See [scaffold/references/iac-generation-rules.md](../scaffold/references/iac-generation-rules.md) § Session Tags and [bicep-patterns-security.md](../scaffold/references/bicep-patterns-security.md) for full security patterns. Summary: managed identity on all compute, FTPS disabled, Key Vault for secrets (never `uniqueString()`), AppOnboard session tags on all resources, `basicPublishingCredentialsPolicies` (`scm.allow: true` scaffold / `ftp.allow: false` always), no hardcoded secrets in ANY generated file.

Flag `AllowAzureServices` firewall rule (0.0.0.0) as a security warning in selfReview.

## azure.yaml prohibition

⛔ **NEVER generate `azure.yaml`. NEVER use `azd up`/`azd provision`/`azd deploy`.** AppOnboard deploys via `az deployment sub create` (Bicep) or `terraform apply` (Terraform). Repos with existing `azure.yaml` → route per [`azd-template-routing.md`](azd-template-routing.md).

## Architecture questions

⛔ Read [`service-advisor.md`](service-advisor.md) before answering service selection or architecture questions. Answer with specific Azure service/SKU names. Write decisions to `context.json.overrides[]`.

## SKU output format

Always include exact Azure SKU codes (e.g., "App Service F1 (Free)", "B1 Linux (Basic)") in ALL output — plans, gates, guides, estimates. Do NOT use generic terms like "Free tier" or "Basic" without the SKU code.

