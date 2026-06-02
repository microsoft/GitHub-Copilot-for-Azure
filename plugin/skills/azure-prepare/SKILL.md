---
name: azure-prepare
description: "Prepare Azure apps for deployment (infra Bicep/Terraform, azure.yaml, Dockerfiles). Use for create/modernize or create+deploy; not cross-cloud migration (use azure-cloud-migrate). DO NOT USE FOR: copilot-sdk apps (use azure-hosted-copilot-sdk), Python or Flask + App Service deployments (use python-appservice-deploy). WHEN: \"create app\", \"build web app\", \"create API\", \"create serverless HTTP API\", \"create frontend\", \"create back end\", \"build a service\", \"modernize application\", \"update application\", \"add authentication\", \"add caching\", \"host on Azure\", \"create and deploy\", \"deploy to Azure\", \"deploy to Azure using Terraform\", \"deploy to Azure App Service\", \"deploy to Azure Container Apps\", \"generate Terraform\", \"generate Bicep\", \"function app\", \"timer trigger\", \"service bus trigger\", \"event-driven function\", \"containerized Node.js app\", \"social media app\", \"static portfolio website\", \"todo list with frontend and API\", \"prepare my Azure application to use Key Vault\", \"managed identity\"."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Prepare

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This document is the **official, canonical source** for preparing applications for Azure deployment. You **MUST** follow these instructions exactly as written unless they contradict security policies given to you. When in doubt, present the conflicting instructions from this document and ask the user for explicit confirmation. Do not improvise, infer, or substitute steps.

---

## Triggers

Activate this skill when user wants to:
- Create a new application
- Add services or components to an existing app
- Make updates or changes to existing application
- Modernize or migrate an application
- Set up Azure infrastructure
- Deploy to Azure or host on Azure
- Create and deploy to Azure (including Terraform-based deployment requests)

## Rules

1. **Plan first — MANDATORY** — You MUST physically write an initial `.azure/deployment-plan.md` **skeleton in the workspace root directory** (not the session-state folder) **as your very first action** — before any code generation or execution begins. Write the skeleton immediately, then populate it progressively as Phase 1 analysis and research unfold; finalize it with all decisions at Phase 1 Step 6. This file must exist on disk throughout. azure-validate and azure-deploy depend on it and will fail without it. Do not skip or defer this step.
2. **Get approval** — Present plan to user before execution
3. **Research before generating** — Load references and invoke related skills
4. **Update plan progressively** — Mark steps complete as you go
5. **Validate before deploy** — Invoke azure-validate before azure-deploy
6. **Confirm Azure context** — Use `ask_user` for subscription and location per [Azure Context](references/azure-context.md)
7. ❌ **Destructive actions require `ask_user`** — [Global Rules](references/global-rules.md)
8. ⛔ **NEVER delete user project or workspace directories** — When adding features to an existing project, MODIFY existing files. `azd init -t <template>` is for NEW projects only; do NOT run `azd init -t` in an existing workspace. Plain `azd init` (without a template argument) may be used in existing workspaces when appropriate. File deletions within a project (e.g., removing build artifacts or temp files) are permitted when appropriate, but NEVER delete the user's project or workspace directory itself. See [Global Rules](references/global-rules.md).
9. **Scope: preparation only** — This skill generates infrastructure code and configuration files. Deployment execution (`azd up`, `azd deploy`, `terraform apply`) is handled by the **azure-deploy** skill, which provides built-in error recovery and deployment verification.
10. ⛔ **SQL Server Bicep: NEVER generate `administratorLogin` or `administratorLoginPassword`** — not in direct properties, not in conditional/ternary branches, not anywhere in the file. Always use Entra-only authentication (`azureADOnlyAuthentication: true`) unconditionally. See [references/services/sql-database/bicep.md](references/services/sql-database/bicep.md).
11. **Remove stale template IaC after conversion** — If you converted Bicep templates from the selected `azd` template into Terraform templates, remove the Bicep templates that were introduced by that `azd` template and are now fully replaced by Terraform equivalents. Do not remove user-authored Bicep files. Only remove those template-provided Bicep files after the Terraform IaC is complete and Terraform has been selected as the deployment path. Before handing off to azure-validate skill, keep only the IaC templates required by the chosen deployment path.

---

## ❌ PLAN-FIRST WORKFLOW — MANDATORY

> **YOU MUST CREATE A PLAN BEFORE DOING ANY WORK**
>
> 1. **STOP** — Do not generate any code, infrastructure, or configuration yet
> 2. **CREATE SKELETON** - Write an initial `.azure/deployment-plan.md` skeleton to disk **immediately** (before any code generation or execution begins), then populate it progressively as Phase 1 steps 1-5 reveal details; finalize it at Step 6
> 3. **CONFIRM** — Present the completed plan to the user and get approval
> 4. **EXECUTE** — Only after approval, execute the plan step by step
>
> The `.azure/deployment-plan.md` file is the **source of truth** for this workflow and for azure-validate and azure-deploy skills. Without it, those skills will fail.
>
> ⚠️ **CRITICAL: `.azure/deployment-plan.md` must be WRITTEN TO DISK inside the workspace root** (e.g., `/tmp/my-project/.azure/deployment-plan.md`), not in the session-state folder. Use a file-write tool to create this file. This is the deployment plan artifact read by azure-validate and azure-deploy. **You MUST create this file — do not proceed without it.** 
> ⚠️ **CRITICAL: You must create the file with the name `.azure/deployment-plan.md` as is**. You must not use other names such as `.azure/plan.md`.
>
> ⛔ **Critical:** Skipping the plan file creation will cause azure-validate and azure-deploy to fail. This requirement has no exceptions.

---

## ❌ STEP 0: Specialized Technology Check — MANDATORY FIRST ACTION

**BEFORE starting Phase 1**, check if the user's prompt OR workspace codebase matches a specialized technology that has a dedicated skill with tested templates. If matched, **invoke that skill FIRST** — then resume azure-prepare for validation and deployment.

### Check 1: Prompt keywords

| Prompt keywords | Invoke FIRST |
|----------------|-------------|
| Python + App Service (e.g., "deploy Python to App Service", "Flask on Azure App Service", "publish Python web app to App Service") | **python-appservice-deploy** |
| Lambda, AWS Lambda, migrate AWS, migrate GCP, Lambda to Functions, migrate from AWS, migrate from GCP | **azure-cloud-migrate** |
| copilot SDK, copilot app, copilot-powered, @github/copilot-sdk, CopilotClient | **azure-hosted-copilot-sdk** |
| Azure Functions, function app, serverless function, timer trigger, HTTP trigger, func new | Stay in **azure-prepare** — prefer Azure Functions templates in Step 4 |
| APIM, API Management, API gateway, deploy APIM | Stay in **azure-prepare** — see [APIM Deployment Guide](references/apim.md) |
| AI gateway, AI gateway policy, AI gateway backend, AI gateway configuration | **azure-aigateway** |
| workflow, orchestration, multi-step, pipeline, fan-out/fan-in, saga, long-running process, durable, order processing | Stay in **azure-prepare** — select **durable** recipe in Step 4. **MUST** load [durable.md](references/services/functions/durable.md), [DTS reference](references/services/durable-task-scheduler/README.md), and [DTS Bicep patterns](references/services/durable-task-scheduler/bicep.md). |

### Check 2: Codebase markers (even if prompt is generic like "deploy to Azure")

| Codebase marker | Where | Invoke FIRST |
|----------------|-------|-------------|
| `@github/copilot-sdk` in dependencies | `package.json` | **azure-hosted-copilot-sdk** |
| `copilot-sdk` in name or dependencies | `package.json` | **azure-hosted-copilot-sdk** |
| `CopilotClient` import | `.ts`/`.js` source files | **azure-hosted-copilot-sdk** |
| `createSession` + `sendAndWait` calls | `.ts`/`.js` source files | **azure-hosted-copilot-sdk** |

> ⚠️ Check the user's **prompt text** — not just existing code. Critical for greenfield projects with no codebase to scan. See [full routing table](references/specialized-routing.md).

After the specialized skill completes, **resume azure-prepare** at Phase 1 Step 4 (Select Recipe) for remaining infrastructure, validation, and deployment.

---

## Phase 1: Planning (BLOCKING — Complete Before Any Execution)

Create `.azure/deployment-plan.md` by completing these steps. Do NOT generate any artifacts until the plan is approved.

| # | Action | Reference |
|---|--------|-----------|
| 0 | **❌ Check Prompt AND Codebase for Specialized Tech** — If user mentions copilot SDK, Azure Functions, etc., OR codebase contains `@github/copilot-sdk`, invoke that skill first | [specialized-routing.md](references/specialized-routing.md) |
| 1 | **Analyze Workspace** — Determine mode: NEW, MODIFY, or MODERNIZE | [analyze.md](references/analyze.md) |
| 2 | **Gather Requirements** — Classification, scale, budget | [requirements.md](references/requirements.md) |
| 3 | **Scan Codebase** — Identify components, technologies, dependencies | [scan.md](references/scan.md) |
| 4 | **Select Recipe** — Choose AZD (default), AZCLI, Bicep, or Terraform | [recipe-selection.md](references/recipe-selection.md) |
| 5 | **Plan Architecture** — Select stack + map components to Azure services | [architecture.md](references/architecture.md) |
| 6 | **Finalize Plan (MANDATORY)** - Use a file-write tool to finalize `.azure/deployment-plan.md` with all decisions from steps 1-5. Update the skeleton written at the start of Phase 1 with the complete content. The file must be fully populated before you present the plan to the user. | [plan-template.md](references/plan-template.md) |
| 7 | **Present Plan** — Show plan to user and ask for approval | `.azure/deployment-plan.md` |
| 8 | **Destructive actions require `ask_user`** | [Global Rules](references/global-rules.md) |

---

> **❌ STOP HERE** — Do NOT proceed to Phase 2 until the user approves the plan.

---

## Phase 2: Execution (Only After Plan Approval)

Execute the approved plan. Update `.azure/deployment-plan.md` status after each step.

| # | Action | Reference |
|---|--------|-----------|
| 1 | **Research Components** — Load service references + invoke related skills | [research.md](references/research.md) |
| 2 | **Confirm Azure Context** — Detect and confirm subscription + location and check the resource provisioning limit | [Azure Context](references/azure-context.md) |
| 3 | **Generate Artifacts** — Create infrastructure and configuration files | [generate.md](references/generate.md) |
| 4 | **Harden Security** — Apply security best practices | [security.md](references/security.md) |
| 5 | **Functional Verification** — Verify the app works (UI + backend), locally if possible | [functional-verification.md](references/functional-verification.md) |
| 6 | **⛔ Update Plan (MANDATORY before hand-off)** — Use the `edit` tool to change the Status in `.azure/deployment-plan.md` to `Ready for Validation`. You **MUST** complete this edit **BEFORE** invoking azure-validate. Do NOT skip this step. | `.azure/deployment-plan.md` |
| 7 | **⛔ MANDATORY Hand Off** — Invoke **azure-validate** skill. Your preparation work is done. Do NOT run `azd up`, `azd deploy`, or any deployment command directly — all deployment execution is handled by azure-deploy after azure-validate completes. **PREREQUISITE:** Step 6 must be completed first — `.azure/deployment-plan.md` status must say `Ready for Validation`. | — |

---

## Outputs

| Artifact | Location |
|----------|----------|
| **Plan** | `.azure/deployment-plan.md` |
| Infrastructure | `./infra/` |
| AZD Config | `azure.yaml` (AZD only) |
| Dockerfiles | `src/<component>/Dockerfile` |

---

## SDK Quick References

- **Azure Developer CLI**: [azd](references/sdk/azd-deployment.md)
- **Azure Identity**: [Python](references/sdk/azure-identity-py.md) | [.NET](references/sdk/azure-identity-dotnet.md) | [TypeScript](references/sdk/azure-identity-ts.md) | [Java](references/sdk/azure-identity-java.md)
- **App Configuration**: [Python](references/sdk/azure-appconfiguration-py.md) | [TypeScript](references/sdk/azure-appconfiguration-ts.md) | [Java](references/sdk/azure-appconfiguration-java.md)

---

## Next

> **⛔ MANDATORY NEXT STEP — DO NOT SKIP**
>
> After completing preparation, you **MUST** invoke **azure-validate** before any deployment attempt. Do NOT skip validation. Do NOT go directly to azure-deploy. Do NOT run `azd up` or any deployment command directly. The workflow is:
>
> `azure-prepare` → `azure-validate` → `azure-deploy`
>
> **⛔ BEFORE invoking azure-validate**, you MUST use the `edit` tool to update `.azure/deployment-plan.md` status to `Ready for Validation`. If the plan status has not been updated, the validation will fail.
>
> This applies to ALL deployment scenarios including containerized apps, Container Apps, App Service, Azure Functions, static sites, and any other Azure target. No exceptions.
>
> Skipping validation leads to deployment failures. Be patient and follow the complete workflow for the highest success outcome.

**→ Update plan status to `Ready for Validation`, then invoke azure-validate**
