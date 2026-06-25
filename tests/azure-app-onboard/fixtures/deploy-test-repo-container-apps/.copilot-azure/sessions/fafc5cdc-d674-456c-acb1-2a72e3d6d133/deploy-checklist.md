# Deploy Checklist for ca-wetty-dev-fafc
# RG: rg-wetty-dev-fafc | Sub: 00000000-0000-0000-0000-000000000000 | Session: fafc5cdc-d674-456c-acb1-2a72e3d6d133

## ⛔ FIRST — Read deploy/SKILL.md
- You MUST `view` deploy/SKILL.md BEFORE running any `az deployment` command
- Path: `plugin/skills/azure-app-onboard/deploy/SKILL.md`
- If you have not read it in this conversation (or since the last compaction), read it NOW

## After every `az` command
- Append 2 lines to `deploy-audit.log`: `{timestamp} | {command} | started` then `{timestamp} | {command} | succeeded/failed`

## After IaC deployment (Step 6)
- Verify RG tags: `az group show -n rg-wetty-dev-fafc --query tags`
- Required tags: `app-onboard-skill`, `app-onboard-session-id`, `created-at`, `environment`, `deployed-by`
- Verify the deployment stays in `eastus2`
- Do not proceed to code deploy until scaffold findings are resolved: missing deployer Key Vault RBAC and redirecting probe path

## Code deploy — Container Apps
- Phase 2 is NOT optional — deploy the real image, do not leave the placeholder image
- Wait ~60s for RBAC propagation before code deploy
- Use `containers/wetty/Dockerfile.azure` for ACR builds; do not use the BuildKit Dockerfile
- Pass the real image on every Bicep redeploy: `--parameters containerImage='{acr}/{app}:latest'`
- Use the non-redirecting health path `/wetty` when fixing the probe configuration
- KV secrets require a new revision to refresh; `revision restart` alone is insufficient
- Windows ACR builds should add `--no-logs`

## During healing / retries
- Region MUST remain `eastus2`; any region change requires a new approval gate
- Fix Bicep, then redeploy via `az deployment sub create`; do not patch resources imperatively
- Count all attempts in `deploy-result.json.healingAttempts[]`
- Never run `az group delete`

## Before handoff (Step 8)
- `deploy-result.json` must be finalized with real status, resourceResults, endpoints, and completedUtc
- Re-read `deploy-schemas.ts` before finalizing deploy artifacts
- Update `context.json` only after deploy completes
