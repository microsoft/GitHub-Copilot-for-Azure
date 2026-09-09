---
name: azure-prepare
description: "Prepare azd-based Azure projects for deployment: generates azure.yaml, infrastructure (Bicep/Terraform), and Dockerfiles for the Azure Developer CLI (azd) workflow. USE ONLY when the user explicitly wants to use azd as the deployment tool, or the project already has an azure.yaml file. DO NOT USE FOR: non-azd deployments, Python App Service code-only deploys (use python-appservice-deploy), or cross-cloud migration (use azure-cloud-migrate). WHEN: prepare app for azd, create azure.yaml, set up azd infrastructure, modernize app for Azure with azd, deploy with azd, function app, timer trigger, service bus trigger, event-driven function, managed identity, generate Bicep, generate Terraform, create and deploy to Azure."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Prepare

> **AUTHORITATIVE GUIDANCE** — Follow these instructions exactly unless they contradict security policies given to you.

## Quick Reference

| Property | Value |
|----------|-------|
| Scope | Generate application, infrastructure, and azd configuration artifacts |
| Source of truth | `.azure/deployment-plan.md` |
| Progress file | `.azure/prepare-status.json` |
| Windows workflow | [references/scripts/workflow.ps1](references/scripts/workflow.ps1) |
| macOS/Linux workflow | [references/scripts/workflow.sh](references/scripts/workflow.sh) |
| Required handoff | `azure-prepare` → `azure-validate` → `azure-deploy` |

## Rules

1. **Plan first** — The workflow script's first action creates `.azure/deployment-plan.md` in the workspace root. Do not generate code, infrastructure, or configuration before this file exists.
2. **Approval required** — Do not execute the finalized plan until the user explicitly approves it.
3. **Preparation only** — Never run `azd up`, `azd deploy`, `terraform apply`, or another deployment command directly.
4. **Confirm Azure context** — Use `ask_user` to confirm subscription and location when instructed.
5. **Destructive actions require `ask_user`** — Follow [global rules](references/global-rules.md).
6. **Never delete the project or workspace directory.** Use `azd init -t <template>` only for new projects. Do not remove user-authored IaC.
7. **SQL Server Bicep** — Never generate `administratorLogin` or `administratorLoginPassword`. Always use Entra-only authentication (`azureADOnlyAuthentication: true`) as specified by the [SQL Database reference](references/services/sql-database/bicep.md).
8. **Terraform conversion** — Remove only template-provided Bicep that the completed Terraform implementation replaces.

## Steps

Run the workflow script and follow its instructions. It reveals one preparation step at a time and records progress in `.azure/prepare-status.json`.

Run commands from the **azure-prepare skill root**. Start without the completed-step argument:

```bash
pwsh references/scripts/workflow.ps1 -WorkspacePath <workspace-path>
# macOS/Linux: bash references/scripts/workflow.sh --workspace-path <workspace-path>
```

Each run prints:

- the next action;
- the reference to load for that action; and
- the value to pass after completing it.

Perform only that action, then re-run with the returned value:

```bash
pwsh references/scripts/workflow.ps1 -WorkspacePath <workspace-path> -CompletedStep <value>
# macOS/Linux: bash references/scripts/workflow.sh --workspace-path <workspace-path> --completed-step <value>
```

Repeat until the script reports that preparation is complete. If a specialized skill is invoked, resume this workflow at the step instructed by the script.

> **⛔ WORKFLOW AUTHORITY**
>
> Do not skip steps or infer later actions from prior knowledge. Follow the script to completion. Before handoff, `.azure/deployment-plan.md` must have status `Ready for Validation`.

## Reference Entry Points

Load only the reference named by the workflow script:

- Planning: [specialized routing](references/specialized-routing.md), [workspace analysis](references/analyze.md), [requirements](references/requirements.md), [codebase scan](references/scan.md), [recipe selection](references/recipe-selection.md), [architecture](references/architecture.md), and [plan template](references/plan-template.md)
- Execution: [research](references/research.md), [Azure context](references/azure-context.md), [generation](references/generate.md), [security](references/security.md), and [functional verification](references/functional-verification.md)
- Specialized guidance: [APIM](references/apim.md), [Durable Functions](references/services/functions/durable.md), [Durable Task Scheduler](references/services/durable-task-scheduler/README.md), and [DTS Bicep](references/services/durable-task-scheduler/bicep.md)
- SDKs: [azd](references/sdk/azd-deployment.md), Azure Identity for [Python](references/sdk/azure-identity-py.md), [.NET](references/sdk/azure-identity-dotnet.md), [TypeScript](references/sdk/azure-identity-ts.md), and [Java](references/sdk/azure-identity-java.md), plus App Configuration for [Python](references/sdk/azure-appconfiguration-py.md), [TypeScript](references/sdk/azure-appconfiguration-ts.md), and [Java](references/sdk/azure-appconfiguration-java.md)

## Next

When the workflow completes, invoke **azure-validate**. Do not invoke **azure-deploy** or run deployment commands directly.
