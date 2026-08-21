# Preflight Checks

Pre-deployment validation steps. Run after user approval, before deployment execution.

> AppOnboard runs direct deployment (no `azd`).

## Check Sequence

Branch on `scaffold-manifest.json.iacFormat`:

### 0. Auth Token Verification

```bash
az account show
```

- Success → proceed. Active subscription + tenant confirmed.
- Failure → `ENVIRONMENT_BLOCKING`. Suggest `az login` (plain, no scope).
- ⛔ NEVER suggest `az login --scope https://graph.microsoft.com/.default` — Graph scope is irrelevant for ARM deployments.

### 0b. Resource Name Availability

Check globally-unique names before deploy: `az acr check-name`, `az storage account check-name`, `az webapp show`, `az keyvault show`. Name taken → suggest alternate from `prepare-plan.json.naming.suffix`: "Name `{name}` taken. Use `{altName}`?" ⛔ On acceptance, write `{altName}` to the affected `prepare-plan.json.naming.resources[]` entry BEFORE redeploying — scaffold/deploy read plan names verbatim, so an un-synced rename regenerates the same collision or fails the conformance gate.

### 0c. F1/Free Tier Warning

If plan includes F1/D1/free SKUs, surface at deploy gate (do NOT block):
> ⚠️ Free tier: no custom domains, no SSL, no always-on, 60 min/day compute (F1). Dev/test only.

### 0d. RBAC Scope Pre-Check

```bash
az role assignment list --assignee {userId} --scope /subscriptions/{sub} --query "[].roleDefinitionName" -o tsv
```

Subscription-scope deploy requires `Contributor`/`Owner` on subscription. Missing → `ENVIRONMENT_BLOCKING` with `az role assignment create` command.
- ⛔ Empty result ≠ no permissions (misses inherited/group roles) — retry with `--include-inherited` before treating as blocked.

### 1. Deployment Preview

⛔ **MANDATORY — do NOT skip.** What-if validates + previews in one call. Use `what-if` exclusively — `az deployment sub/group validate` hits a known CLI bug (HTTP stream consumed error). If what-if fails, log + warn user — do not skip to execution.

⛔ **Scope is NOT a choice — read `infra/main.bicep` line 1 FIRST.** Grep for `targetScope\s*=\s*'(\w+)'`. This determines which command block below applies — never guess, never include both in the generated checklist:
- `targetScope = 'subscription'` → use **Bicep (subscription scope)** below. `az deployment group` will fail (`ResourceGroupNotFound` — the RG doesn't exist yet, this Bicep creates it).
- `targetScope` omitted, or `= 'resourceGroup'` → use **Bicep (resource-group scope)** below.

#### Bicep (subscription scope)

```bash
az deployment sub what-if \
  --name "{deploymentName}" \
  --location {location} \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --parameters {additionalSecureParams} \
  --subscription {subscriptionId}
```

#### Bicep (resource-group scope)

```bash
az deployment group what-if \
  --resource-group {rg} \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json \
  --parameters {additionalSecureParams} \
  --subscription {subscriptionId}
```

> ⛔ Pass every `@secure()` param from `main.bicep` (e.g. `deployerObjectId`) as `--parameters {additionalSecureParams}` — same list as Step 6's deploy command. Omitting one hangs `what-if` silently instead of erroring. Use only the flags shown above; unlisted flags (e.g. `--what-if-result-format`) fail outright.

- Review changes: `Create`, `Modify`, `Delete`, `NoChange`. Surface `Delete` as warnings — user must acknowledge.
- Auth error → `ENVIRONMENT_BLOCKING`.
- **If the command produces no output for >60s:** stop it and check whether every `@secure()` parameter from `main.bicep` was supplied — a hang, not an error, is the signature of a missing secure parameter.

#### Terraform

```bash
terraform plan -out=tfplan -detailed-exitcode
```

- Exit 0 → no changes. Exit 2 → changes (normal). Exit 1 → error.
- Surface `destroy` as warnings — user must acknowledge. Auth error → `ENVIRONMENT_BLOCKING`.

### 3. RBAC Permission Check

```bash
az role assignment list \
  --assignee {currentUserObjectId} \
  --scope /subscriptions/{sub}/resourceGroups/{rg} \
  --query "[].roleDefinitionName" -o tsv
```

Required: `Contributor` or `Owner` on the target resource group. If missing → `ENVIRONMENT_BLOCKING` with remediation command.

### 4. SKU Quota Verification

⛔ **`what-if` does NOT catch quota errors.** It returns `Succeeded` even when target SKU has limit=0.

If `prepare-plan.json.quotaValidation.verified == true` → proceed.

Otherwise → **read [sku-quota-validation.md](../../prepare/references/sku-quota-validation.md)** and run direct quota checks NOW (per-provider API patterns, offer restrictions). If limit=0 → HALT, present region fallback. Skip regions in `quotaValidation.checkedRegions` with zero availability.

⛔ `SubscriptionIsOverQuotaForSku` or `LocationIsOfferRestricted` in deploy output → HALT. See [error-classification.md](error-classification.md).

### 5. Resource Group Existence + Ownership

```bash
az group show --name {rg} --query "{location:location, tags:tags}" -o json 2>/dev/null
```

- Not exists → will be created by deployment (if `main.bicep` has subscription scope).
- Exists, `tags.app-onboard-session-id` matches this session → resume/redeploy target. Verify location matches `prepare-plan.json` region; mismatch → warn.
- Exists, tags missing OR `app-onboard-session-id` belongs to a DIFFERENT session → **not owned by this session.** ⛔ HALT — `ask_user`: "Resource group `{rg}` already exists and isn't tracked by this session. Deploying here adds resources alongside whatever's already in it. Continue anyway, or pick a new name?" Proceed only on explicit confirmation; "pick a new name" → append an attempt suffix to `naming.suffix`, recompute resource names, and re-run this check on the new name.

## Error Handling

Each check runs independently. Collect all results, then present structured report.

| Check | Fail Behavior |
|-------|---------------|
| Deployment preview | Warn, don't block (can fail on unsupported types) |
| RBAC | Block. Surface `az role assignment create`. |
| RG check | Warn on location mismatch. Don't block. |
| RG ownership | Block until explicit user confirmation (consent gate, not a hard failure). |

## Report Format

```
## Preflight Results
✅ IaC syntax: valid (terraform validate / bicep build)
⚠️ Deployment preview: 3 creates, 0 destroys, 1 update
✅ RBAC: Contributor role confirmed
✅ Resource group: rg-myapp-dev (eastus2)
```
