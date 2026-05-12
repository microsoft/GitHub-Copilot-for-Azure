# SKU Quota Validation Procedure

Pre-deploy quota and offer restriction checks. Read during prepare Step 5 before deploying.

For SKU selection (budget tiers, modifier rules, defaults), see [sku-matrix.md](sku-matrix.md).

## Quota Validation Procedure

> ⛔ **Use `az rest`, NOT `az quota list`.** The `az quota list` CLI extension triggers a full extension metadata scan on startup. If ANY installed extension has a permission error (common: `azure-devops` WinError 5 on Windows), the entire command fails. `az rest` is a built-in command that bypasses extension loading entirely and hits the same REST API. Quota increases are free — you only pay for resources actually used.

> ⛔ **`what-if` does NOT catch App Service quota errors.** `az deployment sub what-if` returns `Succeeded` even when the target SKU has limit=0. The quota rejection only surfaces at actual `az deployment sub create` time. This means the prepare-phase quota check is the ONLY pre-deploy safety net — do not skip or shortcut it.

> ⛔ **Do NOT use `az vm list-usage`, `az appservice list-locations`, or `mcp_azure_mcp_quota`** for quota checks. They return misleading data — see [Anti-Patterns](#anti-patterns) below.

### Region Selection

Build the scan list dynamically — do NOT hardcode a fixed set of regions:

1. **User's preferred region** — read `context.json.azure.region` or `context.json.overrides[]` for a region preference. If stated, scan that region first.
2. **Nearest alternates** — add 3–4 regions geographically close to the user's preferred region from the global pool below.
3. **If no user preference** — default to `eastus2` and scan 4 alternates from the user's likely geography (infer from subscription tenant location or ask).

**Global region pool:** `eastus2`, `eastus`, `westus2`, `centralus`, `westeurope`, `northeurope`, `australiaeast`, `japaneast`, `southeastasia`, `brazilsouth`

> **Agent: adapt shell syntax to detected environment.** PowerShell shown below; use equivalent syntax on bash/zsh (e.g., `for region in eastus eastus2 ...; do ... done`).

### Per-Provider Scripts

Each provider uses a different API. AppOnboard primarily checks **App Service** and **Container Apps**.

**App Service** — query BOTH the quota endpoint (limit) AND the usages endpoint (current consumption). Checking limit alone is insufficient — `limit=1` with `usage=1` means FULL, not AVAILABLE.
```powershell
$sub = '{subscriptionId}'; $sku = '{sku}'
$regions = @('{userRegion}','{alternate1}','{alternate2}','{alternate3}','{alternate4}')
$regions | ForEach-Object {
  $qUrl = "https://management.azure.com/subscriptions/$sub/providers/Microsoft.Web/locations/$_/providers/Microsoft.Quota/quotas/$sku" + "?api-version=2023-02-01"
  $uUrl = "https://management.azure.com/subscriptions/$sub/providers/Microsoft.Web/locations/$_/providers/Microsoft.Quota/usages/$sku" + "?api-version=2023-02-01"
  $limit = az rest --method get --url $qUrl --query "properties.limit.value" -o tsv 2>$null
  $used  = az rest --method get --url $uUrl --query "properties.usages.value" -o tsv 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $limit) {
    Write-Host "$_ : $sku=no-per-sku-entry (fallback candidate)"
  } elseif ([int]$limit -le 0) {
    Write-Host "$_ : $sku=limit=0 BLOCKED"
  } else {
    $u = if ($used -and [int]$used -ge 0) { [int]$used } else { 0 }
    $avail = [int]$limit - $u
    Write-Host "$_ : $sku=limit=$limit used=$u available=$avail $(if($avail -gt 0){'AVAILABLE'}else{'FULL'})"
  }
}
```

**Container Apps** — uses the provider `/usages` endpoint (gives usage+limit in one call):
```powershell
$sub = '{subscriptionId}'
$regions | ForEach-Object {
  $url = "https://management.azure.com/subscriptions/$sub/providers/Microsoft.App/locations/$_/usages?api-version=2024-03-01"
  $result = az rest --method get --url $url --query "value[?name.value=='ManagedEnvironmentCount'].{used:currentValue, limit:limit}" -o json 2>$null | ConvertFrom-Json
  if ($result) {
    $avail = $result.limit - $result.used
    Write-Host "$_ : ManagedEnv used=$($result.used) limit=$($result.limit) available=$avail $(if($avail -gt 0){'AVAILABLE'}else{'FULL'})"
  } else { Write-Host "$_ : no-data" }
}
```

**Storage** — default limit 250 accounts/region. Rarely exhausted — skip programmatic check unless the plan requires multiple storage accounts.

**Key Vault** — no quota API exists (returns `NotFound`). Default limit ~1000 vaults/subscription. Skip programmatic check.

### Interpret Results

- **App Service:** `available > 0` (limit minus used) → AVAILABLE. `available = 0` → ⛔ FULL (`SubscriptionIsOverQuotaForSku` at deploy). `limit = 0` → ⛔ BLOCKED. `no-per-sku-entry` (404/empty — only `*` wildcard) → per-SKU tracking not configured; prefer regions with explicit limits, use as fallback if none available.
- **Container Apps:** `limit - used > 0` → AVAILABLE. `available = 0` → pick different region or request increase via Azure Portal.
- **Storage:** `limit - used > 0` → AVAILABLE. Default limit 250 is rarely exhausted.
- **Key Vault:** No programmatic check. If deploy fails with quota error, request increase via Azure Portal.
- **`az rest` fails** (auth/network) → Write `quotaValidation: { verified: false, method: "unverifiable", reason: "az rest failed" }`.

### After Checking

1. **Only present regions with confirmed capacity.** Show: "Available regions for {sku}: eastus2 (limit={N}), centralus (limit={N})."
2. If the user's preferred region has zero quota: "⚠️ {region} has no {sku} capacity. Available alternatives: {list}."
3. If ALL regions have zero quota, escalate: try next SKU tier (F1→B1, B1→S1), re-check. If ALL tiers exhausted → **HALT**: "⛔ No quota in any checked region. Options: (1) Specify a region with quota, (2) Switch to Container Apps (~$X/mo), (3) Request increase at https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas, (4) Cancel."
4. Write to `prepare-plan.json.quotaValidation`: `{ verified: true, method: "cli", verifiedRegion: "{region}", verifiedSku: "{sku}", checkedRegions: [...], failedResources: [...] }`.
5. Write a `QuotaCheck` entry per SKU/region to `prepare-plan.json.quotas[]` with all schema fields.

### Offer Restriction Check (Database Services)

> ⛔ **`what-if` and `validate` do NOT catch `LocationIsOfferRestricted`.** The capabilities API below is the ONLY pre-deploy detection.

Use `az rest` to check capabilities per region: `GET /subscriptions/{sub}/providers/{namespace}/locations/{region}/capabilities?api-version={ver}`.

| Provider | Namespace | API Version | Blocked signal |
|----------|-----------|-------------|----------------|
| PostgreSQL | `Microsoft.DBforPostgreSQL` | `2022-12-01` | `value[0].reason` non-null or editions empty |
| MySQL | `Microsoft.DBforMySQL` | `2023-12-30` | `value` is `[]` |

**Full example — PostgreSQL capabilities check:**
```powershell
az rest --method get --url "https://management.azure.com/subscriptions/{sub}/providers/Microsoft.DBforPostgreSQL/locations/{region}/capabilities?api-version=2022-12-01" --query "value[0].supportedFlexibleServerEditions[0].name" -o tsv
```
> ⛔ **JMESPath MUST start with `value[0].`** — the capabilities response wraps editions inside a `value` array. Omitting `value[0].` returns null even when editions exist.

> ⛔ **URL MUST include `/locations/{region}/`** — omitting it returns `InvalidResourceType`.

**Interpretation:**

| Response | Meaning | Action |
|----------|---------|--------|
| `value[0].supportedFlexibleServerEditions` non-empty | Available | Proceed |
| `value` is `[]` or editions empty | BLOCKED | Try next candidate region |
| HTTP error or `InvalidResourceType` | Wrong URL or API version | Fix URL, retry |
| `reason` field non-null | Restricted in this region | Try next candidate region |

> ⛔ **Empty response from capabilities API = BLOCKED.** The absence of data means the service is restricted in this region. NEVER assume availability from empty/null results — check the next candidate region.

Write to `prepare-plan.json.quotaValidation.offerRestrictions[]`. All blocked → **HALT**.

> ⛔ **Do NOT use `az provider show --namespace`** — global locations, not subscription-specific.

### Anti-Patterns — NEVER Use These

> ⛔ `az quota list` — CLI extension, fails with permission errors. Use `az rest`.
> ⛔ `az vm list-usage` — wrong layer (VM vCPUs ≠ App Service instances).
> ⛔ `az appservice list-locations` — returns every region even when quota is 0.
> ⛔ `mcp_azure_mcp_quota` — misleading "No Limit" for unsupported types.
> ⛔ `what-if` / `validate` — returns `Succeeded` for quota=0 and `LocationIsOfferRestricted`.

## Deploy Gate Re-Validation

When the scaffold deploy gate (Step 12.5 in [validation-and-manifest.md](../../scaffold/references/validation-and-manifest.md)) reads `prepare-plan.json.quotaValidation` and finds `verified == false`, `method == "unverifiable"`, or `method` is not `"cli"` for quota-constrained services (App Service, Functions, Container Apps, VMs, Cosmos DB, PostgreSQL, Redis, ACR):

1. **Do NOT present the deploy gate yet.** Deploying without quota verification causes 30–80 min healing cascades.
2. **Re-run the [Per-Provider Scripts](#per-provider-scripts) above** for the subscription ID, SKU list from `prepare-plan.json.services[]`, and the planned region.
3. **Pass** → update `prepare-plan.json.quotaValidation` with `{ verified: true, method: "cli", verifiedRegion: "{region}" }` and proceed to the gate.
4. **Fail** → present the user with the blocked SKU and alternatives. If user picks an alternate SKU/region, update `prepare-plan.json` and re-scaffold.
5. **`az rest` itself fails** (auth/network) → display: "⚠️ Quota could not be verified — deploy may fail if quota is insufficient. Request increases at https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaMenuBlade/myQuotas." and proceed.

## Sub-Agent Delegation Protocol

When delegating quota validation to a sub-agent from prepare/SKILL.md Step 5:

**Provide to the sub-agent:**
- `context.json.azure.subscriptionId`
- SKU list from Step 4 (`prepare-plan.json.services[].sku`)
- User's preferred region (or default `eastus2`)
- Fallback regions: `eastus`, `westus2`, `centralus`, `westeurope`
- List of managed database/restricted-offer services in the plan
- Full content of this file (sku-quota-validation.md) verbatim

**Sub-agent prompt template:**

> "Follow the procedures in sku-quota-validation.md to validate quota for every compute SKU in the plan across the region list. For each managed database or restricted-offer service (PostgreSQL, MySQL), also run the offer restriction check. Return: per-SKU per-region availability (limit AND usage), the first viable region where ALL SKUs have capacity (verifiedRegion), offerRestrictions[] for any blocked services, and overall status (success/blocked/degraded). If all regions are blocked for any SKU, return status: BLOCKED with the SKU name and available alternatives. ≤500 tokens."

**Expected output schema:**
```jsonc
{
  "status": "success" | "blocked" | "degraded",
  "verifiedRegion": "eastus2",
  "quotas": [{ "resource": "...", "region": "...", "required": 1, "available": 3, "sufficient": true }],
  "offerRestrictions": [{ "provider": "...", "region": "...", "restricted": false, "reason": "..." }]
}
```

**How parent consumes results:**
- `success` → use `verifiedRegion` for all downstream steps. Write `quotas[]` and `quotaValidation` to `prepare-plan.json`
- `blocked` → present blocked SKU and alternatives to user. Re-invoke sub-agent with updated inputs if user picks alternate
- `degraded` (some checks failed but viable region found) → proceed with warnings in `assumptions[]`
