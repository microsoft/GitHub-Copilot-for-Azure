---
name: azure-prepare
description: Prepare applications for Azure deployment. USE THIS SKILL when users want to create a new Azure app, add Azure deployment to existing projects, generate infrastructure as code (Bicep, Terraform, azure.yaml), set up Azure hosting, or modernize apps for Azure.
---

# Azure Prepare

Get an application ready for Azure deployment.

## Triggers

Activate when user wants to:
- Create a new application for Azure
- Add Azure deployment to an existing project
- Generate infrastructure as code

---

## CRITICAL RULES

**DO NOT SKIP STEPS.** Follow the workflow sequentially:

1. **ALWAYS gather requirements BEFORE generating artifacts** - Use the ask_user tool to confirm classification, scale, budget, and architecture preferences. Do not assume defaults without asking.

2. **ALWAYS use MCP tools** - Call `azure-deploy(command: "plan get")` and `azure-deploy(command: "iac rules get")` before generating infrastructure code.

3. **ALWAYS build the manifest progressively** - Create `.azure/preparation-manifest.md` at the START of the workflow and update it after EACH phase. Do not create it as a one-time static document at the end.

4. **NEVER proceed directly to deployment** - After preparation, you MUST invoke **azure-validate** skill and wait for validation to pass before any deployment.

5. **ALWAYS confirm with user** - Before generating artifacts, summarize your understanding of requirements and get explicit confirmation.

---

## Workflow

### Step 1: Analyze Workspace

Determine starting point. See [workflows/](references/workflows/).

If already has azure.yaml or infra/ → skip to **azure-validate**.

### Step 2: Gather Requirements

Collect project classification, scale, budget, compliance needs.

See [discovery/requirements-gathering.md](references/discovery/requirements-gathering.md)

### Step 3: Scan Codebase

Identify components, technologies, dependencies.

See [discovery/workspace-analysis.md](references/discovery/workspace-analysis.md)

### Step 4: Select Recipe

Choose deployment approach. **Default: AZD.**

See [recipe-selection.md](references/recipe-selection.md)

| Recipe | Link |
|--------|------|
| AZD | [recipes/azd.md](references/recipes/azd.md) |
| Bicep | [recipes/bicep.md](references/recipes/bicep.md) |
| Terraform | [recipes/terraform.md](references/recipes/terraform.md) |

### Step 5: Architecture Planning

Select hosting stack (Containers, Serverless, App Service).

See [architecture/stack-selection.md](references/architecture/stack-selection.md)

### Step 6: Service Mapping

Map components to Azure services.

See [architecture/service-mapping.md](references/architecture/service-mapping.md) and [services/](references/services/)

### Step 7: Generate Artifacts

**→ Load selected recipe** for generation steps.

### Step 8: Create Preparation Manifest

Document decisions in `.azure/preparation-manifest.md`.

See [manifest/preparation-manifest.md](references/manifest/preparation-manifest.md)

---

## ⚠️ MANDATORY NEXT STEP

**YOU MUST INVOKE azure-validate BEFORE ANY DEPLOYMENT.**

Do not proceed to azure-deploy until validation passes. No exceptions.

---

## Output Summary

| Artifact | Location |
|----------|----------|
| Preparation Manifest | `.azure/preparation-manifest.md` |
| Infrastructure | `./infra/` (Bicep or Terraform) |
| Configuration | `azure.yaml` (AZD only) |
| Dockerfiles | `src/<component>/Dockerfile` |
