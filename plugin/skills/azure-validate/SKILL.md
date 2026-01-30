---
name: azure-validate
description: Validate deployment readiness before shipping to Azure. USE THIS SKILL when users want to check if their app is ready to deploy, validate azure.yaml or Bicep configuration, run preflight checks, test deployment preview, or troubleshoot deployment errors.
---

# Azure Validate

Verify deployment readiness before shipping to Azure.

## Triggers

Activate when user wants to:
- Check if their app is ready to deploy
- Validate configuration
- Run preflight checks
- Troubleshoot deployment errors

---

## CRITICAL RULES

**VALIDATION IS MANDATORY BEFORE DEPLOYMENT.**

1. **NEVER skip validation** - This skill MUST be run after azure-prepare and BEFORE azure-deploy. No exceptions.

2. **ALL checks must pass** - Do not proceed to deployment with partial success. Every validation must pass.

3. **Fix issues before continuing** - If validation fails, resolve ALL issues and re-run validation. Do not attempt deployment with known failures.

4. **Block deployment on failure** - If user tries to skip validation or deploy with failures, refuse and explain the risks.

---

## Workflow

### Step 1: Load Preparation Manifest

Read `.azure/preparation-manifest.md` for recipe and component info.

If no manifest → run **azure-prepare** first.

### Step 2: Identify Recipe

Use the recipe from manifest:

| Recipe | Link |
|--------|------|
| AZD | [recipes/azd.md](references/recipes/azd.md) |
| Bicep | [recipes/bicep.md](references/recipes/bicep.md) |
| Terraform | [recipes/terraform.md](references/recipes/terraform.md) |

### Step 3: Validate Prerequisites

Check Azure authentication and subscription.

See [checks/prerequisites.md](references/checks/prerequisites.md)

### Step 4: Run Recipe Validation

**→ Load selected recipe** for validation steps.

**All checks must pass.**

### Step 5: Resolve Issues

Fix failures before proceeding. See [error-handling/](references/error-handling/)

### Step 6: Update Manifest

Set status to `Validated` with results.

---

## ⚠️ MANDATORY NEXT STEP

**Only after ALL validations pass** → proceed to **azure-deploy**.

Do not deploy with any validation failures.
