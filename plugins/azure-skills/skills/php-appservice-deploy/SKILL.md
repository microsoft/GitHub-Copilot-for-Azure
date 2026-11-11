---
name: php-appservice-deploy
description: "Deploy PHP (Laravel/Symfony/Slim/plain PHP) code to Azure App Service Linux. WHEN: \"Laravel App Service\", \"Symfony App Service\", \"deploy PHP to App Service\", \"PHP web app on App Service\". DO NOT USE FOR: Container Apps, Functions, WordPress, non-PHP, Terraform/Bicep/IaC, full infra — use azure-prepare."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# PHP on Azure App Service — Code Deploy

Deploys PHP (Laravel, Symfony, Slim, CodeIgniter, plain PHP) code to Azure App Service Linux (P0v3, matching PHP runtime, NGINX + PHP-FPM). Creates RG + Plan + Web App if missing. Hand off to `azure-prepare` for VNet, Key Vault, databases, or IaC.

**MCP tools used**: `mcp_azure_mcp_subscription_list`, `mcp_azure_mcp_group_list`, `mcp_azure_mcp_appservice`, `mcp_azure_mcp_azd` (when `azure.yaml` is present).

## Workflow

**Prerequisite:** Verify the latest stable Azure CLI; update with approval and recheck if needed.

1. **Resolve context — smart defaults, minimal prompts.** Only the app name is interactive; RG (`<app>-rg`), Plan (`<app>-plan`), region (current `az` default or `eastus2`), subscription are derived. [create-app.md](references/create-app.md) §1.
2. **Detect framework + document root + writable dirs** (advisory, never blocks). [detect.md](references/detect.md).
3. **Choose path** — `azure.yaml` host: appservice → [deploy-azd.md](references/deploy-azd.md); else [deploy-azcli.md](references/deploy-azcli.md).
4. **Ensure RG → Plan (`P0v3 --is-linux`) → Web App (`--runtime "<runtime>"`)** exist. Discover the latest compatible runtime in [create-app.md](references/create-app.md) §4 (e.g., `PHP:8.5`); before creating a plan, run its quota and region gate (§1d). On transient ARM errors, follow [transient-retry.md](references/transient-retry.md).
5. **Set startup** — doc root at app root: none. `public/` doc root (Laravel, Symfony, Slim): NGINX `root` override via startup script; Laravel also creates writable dirs. [startup-commands.md](references/startup-commands.md).
6. **Set `SCM_DO_BUILD_DURING_DEPLOYMENT=true`** — Oryx runs `composer install`. Laravel: set `APP_KEY` and, without a database, file session/cache drivers. Symfony: [build preflight](references/symfony-build.md).
7. **Deploy** — `azd deploy` or `az webapp deploy --type zip --track-status false --enriched-errors true`.
8. **STOP. Print the post-deploy message** ([post-deploy-message.md](references/post-deploy-message.md)) and end the turn.

### Hard rules

- **LINUX SCRIPTS** — normalize selected shell/startup files to LF, then verify no CR bytes remain. Stop on normalization, validation or packaging failure; deploy only a fresh package.
- **NO `vendor` IN ZIP** — the remote build runs `composer install` for Linux.
- **LARAVEL WRITABLE DIRS** — keep `storage/` and `bootstrap/cache/` (with placeholder files) in the ZIP; the startup script creates `storage/framework/{sessions,views,cache}` before the app starts.
- **SECRETS** — never ZIP `.env`; set required values (e.g., `APP_KEY`) as app settings.
- ⛔ **NO POST-DEPLOY VERIFICATION** — after deploy returns, do not run `az webapp log tail`, `curl`, `Invoke-WebRequest`, or any health probe. App Service needs 2–3 min to warm; a quiet log or early 5xx is not failure.
- ⛔ **SHELL SAFETY** — for `--runtime` always use the colon form (e.g., `"PHP:8.5"`). Never `"PHP|8.5"` (pipe is a shell operator).
- ⛔ **NEVER `az webapp up`** — deprecated. Use Step 7 commands.
- ✅ **URL FORMAT** — present endpoints as `https://...` URLs.

## Error Handling

See [errors.md](references/errors.md) for the full symptom → cause → fix matrix. Quick triage: missing plan/app → re-run Step 4; 404 on every Laravel route or default page → NGINX root not set (Step 5); `Please provide a valid cache path` → writable dirs missing (Step 5); `vendor/autoload.php` missing → ensure Step 6 ran, redeploy.
