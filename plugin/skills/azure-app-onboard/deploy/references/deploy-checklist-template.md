# Deploy Checklist Template (compaction-safe — generated at Step 5b)

Long-running deploy sessions lose rules when the conversation compacts. At Step 5b, generate a checklist file tailored to this deployment. Write it to disk so it survives compaction — re-reading costs ~100 tokens.

**Write** to `.copilot-azure/sessions/{id}/deploy-checklist.md` using the `create` tool at Step 5b.
**Re-read** via `view` after every long-running command (`az deployment`, `az webapp deploy`, `az acr build`), after each failed health check, and after any conversation compaction.

## How to generate

Read `prepare-plan.json` to determine the service types, then build the checklist from the template below. **Replace `{placeholders}` with real values** and **delete sections that don't apply** (e.g., remove the App Service section for a Container Apps deploy).

```markdown
# Deploy Checklist for {appName}
# RG: {rgName} | Sub: {subscriptionId} | Session: {sessionId}

## After every `az` command
- Append 2 lines to `deploy-audit.log`: `{timestamp} | {command} | started` then `{timestamp} | {command} | succeeded/failed`

## After IaC deployment (Step 6)
- Verify 5 tags: `az group show -n {rgName} --query tags`
- ⛔ Do NOT set startup command or app settings via CLI — they are already in Bicep from scaffold. If `az webapp show` doesn't reflect them yet, wait 30s and re-check (ARM propagation delay). Do NOT run `az webapp config` imperatively.
  Required: app-onboard-skill, app-onboard-session-id, created-at, environment, deployed-by
- Verify portal link is still correct if healing changed the deployment name

## Code deploy — App Service (delete if not using App Service)
- Wait for stabilization: `az webapp show -g {rgName} -n {appName} --query state` → "Running"
- Verify `SCM_DO_BUILD_DURING_DEPLOYMENT=true` is active before deploy (ARM timing can delay)
- If build reports "0 seconds" but app needs deps: re-set the setting, wait 10s, retry
- If 0s persists after 2 retries: fall back to Kudu `/api/zipdeploy`
- Python: if no `antenv/` after deploy, use Kudu `/api/zipdeploy` immediately (OneDeploy may skip Oryx)
- Windows zip paths: normalize with `.Replace('\', '/')` before creating zip entries
- ⛔ Verify ORYX_DISABLE_COMPRESSION=true is set (prevents output.tar.zst extraction failures at startup — applies to ALL tiers, not just F1)
- Set WEBSITES_CONTAINER_START_TIME_LIMIT=1800 for safety
- TypeScript apps: move `typescript` to `dependencies` (not devDependencies) before creating deploy zip
- Enable SCM before zip deploy, re-disable after: `az rest --method put` → allow:false → verify
- After deploy: check response body for Azure default page ("Your app service is up and running" = app didn't start)

## Code deploy — Container Apps (delete if not using Container Apps)
- Phase 2 is NOT optional — deploy actual image, don't leave placeholder
- Wait ~60s for RBAC propagation (AcrPull role) before code deploy
- BuildKit Dockerfiles: create Dockerfile.azure without --mount syntax
- Pass real image on EVERY Bicep redeploy: --parameters containerImage='{acr}/{app}:latest'
- KV secrets: `revision restart` does NOT refresh — must create new revision
- ACR build failures count toward healing counter
- Windows: append `--no-logs` to `az acr build` to avoid UnicodeEncodeError

## Code deploy — Static Web Apps (delete if not using SWA)
- Use `swa deploy` (NOT `az staticwebapp deploy` — doesn't exist)
- `--app-name {swaName}` is mandatory
- Store token in $env:SWA_CLI_DEPLOYMENT_TOKEN — never as CLI arg

## During healing / retries
- Count ALL attempts in deploy-result.json.healingAttempts[]
  After 3: STOP and ask user ("Yes / I have a suggestion / Stop")
- NEVER run `az group delete` — track in orphanedResourceGroups[]
- Region/SKU/service changes require re-approval gate

## Before handoff (Step 8)
- deploy-result.json MUST exist — read back to verify, rewrite if missing
  Finalize: overwrite skeleton with real values — status (succeeded/failed), deploymentNames (all used),
  healthStatus (worst across endpoints), duration.completedUtc, resourceResults from `az deployment operation list`
- ⛔ You MUST read `session-schemas-deploy.ts` for exact DeployResult field names
- deployment-summary.md — update Status, Health, Links
- SCM re-disabled (App Service) or image param set (Container Apps)
- If prereq found migration frameworks: run migrations before declaring healthy
- DB password: `{pass}` MUST match `pgAdminPassword` from `az deployment sub create` — mismatched passwords cause silent auth failures
- ⛔ context.json — add "deploy" to completedPhases, set currentPhase to null, update lastModifiedUtc. VERIFY by reading back
```
