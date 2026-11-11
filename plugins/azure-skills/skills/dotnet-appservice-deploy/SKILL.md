---
name: dotnet-appservice-deploy
description: "Deploy .NET (ASP.NET Core/Blazor/MVC/Web API) code to Azure App Service Linux. WHEN: \"ASP.NET Core App Service\", \"Blazor App Service\", \"Web API App Service\", \"deploy .NET to App Service\". DO NOT USE FOR: Container Apps, Functions, Windows/.NET Framework, standalone WASM, non-.NET, Terraform/Bicep/IaC, full infra — use azure-prepare."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# .NET on Azure App Service — Code Deploy

Deploys .NET (ASP.NET Core, MVC, Web API, Razor Pages, Blazor Server/Web App) code to Azure App Service Linux (P0v3, matching .NET runtime). Creates RG + Plan + Web App if missing. Hand off to `azure-prepare` for VNet, Key Vault, databases, IaC, Windows/.NET Framework, or standalone Blazor WASM.

**MCP tools used**: `mcp_azure_mcp_subscription_list`, `mcp_azure_mcp_group_list`, `mcp_azure_mcp_appservice`, `mcp_azure_mcp_azd` (when `azure.yaml` is present).

## Workflow

**Prerequisite:** Verify the latest stable Azure CLI; update with approval and recheck if needed.

1. **Resolve context — smart defaults, minimal prompts.** Only the app name is interactive; RG (`<app>-rg`), Plan (`<app>-plan`), region (current `az` default or `eastus2`), subscription are derived. [create-app.md](references/create-app.md) §1.
2. **Detect web project + target framework** (selects `PROJECT` and runtime). [detect.md](references/detect.md).
3. **Choose path** — `azure.yaml` host: appservice → [deploy-azd.md](references/deploy-azd.md); else [deploy-azcli.md](references/deploy-azcli.md).
4. **Ensure RG → Plan (`P0v3 --is-linux`) → Web App (`--runtime "<runtime>"`)** exist. Discover the latest compatible runtime in [create-app.md](references/create-app.md) §4 (e.g., `DOTNETCORE:10.0`); before creating a plan, run its quota and region gate (§1d). On transient ARM errors, follow [transient-retry.md](references/transient-retry.md).
5. **Set startup** — ASP.NET Core: none (App Service starts the published assembly). Custom `dotnet <Assembly>.dll` only when needed. [startup-commands.md](references/startup-commands.md).
6. **Build configuration** — CLI source deploy: set `SCM_DO_BUILD_DURING_DEPLOYMENT=true` (+ `PROJECT` for multi-project repos) so Oryx runs `dotnet publish`. azd publishes locally instead; see [deploy-azd.md](references/deploy-azd.md).
7. **Deploy** — `azd deploy` or `az webapp deploy --type zip --track-status false --enriched-errors true`.
8. **STOP. Print the post-deploy message** ([post-deploy-message.md](references/post-deploy-message.md)) and end the turn.

### Hard rules

- **LINUX SCRIPTS** — normalize selected shell/startup files to LF, then verify no CR bytes remain. Stop on normalization, validation or packaging failure; deploy only a fresh package.
- **NO `bin/` OR `obj/` IN ZIP** — exclude them at every depth; keep project references and `Directory.Build.*` files.
- **FRAMEWORK MATCH** — match the runtime to `TargetFramework`/`global.json`; never silently retarget.
- ⛔ **NO POST-DEPLOY VERIFICATION** — after deploy returns, do not run `az webapp log tail`, `curl`, `Invoke-WebRequest`, or any health probe. App Service needs 2–3 min to warm; a quiet log or early 5xx is not failure.
- ⛔ **SHELL SAFETY** — for `--runtime` always use the colon form (e.g., `"DOTNETCORE:10.0"`). Never `"DOTNETCORE|10.0"` (pipe is a shell operator).
- ⛔ **NEVER `az webapp up`** — deprecated. Use Step 7 commands.
- ✅ **URL FORMAT** — present endpoints as `https://...` URLs.

## Error Handling

See [errors.md](references/errors.md) for the full symptom → cause → fix matrix. Quick triage: missing plan/app → re-run Step 4; default page or no project detected → fix ZIP root/`PROJECT` (Step 6); `You must install or update .NET` → runtime mismatch, re-run Step 4 with a matching runtime.
