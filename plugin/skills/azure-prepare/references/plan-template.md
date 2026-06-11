# Plan Template

Create `.azure/deployment-plan.md` using this template. This file is **mandatory** and serves as the source of truth for the entire workflow.

## ⛔ BLOCKING REQUIREMENTS

1. You **MUST** create this plan file BEFORE generating any code, infrastructure, or configuration.
2. You **MUST** complete Step 6 Phase 2 (Provisioning Limit Checklist) with NO "_TBD_" entries remaining before presenting the plan to the user.
3. Present the plan to the user and get approval before proceeding to execution.
4. You **MUST NOT** skip any part of the plan.

---

## Template

```markdown
# Azure Deployment Plan

> **Status:** Planning | Approved | Executing | Ready for Validation | Validated | Deployed

Generated: {timestamp}

---

## 1. Project Overview

**Goal:** {what the user wants to build/deploy}

**Path:** New Project | Add Components | Modernize Existing

---

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | POC / Development / Production |
| Scale | Small / Medium / Large |
| Budget | Cost-Optimized / Balanced / Performance |
| **Subscription** | {subscription-name-or-id} ⚠️ MUST confirm with user |
| **Location** | {azure-region} ⚠️ MUST confirm with user |

---

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| {name} | Frontend / API / Worker | {stack} | {path} |

---

## 4. Recipe Selection

**Selected:** AZD / AZCLI / Bicep / Terraform

**Rationale:** {why this recipe was chosen}

---

## 5. Architecture

**Stack:** Containers / Serverless / App Service

### Service Mapping

| Component | Azure Service | SKU |
|-----------|---------------|-----|
| {component} | {azure-service} | {sku} |

### Supporting Services

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | Monitoring & APM |
| Key Vault | Secrets management |
| Managed Identity | Service-to-service auth |

---

## 6. Provisioning Limit Checklist

**Purpose:** Validate that the selected subscription and region have sufficient quota/capacity for all resources to be deployed.

> **⚠️ REQUIRED:** This is a **TWO-PHASE** process. Complete both phases before proceeding.

### Phase 1: Prepare Resource Inventory

List all resources to be deployed with their types and quantities. Leave quota/limit columns empty.

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| {ARM-resource-type} | {count} | _To be filled in Phase 2_ | _To be filled in Phase 2_ | _To be filled in Phase 2_ |

**Example format:**

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| Microsoft.App/managedEnvironments | 1 | _TBD_ | _TBD_ | _TBD_ |
| Microsoft.Compute/virtualMachines (Standard_D4s_v3) | 3 | _TBD_ | _TBD_ | _TBD_ |
| Microsoft.Network/publicIPAddresses | 2 | _TBD_ | _TBD_ | _TBD_ |
| Microsoft.DocumentDB/databaseAccounts | 1 | _TBD_ | _TBD_ | _TBD_ |
| Microsoft.Storage/storageAccounts | 2 | _TBD_ | _TBD_ | _TBD_ |

### Phase 2: Fetch Quotas and Validate Capacity

**Action:** Populate the remaining columns with actual quota data. For **supported** providers, run the `check-quota` script; for **unsupported** providers, use the manual fallback. Invoke the **azure-quotas** skill if you need help mapping ARM resource types to quota resource names.

**Supported providers — run the script once for all of them:**

```bash
./scripts/check-quota.sh <region> \
  <provider:quota-name:count> [more triples...] \
  --subscription <subscription-id>
```
```powershell
.\scripts\check-quota.ps1 -Region <region> -SubscriptionId <subscription-id> -Resources `
  "<provider:quota-name:count>", "..."
```

The script returns one row per resource with limit, current usage, available capacity, total-after-deploy, and a status (✅ within / ⚠️ near limit / ❌ insufficient), plus an overall verdict — copy these directly into the table above. `count` is the **number of additional resources to deploy**, expressed in the quota's own unit (vCPUs for VM-family quotas, e.g. 3 additional × Standard_D4s_v3 = `12`; instance count otherwise). See [resources-limits-quotas.md → Scripts](resources-limits-quotas.md#scripts) for details and sample output.

**Unsupported providers** (script flags `⚠️ Unsupported`, or `az quota list` returns `BadRequest` — e.g. Microsoft.DocumentDB):

1. **Get current usage**: `az graph query -q "resources | where type == '{resource-type}' and location == '{location}' | count"` (requires `az extension add --name resource-graph`)
2. **Get limit**: [Azure service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
3. **Calculate total** - Total After Deployment = current usage + Number to Deploy; verify ≤ limit

**Document source** for each row - e.g. "check-quota script (quota-name)" or "Azure Resource Graph + Official docs".

**Completed example:**

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| Microsoft.App/managedEnvironments | 1 | 1 | 50 | Fetched from: check-quota script (ManagedEnvironmentCount) |
| Microsoft.Compute/virtualMachines (Standard_D4s_v3) | 3 | 15 | 350 vCPUs | Fetched from: check-quota script (standardDSv3Family) |
| Microsoft.Network/publicIPAddresses | 2 | 5 | 100 | Fetched from: check-quota script (PublicIPAddresses) |
| Microsoft.DocumentDB/databaseAccounts | 1 | 1 | 50 per region | Fetched from: Official docs (quota CLI not supported) |
| Microsoft.Storage/storageAccounts | 2 | 8 | 250 per region | Fetched from: Official docs |

**Status:** ✅ All resources within limits | ⚠️ Near limit (>80%) | ❌ Insufficient capacity

> **⛔ CRITICAL:** You **CANNOT** present this plan to the customer if ANY cells contain "_TBD_" or "_To be filled in Phase 2_". Phase 2 **MUST** be completed with actual quota data before user presentation.

**Notes:**
- **Use the `check-quota` script** for supported providers (Microsoft.Compute, Microsoft.Network, Microsoft.App, etc.); invoke the **azure-quotas** skill if you need help mapping ARM types to quota resource names
- Azure quota CLI is **ALWAYS preferred over REST API** for checking quotas
- **ONLY for unsupported providers** (e.g., Microsoft.DocumentDB returns `BadRequest`), use fallback methods: [Azure service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
- If any resource exceeds limits, return to Step 2 to select a different region or request quota increase

---

## 7. Execution Checklist

### Phase 1: Planning
- [ ] Analyze workspace
- [ ] Gather requirements
- [ ] Confirm subscription and location with user
- [ ] Prepare resource inventory (Step 6 Phase 1: list resource types and deployment quantities)
- [ ] Fetch quotas and validate capacity (Step 6 Phase 2: invoke azure-quotas skill to use quota CLI)
- [ ] Scan codebase
- [ ] Select recipe
- [ ] Plan architecture
- [ ] **User approved this plan**

### Phase 2: Execution
- [ ] Research components (load references, invoke skills)
- [ ] **⛔ For Azure Functions: Load composition rules** (`services/functions/templates/selection.md` → `services/functions/templates/recipes/composition.md`) and use `functions_template_get` MCP tool to list and fetch templates, then write `functionFiles[]` + `projectFiles[]` directly — NEVER hand-write Bicep/Terraform and use `azd init -t <template>`/`func init`/`func new` as fallback when composing multiple recipes and required templates are not found
- [ ] For other services: Generate infrastructure files following service-specific guidance
- [ ] Apply recipes for integrations (if needed)
- [ ] Generate application configuration
- [ ] Generate Dockerfiles (if containerized)
- [ ] **⛔ Update plan status to "Ready for Validation"** — Use the `edit` tool to change the Status line in `.azure/deployment-plan.md`. This step is MANDATORY before invoking azure-validate.

### Phase 3: Validation
- [ ] **PREREQUISITE:** Plan status MUST be "Ready for Validation" (Phase 2 last step)
- [ ] Invoke azure-validate skill
- [ ] All validation checks pass
  - [ ] _Replace this with recipe validation steps_
- [ ] Update plan status to "Validated"
- [ ] Record validation proof below

### Phase 4: Deployment
- [ ] Invoke azure-deploy skill
- [ ] Deployment successful
- [ ] Report deployed endpoint URLs
- [ ] Update plan status to "Deployed"

---

## 7. Validation Proof

> **⛔ REQUIRED**: The azure-validate skill MUST populate this section before setting status to `Validated`. If this section is empty and status is `Validated`, the validation was bypassed improperly.

| Check | Command Run | Result | Timestamp |
|-------|-------------|--------|-----------|
| {check-name} | {actual command executed} | ✅ Pass / ❌ Fail | {timestamp} |

**Validated by:** azure-validate skill
**Validation timestamp:** {timestamp}

---

## 8. Files to Generate

| File | Purpose | Status |
|------|---------|--------|
| `.azure/deployment-plan.md` | This plan | ✅ |
| `azure.yaml` | AZD configuration | ⏳ |
| `infra/main.bicep` | Infrastructure | ⏳ |
| `src/{component}/Dockerfile` | Container build | ⏳ |

---

## 9. Next Steps

> Current: {current phase}

1. {next action}
2. {following action}
```

---

## Instructions

1. **Create the plan first** — Fill in all sections based on analysis
2. **Complete quota validation** — Ensure Step 6 Phase 2 is completed with NO "_TBD_" entries. **MUST use azure-quotas skill** as the primary method to fetch actual quota/usage data via quota CLI (`az quota` commands) for all resources. Use fallback methods ONLY when provider returns `BadRequest`.
3. **Present to user** — Show the completed plan and ask for approval. **DO NOT** present if Step 6 contains any "_TBD_" or "_To be filled in Phase 2_" entries.
4. **Update as you go** — Check off items in the execution checklist
5. **Track status** — Update the Status field at the top as you progress

The plan is the **single source of truth** for azure-validate and azure-deploy skills.
