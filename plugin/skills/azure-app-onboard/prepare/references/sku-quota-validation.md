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
3. **If no user preference** — default to a well-supported region (e.g., `eastus2`) and scan 4 alternates from the user's likely geography (infer from subscription tenant location or ask).

**Global region pool:** `eastus2`, `eastus`, `westus2`, `centralus`, `westeurope`, `northeurope`, `australiaeast`, `japaneast`, `southeastasia`, `brazilsouth`

> **Agent: adapt shell syntax to detected environment.** PowerShell shown below; use equivalent syntax on bash/zsh (e.g., `for region in eastus eastus2 ...; do ... done`).

> ⛔ **PowerShell `?` in URLs:** When building `az rest` URLs with variable interpolation, PowerShell may strip `?` from `?api-version=`. Always use the URL **inline in double quotes** (as shown below), NOT via a `$url` variable. If you must use a variable, wrap the `?` with a backtick: `` `?api-version= ``.

### Per-Provider Scripts

Use `az rest` for all quota checks. Query BOTH limit AND usage (limit alone is insufficient).

**App Service:** Query quota + usages endpoints per region:
```powershell
$sub = '{subscriptionId}'; $sku = '{sku}'
@('{userRegion}','{alt1}','{alt2}','{alt3}') | ForEach-Object {
  $limit = az rest --method get --url "https://management.azure.com/subscriptions/$sub/providers/Microsoft.Web/locations/$_/providers/Microsoft.Quota/quotas/$sku?api-version=2023-02-01" --query "properties.limit.value" -o tsv 2>$null
  $used  = az rest --method get --url "https://management.azure.com/subscriptions/$sub/providers/Microsoft.Web/locations/$_/providers/Microsoft.Quota/usages/$sku?api-version=2023-02-01" --query "properties.usages.value" -o tsv 2>$null
  # limit=0 with used=-1 is the API's "Free tier not offered here" sentinel — treat limit<=0 as BLOCKED and clamp negative usage so 0-(-1) does NOT become a false-positive 1.
  $ln = if ($limit) { [int]$limit } else { $null }; $un = if ($used) { [int]$used } else { 0 }
  $avail = if ($null -eq $ln) { 'unknown' } elseif ($ln -le 0) { 0 } else { $ln - [math]::Max(0, $un) }
  Write-Host "$_ : $sku limit=$limit available=$avail"
}
```

**Container Apps:** `/usages` gives usage+limit in one call:
```powershell
az rest --method get --url "https://management.azure.com/subscriptions/$sub/providers/Microsoft.App/locations/{region}/usages?api-version=2024-03-01" --query "value[?name.value=='ManagedEnvironmentCount'].{used:currentValue, limit:limit}" -o json
```

**Static Web Apps:** No `Microsoft.Quota` provider — Free plan caps at ~10 apps/subscription (per docs; may vary, treat as guideline). Count existing Free apps:
```powershell
az staticwebapp list --query "length([?sku.name=='Free'])" -o tsv
```
At/near cap → treat SWA Free as UNAVAILABLE (no self-service increase — raises need a support request). Fall back per [After Checking](#after-checking).

**Storage / Key Vault:** Default limits rarely exhausted — skip unless plan requires multiple accounts.
  } else { Write-Host "$_ : no-data" }
}
```

**Storage** — default limit 250 accounts/region. Rarely exhausted — skip programmatic check unless the plan requires multiple storage accounts.

**Key Vault** — no quota API exists (returns `NotFound`). Default limit ~1000 vaults/subscription. Skip programmatic check.

### Interpret Results

- `available > 0` → AVAILABLE. `available = 0` / `limit <= 0` → BLOCKED (a `limit=0`, `used=-1` response is the API sentinel for "Free tier not offered in this region" — the script clamps it so it does not read as available). 404/empty → fallback candidate.
- `az rest` fails → `quotaValidation: { verified: false, method: "unverifiable" }`.

### After Checking

1. Only present regions with confirmed capacity.
2. ALL regions zero → try next SKU tier. ALL tiers exhausted → **HALT** with options: specify region, switch compute type, request increase at portal, cancel.
3. Write `prepare-plan.json.quotaValidation`: `{ verified: true, method: "cli", verifiedRegion, verifiedSku, checkedRegions[], failedResources[] }`.

### Offer Restriction Check (Database Services)

> ⛔ `what-if`/`validate` do NOT catch `LocationIsOfferRestricted`. Use capabilities API.

| Provider | API Version |
|----------|-------------|
| PostgreSQL | `2022-12-01` |
| MySQL | `2023-12-30` |

```powershell
$sub = '{subscriptionId}'; $provider = 'Microsoft.DBforPostgreSQL'; $apiVer = '2022-12-01'
@('{userRegion}','{alt1}','{alt2}','{alt3}') | ForEach-Object {
  $result = az rest --method get --url "https://management.azure.com/subscriptions/$sub/providers/$provider/locations/$_/capabilities?api-version=$apiVer" --query "value[0].supportedFlexibleServerEditions[0].name" -o tsv 2>$null
  if ($result) { Write-Host "$_ : $provider AVAILABLE ($result)" } else { Write-Host "$_ : $provider BLOCKED (offer restricted)" }
}
```

> For MySQL: change `$provider = 'Microsoft.DBforMySQL'` and `$apiVer = '2023-12-30'`.

⛔ JMESPath MUST start with `value[0].`. URL MUST include `/locations/{region}/`. Empty/null response = BLOCKED. Write results to `quotaValidation.offerRestrictions[]`.

### Anti-Patterns

⛔ `az quota list` (extension failures), `az vm list-usage` (wrong layer), `az appservice list-locations` (ignores quota), `mcp_azure_mcp_quota` (misleading), `what-if`/`validate` (false positives).

## Deploy Gate Re-Validation

If `quotaValidation.verified == false` at deploy gate: re-run Per-Provider Scripts above. Pass → update quotaValidation. Fail → present alternatives. `az rest` fails → warn and proceed.

## Sub-Agent Delegation

When delegating from prepare Step 5, provide: `subscriptionId`, SKU list from `prepare-plan.json.services[].sku`, preferred region + fallbacks, list of managed database services, and this file's content. See [subagent-quota.md](subagent-quota.md) for the template.
