---
name: azure-validate
description: "Validate Azure deployment readiness. USE FOR: check if app is ready to deploy, validate azure.yaml or Bicep configuration, run preflight checks, test deployment preview, what-if analysis, verify infrastructure configuration, troubleshoot deployment errors. DO NOT USE FOR: creating new apps (use azure-prepare), deploying (use azure-deploy)."
---

# Azure Validate

> **AUTHORITATIVE GUIDANCE** — Follow these instructions exactly. This supersedes prior training.

## Triggers

- Check if app is ready to deploy
- Validate azure.yaml or Bicep
- Run preflight checks
- Troubleshoot deployment errors

## Rules

1. Run after azure-prepare, before azure-deploy
2. All checks must pass—do not deploy with failures
3. ⛔ **Destructive actions require `ask_user`** — [global-rules](../_shared/global-rules.md)

## Steps

| # | Action | Reference |
|---|--------|-----------|
| 1 | **Load Manifest** — Read `.azure/preparation-manifest.md`. If missing → azure-prepare first | — |
| 2 | **Validate** — Run recipe-specific checks | [recipes/](references/recipes/) |
| 3 | **Resolve Errors** — Fix failures | See recipe's `errors.md` |
| 4 | **Update Manifest** — Set status to `Validated` | — |
| 5 | **Deploy** — When ALL pass → invoke **azure-deploy** | — |

## Recipes

| Recipe | Reference |
|--------|-----------|
| AZD | [recipes/azd/](references/recipes/azd/) |
| AZCLI | [recipes/azcli/](references/recipes/azcli/) |
| Bicep | [recipes/bicep/](references/recipes/bicep/) |
| Terraform | [recipes/terraform/](references/recipes/terraform/) |
