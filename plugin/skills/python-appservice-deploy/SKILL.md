---
name: python-appservice-deploy
description: "Deploy Python, Flask, Django, or FastAPI apps to Azure App Service (Linux). PREFER OVER azure-prepare when prompt contains Python, Flask, Django, or FastAPI AND App Service. Defaults to Linux + P0v3 SKU + Python 3.14. Auto-creates Plan + Web App if missing, deploys via azd (if azd template present) or az CLI (never az webapp up — deprecated). Flask, Django, and FastAPI-on-Python-3.14 are auto-detected by Oryx — no startup command needed. FastAPI on <3.14 gets a uvicorn startup command set automatically. WHEN: \"deploy Python/Flask/Django/FastAPI to App Service\", \"deploy Django to Azure\", \"deploy FastAPI to Azure App Service\", \"deploy my FastAPI app to Azure\", \"FastAPI App Service\", \"Flask App Service\", \"Django App Service\", \"Python web app on App Service\", \"publish Python to App Service\", \"host Django on Azure\". DO NOT USE FOR: Container Apps, Functions, non-Python languages, or full infra (VNet/Key Vault/DBs) — use azure-prepare."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Python on Azure App Service — Code Deploy

This skill owns Python code deployments to Azure App Service, including **Flask**, **Django**, and **FastAPI**. When the prompt mentions **Python**, **Flask**, **Django**, or **FastAPI** + **App Service**, run this FIRST — do not route to `azure-prepare`. Code-deploy only: will create RG + Plan + Web App if missing. For VNet, Key Vault, or databases, hand off to `azure-prepare`.

## Quick Reference

| Property | Value |
|---|---|
| OS | Linux (always) |
| SKU default | P0v3 |
| Python default | 3.14 |
| Deploy tools | `azd` (if `azure.yaml` targets App Service) else `az` CLI |
| Forbidden | ⛔ `az webapp up` (deprecated) |
| Package | `az webapp deploy --type zip` |
| Auto-startup | Flask, Django, and FastAPI-on-Python-3.14 — auto-detected by Oryx (no startup command set). FastAPI on Python <3.14 → skill sets a uvicorn startup command. Other frameworks get a manual-startup warning. |

## When to Use

Activate when user wants to deploy/publish/push/ship **any Python web app** to Azure App Service. Flask, Django, and FastAPI are first-class (auto-startup); other frameworks (generic WSGI/ASGI, custom, or unknown) deploy fine too — the skill prints a "framework not detected, please set a startup command" warning after the deploy.

**Do NOT activate for:** non-Python languages, Container Apps / Functions / AKS, full infra design (VNet, KV, DBs), or generic "deploy to Azure" with no App Service mention — route to `azure-prepare`.

## Routing

This skill is the FIRST match for prompts containing **Python**, **Flask**, **Django**, or **FastAPI** + **App Service**. No codebase scan required at routing time.

| Situation | Skill |
|---|---|
| "Deploy my Python/Flask/Django/FastAPI app to App Service" | **python-appservice-deploy** ✅ |
| "Deploy my Python app to Container Apps" | `azure-prepare` |
| "Deploy Django on App Service with VNet + Postgres" | `azure-prepare` |
| "Deploy FastAPI on App Service with VNet + Key Vault" | `azure-prepare` |

If during execution the user clearly needs infrastructure beyond RG/Plan/WebApp, stop and hand off to `azure-prepare`.

## MCP Tools

| Tool | Purpose |
|---|---|
| `mcp_azure_mcp_subscription_list` | Discover subscription when missing |
| `mcp_azure_mcp_group_list` | List resource groups |
| `mcp_azure_mcp_appservice` | App Service operations |
| `mcp_azure_mcp_azd` | `azd` commands when an `azd` template is present |

## Workflow

| # | Action | Reference |
|---|---|---|
| 1 | Resolve Azure context with **smart defaults — minimize prompts**. Only the app name is interactive; everything else is derived. See [create-app.md](references/create-app.md) §1 for the rules. Show the defaults summary to the user before creating. | [create-app.md](references/create-app.md) |
| 2 | Detect framework (advisory). Scan `requirements.txt` / `pyproject.toml`. NEVER blocks deploy. | [detect.md](references/detect.md) |
| 3 | Choose path: `azure.yaml` targets App Service → **azd**; else **az CLI**. | [deploy-azd.md](references/deploy-azd.md) / [deploy-azcli.md](references/deploy-azcli.md) |
| 4 | Ensure resources exist: RG → Plan (`P0V3 --is-linux`) → Web App (`--runtime "PYTHON:3.14"` — colon form, never the pipe form). Skip if already present. **Silently retry transient ARM errors** (connection reset / 502 / 503 / 504) up to 2 times — see [create-app.md](references/create-app.md) §1f. | [create-app.md](references/create-app.md) |
| 5 | Set the startup command per [startup-commands.md](references/startup-commands.md): Flask / Django / **FastAPI on Python 3.14** → **no startup command** (Oryx auto-detects). **FastAPI on Python <3.14** → set `python -m uvicorn main:app --host 0.0.0.0`. Other frameworks → warn user, deploy anyway. NEVER blocks deploy. | [startup-commands.md](references/startup-commands.md) |
| 6 | Set `SCM_DO_BUILD_DURING_DEPLOYMENT=true`. | [deploy-azcli.md](references/deploy-azcli.md) |
| 7 | Deploy: `azd deploy` OR `az webapp deploy --type zip --track-status false`. ⛔ never `az webapp up`. ⛔ **Do NOT tail logs** and ⛔ **do NOT probe the endpoint** after deploy. | [deploy-azcli.md](references/deploy-azcli.md) |
| 8 | **STOP.** Print the post-deploy message ([post-deploy-message.md](references/post-deploy-message.md)) — use the **standard** template for Flask/Django/FastAPI, or the **unknown-framework** template (adds a "we couldn't detect your framework — set a startup command" warning) when Step 2 detected `wsgi-generic`, `asgi-generic`, or `unknown`. Include URL as `https://...`, "may take 2–3 minutes to start", and the `az webapp log tail` command. Then end the turn. | [post-deploy-message.md](references/post-deploy-message.md) |

> ⛔ **URL FORMAT RULE** — Always present endpoints as fully-qualified `https://` URLs.
>
> ⛔ **SHELL SAFETY RULE** — For `az webapp create --runtime`, always use the **colon** form `"PYTHON:3.14"`. **Never** use `"PYTHON|3.14"` — the pipe character is interpreted as a shell pipeline operator in PowerShell, Bash, and cmd, and breaks the command. Both forms are equivalent to the Azure CLI, but only colon is shell-safe.
>
> ⛔ **NO POST-DEPLOY VERIFICATION RULE** — After the deploy command returns, the skill is done. Do **NOT** run `az webapp log tail`, `curl`, `Invoke-WebRequest`, `wget`, or any other startup/health check. App Service routinely needs 2–3 minutes to warm the container; a quiet log stream or a 5xx in the first couple of minutes is **not** a failure signal. Print the message in [post-deploy-message.md](references/post-deploy-message.md) and stop. The user runs `az webapp log tail` themselves if they want to watch.

## Defaults

| Setting | Default |
|---|---|
| OS | Linux (cannot be overridden by this skill) |
| Plan SKU | P0v3 |
| Python | 3.14 |
| Flask startup | Not set — Oryx auto-detects Flask (no startup command needed) |
| Django startup | Not set — Oryx auto-detects Django via `wsgi.py` (no startup command needed) |
| FastAPI startup (Python 3.14) | Not set — Oryx auto-detects FastAPI on 3.14 |
| FastAPI startup (Python <3.14) | Auto-set: `python -m uvicorn main:app --host 0.0.0.0` (adjust `<module>:app` if entry point differs) |
| Non-Flask/Django/FastAPI startup | Not set — warn user (see [startup-commands.md](references/startup-commands.md)) |
| App name | Ask user once; if no answer, generate `<folder-slug>-<first-8-chars-of-new-GUID>` (lowercase, hyphens, ≤40 chars, globally unique) |
| Resource group | **Auto-derive** as `<app-name>-rg` — do NOT ask |
| App Service Plan | **Auto-derive** as `<app-name>-plan` — do NOT ask |
| Region | Reuse current az CLI default (`az config get defaults.location -o tsv`); else `eastus2`. Do NOT ask unless creation fails with a region/quota error. |
| Subscription | Use the active subscription from `az account show`; only ask if multiple are configured and none is current. |

## Error Handling

| Symptom | Fix |
|---|---|
| Plan/app `ResourceNotFound` | Step 4 creates them — re-run |
| `Container didn't respond to HTTP pings on port: 8000` | Set/correct startup-file ([startup-commands.md](references/startup-commands.md)) |
| Deploy ok, site returns 500 / `ModuleNotFoundError` | Ensure `SCM_DO_BUILD_DURING_DEPLOYMENT=true`, redeploy |
| `az webapp up` in user notes | Replace with Step 7 commands |

Full matrix: [errors.md](references/errors.md).

## References

- [detect.md](references/detect.md) — Framework detection (advisory)
- [create-app.md](references/create-app.md) — RG + Plan + Web App (Linux P0v3)
- [deploy-azd.md](references/deploy-azd.md) — azd path
- [deploy-azcli.md](references/deploy-azcli.md) — az CLI path (no `az webapp up`)
- [startup-commands.md](references/startup-commands.md) — Per-framework startup + manual fallback
- [post-deploy-message.md](references/post-deploy-message.md) — What to tell the user after deploy (no endpoint probing)
- [errors.md](references/errors.md) — Troubleshooting matrix
