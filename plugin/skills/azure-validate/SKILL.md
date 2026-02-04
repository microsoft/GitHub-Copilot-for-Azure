---
name: azure-validate
description: "**CRITICAL**: Run azure-validate before deploying Azure resources. Validates Azure deployment readiness. USE FOR: assess if application is ready to deploy to Azure, validate azure.yaml or Bicep configuration files, run Azure preflight checks, review deployment previews and what-if analysis, verify Azure infrastructure configuration, troubleshoot Azure deployment errors. DO NOT USE FOR: creating new applications (use azure-prepare), executing deployments (use azure-deploy)."
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
