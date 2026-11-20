---
name: azure-appservice-deploy
description: "Code-only deploy to Linux Azure App Service: Python, Node.js, .NET, Java, PHP. WHEN: Flask, Django, FastAPI, Express, ASP.NET Core, Spring Boot, Laravel, Symfony. DO NOT USE FOR: Bicep, Terraform, IaC."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure App Service — Code Deploy

Deploys Python, Node.js, .NET, Java, or PHP code to Azure App Service Linux (P0v3 by default). Creates RG + Plan + Web App if missing. Hand off to `azure-prepare` for VNet, Key Vault, databases, or IaC. Other hosts, Windows, .NET Framework, standalone WASM, WordPress, and cross-cloud migration are out of scope.

**MCP tools used**: `mcp_azure_mcp_subscription_list`, `mcp_azure_mcp_group_list`, `mcp_azure_mcp_appservice`, `mcp_azure_mcp_azd` (when `azure.yaml` is present).

## Workflow

**Prerequisite:** Verify the latest stable Azure CLI; update with approval and recheck if needed.

1. **Resolve context — smart defaults, minimal prompts.** Only the app name is interactive; RG (`<app>-rg`), Plan (`<app>-plan`), region (current `az` default or `eastus2`), subscription are derived. [create-app.md](references/create-app.md) §1.
2. **Detect framework.** Identify the deployable project from manifests or the selected `azure.yaml` service. Ask if ambiguous; read only its guide: [Python](references/python/README.md), [Node.js](references/nodejs/README.md), [.NET](references/dotnet/README.md), [Java](references/java/README.md), or [PHP](references/php/README.md).
3. **Choose path** — selected service `host: appservice` in `azure.yaml` → [deploy-azd.md](references/deploy-azd.md); skip manual creation. Different host → hand off, not CLI fallback. No `azure.yaml` → [deploy-azcli.md](references/deploy-azcli.md).
4. **Ensure RG → Plan (`P0v3 --is-linux`) → Web App (`--runtime "<runtime>"`)** exist. Before creating a plan, invoke `azure-quotas` to check quota availability. On transient ARM errors, follow [transient-retry.md](references/transient-retry.md). [create-app.md](references/create-app.md).
5. **Set startup** — follow the selected guide.
6. **Configure build** — set `SCM_DO_BUILD_DURING_DEPLOYMENT=true` only for source builds. Build Java locally (or through `azd`); let `azd` publish .NET locally.
7. **Deploy** — `azd deploy <service>` or `az webapp deploy --type <artifact-type> --track-status false --enriched-errors true` (ZIP for source; JAR/WAR/EAR for Java).
8. **STOP. Print the post-deploy message** ([post-deploy-message.md](references/post-deploy-message.md)) and end the turn.

### Hard rules

- **LINUX SCRIPTS** — normalize selected shell/startup files to LF, then verify no CR bytes remain. Stop on normalization, validation or packaging failure; deploy only a fresh package.
- ⛔ **NO POST-DEPLOY VERIFICATION** — after deploy returns, do not run `az webapp log tail`, `curl`, `Invoke-WebRequest`, or any health probe. App Service needs 2–3 min to warm; a quiet log or early 5xx is not failure.
- ⛔ **SHELL SAFETY** — for `--runtime` always use colon form (e.g. `"PYTHON:3.14"`). Never pipe form (pipe is a shell operator).
- ⛔ **NEVER `az webapp up`** — deprecated. Use Step 7 commands.
- ✅ **URL FORMAT** — present endpoints as `https://...` URLs.

## Error Handling

See [errors.md](references/errors.md) for the full symptom → cause → fix matrix. Quick triage: missing plan/app → re-run Step 4; container ping timeout → check startup (Step 5); missing dependencies → check build settings (Step 6).
