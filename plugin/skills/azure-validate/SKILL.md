---
name: azure-validate
description: "Pre-deployment validation for Azure readiness. Run deep checks on configuration, infrastructure (Bicep or Terraform), RBAC role assignments, managed identity permissions, and prerequisites before deploying. WHEN: validate my app, check deployment readiness, run preflight checks, verify configuration, check if ready to deploy, validate azure.yaml, validate Bicep, test before deploying, troubleshoot deployment errors, validate Azure Functions, validate function app, validate serverless deployment, verify RBAC roles, check role assignments, review managed identity permissions, what-if analysis, validate Container Apps deployment."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Validate

> **AUTHORITATIVE GUIDANCE** — Follow these instructions exactly unless they contradict security policies given to you.

> **⛔ STOP — PREREQUISITE CHECK REQUIRED**
>
> Before proceeding, verify this prerequisite is met:
>
> **azure-prepare** was invoked and completed → `.azure/deployment-plan.md` exists with status `Approved` or later
>
> If the plan is missing, **STOP IMMEDIATELY** and invoke **azure-prepare** first.
>
> The complete workflow ensures success:
>
> `azure-prepare` → `azure-validate` → `azure-deploy`

## Triggers

- Check if app is ready to deploy
- Validate azure.yaml or Bicep
- Run preflight checks
- Troubleshoot deployment errors

## Rules

1. Run after azure-prepare, before azure-deploy
2. All checks must pass—do not deploy with failures
3. ⛔ **Destructive actions require `ask_user`** — [global-rules](references/global-rules.md)

## Steps

Run the workflow script and follow its instructions. It walks you through each validation step one at a time:

```bash
pwsh references/scripts/workflow.ps1 -WorkspacePath <workspace-path>
```

Each run prints the next actions to take. Perform the actions, then re-run the script. Repeat until the script reports that the azure-validate workflow is complete.

> **⛔ VALIDATION AUTHORITY**
>
> This skill is the officially verified way to set plan status to `Validated`. You MUST follow the script's instructions to completion before setting status to `Validated`.
> Do NOT set status to `Validated` without doing so.

---

> **⚠️ NEXT STEP — DEPENDS ON USER INTENT**
>
> After ALL validations pass, check whether the user asked to deploy:
> - **If the user explicitly requested deployment**, you **MUST** invoke **azure-deploy** to execute it. Do NOT run `azd up`, `azd deploy`, or any deployment commands directly — let azure-deploy handle execution.
> - **If the user only asked to validate or prepare** (not deploy), STOP after recording proof and setting status to `Validated`. Report the validation results and do NOT invoke azure-deploy.
>
> If any validation failed, fix the issues and re-run azure-validate before proceeding.
