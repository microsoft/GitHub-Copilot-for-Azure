# Preflight Checks

Pre-deployment validation steps. Run after user approval, before deployment execution.

> **Source:** Adapted from the azure-deploy pre-deploy checklist. AppOnboard runs direct deployment (no `azd`).

## Check Sequence

Branch on `scaffold-manifest.json.iacFormat`:

### 0. Auth Token Verification

```bash
az account show
```

- Success → proceed. Active subscription + tenant confirmed.
- Failure → `ENVIRONMENT_BLOCKING`. Suggest `az login` (plain, no scope).
- ⛔ NEVER suggest `az login --scope https://graph.microsoft.com/.default` — Graph scope is irrelevant for ARM deployments.

### 1. IaC Syntax Validation

#### Bicep (default)

```bash
bicep build infra/main.bicep --stdout > /dev/null
```

- Exit 0 → pass. Non-zero → `IAC_ERROR` — route to scaffold for fix.
- Catches: invalid API versions, unknown resource types, property errors, syntax issues.

#### Terraform (alternative)

```bash
cd infra && terraform init -backend=false
terraform validate
```

- Exit 0 → pass. Non-zero → `IAC_ERROR` — route to scaffold for fix.
- Catches: unknown resources, invalid attributes, provider version conflicts, syntax issues.

### 2. Deployment Preview

⛔ **MANDATORY — do NOT skip this step.** The `--what-if` / `terraform plan` output catches destructive changes (deletes, replacements) that are invisible in syntax validation alone. Even if scaffold ran `--what-if` at Step 12, IaC may have changed since (Step 2 safety-net fixes, user edits, healing retries). Skipping deployment preview leads to avoidable failures. If the preview command itself fails (auth error, unsupported resource type), log the failure and warn the user — but do NOT silently skip to execution.

#### Bicep (subscription scope)

```bash
az deployment sub what-if \
  --name "{deploymentName}" \
  --location {location} \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --subscription {subscriptionId} \
  --what-if-result-format FullResourcePayloads
```

#### Bicep (resource-group scope)

```bash
az deployment group create \
  --resource-group {rg} \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --subscription {subscriptionId} \
  --what-if \
  --what-if-result-format FullResourcePayloads
```

- Review changes: `Create`, `Modify`, `Delete`, `NoChange`.
- Surface any `Delete` operations as warnings — user must acknowledge.
- If what-if fails with auth error → `ENVIRONMENT_BLOCKING`.

#### Terraform

```bash
terraform plan -out=tfplan -detailed-exitcode
```

- Exit 0 → no changes. Exit 2 → changes detected (normal). Exit 1 → error.
- Review planned changes: `create`, `update`, `destroy`.
- Surface any `destroy` operations as warnings — user must acknowledge.
- If plan fails with auth error → `ENVIRONMENT_BLOCKING`.

### 3. RBAC Permission Check

```bash
az role assignment list \
  --assignee {currentUserObjectId} \
  --scope /subscriptions/{sub}/resourceGroups/{rg} \
  --query "[].roleDefinitionName" -o tsv
```

Required: `Contributor` or `Owner` on the target resource group. If missing → `ENVIRONMENT_BLOCKING` with remediation command.

### 4. SKU Quota Verification

⛔ **`what-if` does NOT catch App Service quota errors.** `az deployment sub what-if` returns `Succeeded` even when the target SKU has limit=0. The quota rejection only surfaces at actual `az deployment sub create` time.

If `prepare-plan.json.quotaValidation.verified == true` → quota was confirmed at prepare time via direct API check. Proceed to Step 6.

If `quotaValidation.verified == false` or `method == "unverifiable"` → **⛔ you MUST read [sku-quota-validation.md](../../prepare/references/sku-quota-validation.md)** and run a direct quota check NOW. Do not guess quota commands — the reference contains per-provider API patterns, anti-patterns to avoid, and offer restriction checks. If the check shows limit=0, HALT and present region fallback options.

⛔ **If `SubscriptionIsOverQuotaForSku` appears in `az deployment sub create` output, HALT.** Read `prepare-plan.json.quotas[]` for `currentUsage` and `currentLimit`. If `currentLimit == 0`, the SKU is not available in this region — skip straight to region fallback. Skip regions already listed in `quotaValidation.checkedRegions` that had zero availability.

#### Offer Restriction Check (Database Services)

If `prepare-plan.json.quotaValidation.offerRestrictions[]` exists and shows `blocked: true` for the target region → HALT immediately, present region fallback from `quotaValidation.checkedRegions` where `blocked == false`.

If `offerRestrictions` is missing (prepare didn't check) and `prepare-plan.json.services[]` includes `Microsoft.DBforPostgreSQL` or `Microsoft.DBforMySQL` → **run the capabilities check NOW.** See [sku-quota-validation.md § Offer Restriction Check](../../prepare/references/sku-quota-validation.md) for the `az rest` commands and anti-patterns.

If `LocationIsOfferRestricted` appears in `az deployment sub create` or `az deployment group create` output → `ENVIRONMENT_BLOCKING`. See [error-classification.md](error-classification.md).

### 5. Resource Group Existence

```bash
az group show --name {rg} --query "location" -o tsv 2>/dev/null
```

- Exists → verify location matches `prepare-plan.json` region. Mismatch → warn.
- Not exists → will be created by deployment (if `main.bicep` has subscription scope).

### 6. Key Vault Soft-Delete Collision

If `prepare-plan.json.services[]` includes a Key Vault:

```bash
az keyvault list-deleted --query "[?name=='{kvName}'].{name:name, location:properties.location}" -o table
```

- **Match found** → soft-deleted KV with same name blocks creation. Two options:
  1. Purge: `az keyvault purge --name {kvName}` (permanent, requires Purge permission)
  2. Use different name: append new suffix to `prepare-plan.json.naming.resources[]` KV entry, update Bicep parameter
- **No match** → proceed.

## Error Handling

Continue-on-error philosophy: each check runs independently. Collect all results, then present structured report.

| Check | Fail Behavior |
|-------|---------------|
| IaC validation (`terraform validate` / `bicep build`) | Block deploy. Route to scaffold. |
| Deployment preview (`terraform plan` / `what-if`) | Warn but don't block (can fail on unsupported resource types). |
| RBAC | Block deploy. Surface `az role assignment create` command. |
| RG check | Warn on location mismatch. Don't block. |
| KV soft-delete | Block deploy. Surface purge command or rename. |

## Report Format

```
## Preflight Results
✅ IaC syntax: valid (terraform validate / bicep build)
⚠️ Deployment preview: 3 creates, 0 destroys, 1 update
✅ RBAC: Contributor role confirmed
✅ Resource group: rg-myapp-dev (eastus2)
```
