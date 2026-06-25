# Deploy Checklist for app-bya-notes-dev-4d29
# RG: rg-bya-notes-dev-4d29 | Sub: 00000000-0000-0000-0000-000000000000 | Session: 4d294c61-c598-4e19-a866-7853ab71bca2

## ⛔ FIRST — Read deploy/SKILL.md
- You MUST `view` deploy/SKILL.md BEFORE running any `az deployment` command
- Path: `plugin/skills/azure-app-onboard/deploy/SKILL.md`
- If you have not read it in this conversation (or since the last compaction), read it NOW
- It covers preflight checks, portal links, what-if, SCM lifecycle, deploy-result.json schema, audit logging, and health checks — skip it and none of these happen

## After every `az` command
- Append 2 lines to `deploy-audit.log`: `{timestamp} | {command} | started` then `{timestamp} | {command} | succeeded/failed`

## After IaC deployment (Step 6)
- Verify 5 tags: `az group show -n rg-bya-notes-dev-4d29 --query tags`
- ⛔ Do NOT set startup command or app settings via CLI — they are already in Bicep from scaffold. If `az webapp show` doesn't reflect them yet, wait 30s and re-check (ARM propagation delay). Do NOT run `az webapp config` imperatively.
  Required: app-onboard-skill, app-onboard-session-id, created-at, environment, deployed-by
- Verify portal link is still correct if healing changed the deployment name

## Code deploy — App Service
- Wait for stabilization: `az webapp show -g rg-bya-notes-dev-4d29 -n app-bya-notes-dev-4d29 --query state` → "Running"
- Verify `SCM_DO_BUILD_DURING_DEPLOYMENT=true` is active before deploy (ARM timing can delay)
- If build reports "0 seconds" but app needs deps: re-set the setting, wait 10s, retry
- If 0s persists after 2 retries: fall back to Kudu `/api/zipdeploy`
- Python: if no `antenv/` after deploy, use Kudu `/api/zipdeploy` immediately (OneDeploy may skip Oryx)
- Windows zip paths: normalize with `.Replace('\\', '/')` before creating zip entries
- ⛔ Verify ORYX_DISABLE_COMPRESSION=true is set (prevents output.tar.zst extraction failures at startup — applies to ALL tiers, not just F1)
- Set WEBSITES_CONTAINER_START_TIME_LIMIT=1800 for safety
- TypeScript apps: move `typescript` to `dependencies` (not devDependencies) before creating deploy zip
- Enable SCM before zip deploy, re-disable after: `az rest --method put` → allow:false → verify
- After deploy: check response body for Azure default page ("Your app service is up and running" = app didn't start)

## During healing / retries
- ⛔ REGION LOCK: Deploy region MUST match plan region (eastus2). Any region change → RE-PRESENT deploy approval gate with old and new region. Do NOT silently switch. After approval: update `prepare-plan.json.services[].region` and `deploymentVariables.location` before retrying.
- ⛔ IaC-only: NEVER use `az containerapp update --image`, `az webapp update`, `az appservice plan delete`, or `az group create` — fix the Bicep and redeploy via `az deployment sub create`
- Count ALL attempts in deploy-result.json.healingAttempts[]
  After 3: STOP and ask user ("Yes / I have a suggestion / Stop")
- NEVER run `az group delete` — track in orphanedResourceGroups[]
- Region/SKU/service changes require re-approval gate

## Before handoff (Step 8)
- deploy-result.json MUST exist — read back to verify, rewrite if missing
  Finalize: overwrite skeleton with real values — status (succeeded/failed), deploymentNames (all used),
  healthStatus (worst across endpoints), duration.completedUtc, resourceResults from `az deployment operation list`
- ⛔ You MUST read [`deploy-schemas.ts`](deploy-schemas.ts) for exact DeployResult field names
- deployment-summary.md — written at handoff (see handoff-protocol.md § Artifact self-check)
- SCM re-disabled (App Service)
- ⛔ context.json — add "deploy" to completedPhases, set currentPhase to null, update lastModifiedUtc. VERIFY by reading back

## Artifact verification (Step 8 — MANDATORY)
⛔ Before returning to orchestrator, verify ALL artifacts exist by reading each one back:
1. `deploy-result.json` — MUST contain: `status`, `deploymentNames[]`, `healthStatus`, `duration.completedUtc`, `resourceResults[]`, `endpoints[]`. Missing fields → rewrite with real values NOW
2. `deploy-audit.log` — MUST exist with ≥2 entries (started + result for at least 1 command). Missing → reconstruct from memory
3. `deployment-summary.md` — MUST contain Status, Health, Portal Links sections. Missing → generate from deploy-result.json
4. `context.json` — MUST have `"deploy"` in `completedPhases`, `currentPhase: null`, updated `lastModifiedUtc`
5. ⛔ **Endpoint completeness** — EVERY service in `prepare-plan.json.services[]` that hosts application code MUST have a corresponding entry in `deploy-result.json.endpoints[]` with code deployed and a valid `healthStatus` (`healthy`, `degraded`, `unreachable`, `unknown`). If ANY compute endpoint is missing or has code not deployed, set `partial: true` and `status: "failed"`. A deployment with undeployed user components is NOT `"succeeded"`.

If ANY artifact is missing or incomplete, write it NOW — do NOT return to orchestrator without all 5 checks passing.
