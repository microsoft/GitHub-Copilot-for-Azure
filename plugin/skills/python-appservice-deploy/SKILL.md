---
name: python-appservice-deploy
description: "Deploy Python (Flask/Django/FastAPI) code to Azure App Service Linux. WHEN: \"Flask App Service\", \"Django App Service\", \"FastAPI App Service\", \"deploy Python to App Service\". DO NOT USE FOR: Container Apps, Functions, non-Python, Terraform/Bicep/IaC, full infra — use azure-prepare."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Python on Azure App Service — Code Deploy

Deploys Python (Flask, Django, FastAPI, generic) code to Azure App Service Linux. Creates RG + Plan + Web App if missing. For full infra (VNet, Key Vault, DBs, IaC) hand off to `azure-prepare`.

## Quick Reference

| Property | Value |
|---|---|
| OS · SKU · Python | Linux · P0v3 · 3.14 |
| Deploy tool | `azd` if `azure.yaml` host: appservice, else `az` CLI `webapp deploy --type zip` |
| Forbidden | ⛔ `az webapp up` (deprecated) |
| Auto-startup | Flask/Django → none (Oryx). FastAPI → always `python -m uvicorn main:app --host 0.0.0.0`. Other → warn. |

## When to Use This Skill

Deploy/publish a **Python** web app (Flask, Django, FastAPI, generic) to **Azure App Service**. Do NOT use for non-Python, Container Apps / Functions / AKS, full-infra (VNet, Key Vault, DBs, Terraform/Bicep/IaC), or cross-cloud migration (Lambda, Fargate, Cloud Run).

## MCP Tools

| Tool | Purpose |
|---|---|
| `mcp_azure_mcp_subscription_list`, `mcp_azure_mcp_group_list` | Discover subscription / RG |
| `mcp_azure_mcp_appservice` | App Service operations |
| `mcp_azure_mcp_azd` | `azd` when an `azd` template is present |

## Workflow

1. **Resolve context — smart defaults, minimal prompts.** Only the app name is interactive; RG (`<app>-rg`), Plan (`<app>-plan`), region (current `az` default or `eastus2`), subscription are derived. [create-app.md](references/create-app.md) §1.
2. **Detect framework** (advisory, never blocks). [detect.md](references/detect.md).
3. **Choose path** — `azure.yaml` host: appservice → [deploy-azd.md](references/deploy-azd.md); else [deploy-azcli.md](references/deploy-azcli.md).
4. **Ensure RG → Plan (`P0V3 --is-linux`) → Web App (`--runtime "PYTHON:3.14"`)** exist. Retry transient ARM errors silently. [create-app.md](references/create-app.md) §1f.
5. **Set startup** per [startup-commands.md](references/startup-commands.md).
6. **Set `SCM_DO_BUILD_DURING_DEPLOYMENT=true`**.
7. **Deploy** — `azd deploy` or `az webapp deploy --type zip --track-status false`.
8. **STOP. Print the post-deploy message** ([post-deploy-message.md](references/post-deploy-message.md)) — `https://` URL, "2–3 min" warmup, `az webapp log tail` command. End the turn.

### Hard rules

- ⛔ **NO POST-DEPLOY VERIFICATION** — after the deploy returns, do not run `az webapp log tail`, `curl`, `Invoke-WebRequest`, or any health probe. App Service needs 2–3 min to warm; a quiet log or early 5xx is not failure.
- ⛔ **SHELL SAFETY** — for `--runtime` always use `"PYTHON:3.14"` (colon). Never `"PYTHON|3.14"` (pipe is a shell operator).
- ✅ **URL FORMAT** — present endpoints as `https://...` URLs.

## Error Handling

Full troubleshooting matrix: [errors.md](references/errors.md). Common cases:

- `ResourceNotFound` for plan/app → re-run Step 4 (it creates them).
- `Container didn't respond to HTTP pings on port 8000` → fix startup ([startup-commands.md](references/startup-commands.md)).
- Site `ModuleNotFoundError` after a successful deploy → ensure `SCM_DO_BUILD_DURING_DEPLOYMENT=true`, redeploy.
- User notes mention `az webapp up` → replace with Step 7 commands.

## References

[create-app.md](references/create-app.md) · [detect.md](references/detect.md) · [deploy-azd.md](references/deploy-azd.md) · [deploy-azcli.md](references/deploy-azcli.md) · [startup-commands.md](references/startup-commands.md) · [post-deploy-message.md](references/post-deploy-message.md) · [errors.md](references/errors.md)
