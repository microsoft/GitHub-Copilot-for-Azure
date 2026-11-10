---
name: nodejs-appservice-deploy
description: "Deploy Node.js (Express/Next.js/NestJS/Fastify) code to Azure App Service Linux. WHEN: \"Express App Service\", \"Next.js App Service\", \"NestJS App Service\", \"deploy Node.js to App Service\". DO NOT USE FOR: Container Apps, Functions, Static Web Apps, non-Node.js, Terraform/Bicep/IaC, full infra — use azure-prepare."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Node.js on Azure App Service — Code Deploy

Deploys Node.js (Express, Next.js, NestJS, Fastify, Koa, generic) code to Azure App Service Linux (P0v3, matching Node runtime). Creates RG + Plan + Web App if missing. Hand off to `azure-prepare` for VNet, Key Vault, databases, or IaC.

**MCP tools used**: `mcp_azure_mcp_subscription_list`, `mcp_azure_mcp_group_list`, `mcp_azure_mcp_appservice`, `mcp_azure_mcp_azd` (when `azure.yaml` is present).

## Workflow

**Prerequisite:** Verify the latest stable Azure CLI; update with approval and recheck if needed.

1. **Resolve context — smart defaults, minimal prompts.** Only the app name is interactive; RG (`<app>-rg`), Plan (`<app>-plan`), region (current `az` default or `eastus2`), subscription are derived. [create-app.md](references/create-app.md) §1.
2. **Detect framework + start entry + `PORT` usage** (advisory, never blocks). [detect.md](references/detect.md).
3. **Choose path** — `azure.yaml` host: appservice → [deploy-azd.md](references/deploy-azd.md); else [deploy-azcli.md](references/deploy-azcli.md).
4. **Ensure RG → Plan (`P0v3 --is-linux`) → Web App (`--runtime "<runtime>"`)** exist. Discover the latest compatible runtime in [create-app.md](references/create-app.md) §4 (e.g., `NODE:26`); before creating a plan, run its quota and region gate (§1d). On transient ARM errors, follow [transient-retry.md](references/transient-retry.md).
5. **Set startup** — `start` script or common entry file: none. NestJS: `node dist/main.js`. Static SPA: `pm2 serve`. Other: warn. [startup-commands.md](references/startup-commands.md).
6. **Set `SCM_DO_BUILD_DURING_DEPLOYMENT=true`** — Oryx runs `npm install` and `npm run build`.
7. **Deploy** — `azd deploy` or `az webapp deploy --type zip --track-status false --enriched-errors true`.
8. **STOP. Print the post-deploy message** ([post-deploy-message.md](references/post-deploy-message.md)) and end the turn.

### Hard rules

- **LINUX SCRIPTS** — normalize selected shell/startup files to LF, then verify no CR bytes remain. Stop on normalization, validation or packaging failure; deploy only a fresh package.
- **PORT** — the app must listen on `process.env.PORT`. If hard-coded, warn and show the fix; never edit user code silently.
- **NO `node_modules` IN ZIP** — the remote build installs Linux-native dependencies.
- ⛔ **NO POST-DEPLOY VERIFICATION** — after deploy returns, do not run `az webapp log tail`, `curl`, `Invoke-WebRequest`, or any health probe. App Service needs 2–3 min to warm; a quiet log or early 5xx is not failure.
- ⛔ **SHELL SAFETY** — for `--runtime` always use the colon form (e.g., `"NODE:26"`). Never `"NODE|26"` (pipe is a shell operator).
- ⛔ **NEVER `az webapp up`** — deprecated. Use Step 7 commands.
- ✅ **URL FORMAT** — present endpoints as `https://...` URLs.

## Error Handling

See [errors.md](references/errors.md) for the full symptom → cause → fix matrix. Quick triage: missing plan/app → re-run Step 4; container ping timeout on 8080 → listen on `process.env.PORT` or fix startup (Step 5); `Cannot find module` after deploy → ensure Step 6 ran, redeploy.
