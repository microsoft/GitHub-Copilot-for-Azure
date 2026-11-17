# Create RG + App Service Plan + Web App (Linux, P0v3)

Creates resources only when missing — every step is `show || create` (idempotent against existing user-supplied names).

> 💡 **Shell note**: Bash blocks below use `\` line continuation, `||`, `2>/dev/null`, `$(…)`. PowerShell equivalents are shown alongside where the bash form doesn't round-trip — substitute `` ` `` for `\`, `2>$null` for `2>/dev/null`, and `$LASTEXITCODE` checks for `||`.

### Windows Azure CLI quoting

Windows `az.cmd` can reparse complex `--query` expressions. In PowerShell, prefer `-o json` and `ConvertFrom-Json` with local filtering when quoting is uncertain. Check `$LASTEXITCODE` before parsing; stop on command or JSON errors. Use `--settings "@<settings-file>.json"` for JSON-valued app settings rather than inline JSON.

## 1. Resolve Azure context — minimize prompts

**Ask the user at most ONE question (the app name).** Derive everything else. If the user's request already names an RG / Plan / region / subscription (e.g. *"deploy to my-team-rg in westus3"*), use those values verbatim and skip the corresponding derivation — the `show || create` flow below works against existing resources.

### 1a. Subscription
```bash
az account show --query id -o tsv
```
If unset, prompt the user to `az login`. Only call `ask_user` if multiple subscriptions are configured and no default is set.

### 1b. App name
Ask the user **once**:
> "What name would you like for your App Service? (Press Enter to auto-generate one.)"

If empty / "any" / "you choose", call the generator script — it implements the slug rules (lowercase, hyphen-collapse, ≤ 40 chars, `^[a-z][a-z0-9-]{1,38}[a-z0-9]$`) and an 8-hex-char GUID suffix:

- Bash / zsh: [`scripts/generate-app-name.sh`](../scripts/generate-app-name.sh) → `APP_NAME=$(./scripts/generate-app-name.sh [folder])`
- PowerShell: [`scripts/generate-app-name.ps1`](../scripts/generate-app-name.ps1) → `$appName = & .\scripts\generate-app-name.ps1 [-FolderName <folder>]`

Example: folder `my-express-app/` → `my-express-app-a3f9c1d2`.

### 1c. Derived names (use only when user did not specify)
| Resource | Default |
|---|---|
| Resource group | `<app-name>-rg` |
| App Service Plan | `<app-name>-plan` |

### 1d. Region
1. If user specified a region, use it.
2. Else read the CLI default. Suppress the "Configuration is not set" stderr line **only** when paired with an exit-code check — never blindly drop stderr, since it would also swallow auth/transport errors:
   ```bash
   REGION=$(az config get defaults.location -o tsv 2>/dev/null) || REGION=""
   ```
   ```powershell
   $region = az config get defaults.location -o tsv 2>$null; if ($LASTEXITCODE -ne 0) { $region = "" }
   ```
3. Else default to `eastus2`.
4. Before creating a plan, invoke `azure-quotas` to check quota and regional availability. Ask before changing a user-specified region; stop if quota is unavailable or unverifiable rather than switching SKU.
   - Use the effective user/template subscription, region and SKU (`P0v3` only if unspecified). Confirm the active subscription with `az account show --query id -o tsv`; stop on mismatch without switching. Reuse results unless these values change; recheck after changes and provision only checked values.
   - Use `az quota` first, never quota MCP; if `azure-quotas` is unavailable, use `az quota list` and `az quota usage list` for the subscription/provider/region scope. Require an unambiguous quota mapping, non-negative limits/usage and sufficient capacity in matching units. `Microsoft.Web` is not a documented [Quota API provider](https://learn.microsoft.com/rest/api/quota/): for unsupported/unmapped quotas, confirm through Portal/Support or stop. [Regional usage counters](https://learn.microsoft.com/rest/api/appservice/get-usages-in-location/list) alone do not prove capacity.
   - Verify Linux SKU availability with `az appservice list-locations --sku "<selected-sku>" --linux-workers-enabled --subscription "<subscription-id>"`. Match region names using `az account list-locations` (active subscription only; no `--subscription`). Stop on errors or missing data.

### 1e. Show the defaults summary BEFORE creating
Print one concise block so the user can interrupt to override.

**Example** (illustrative — substitute the actual derived values, do not print verbatim):

```
Using these defaults for your Node.js App Service deployment:
  • App name        : express-demo-a3f9c1d2
  • Resource group  : express-demo-a3f9c1d2-rg     (auto-derived)
  • App Service Plan: express-demo-a3f9c1d2-plan   (auto-derived)
  • Region          : eastus2                      (CLI default)
  • Plan SKU        : P0v3 Linux
  • Runtime         : NODE:26

Proceeding with create. Reply "stop" within the next message to change any value.
```

Do **not** call `ask_user` for confirmation here — just print and proceed.

### 1f. Transient error handling
On connection-level or 429/5xx errors from any `az ... create` in §§2–4, see [transient-retry.md](transient-retry.md). Configuration errors (`AuthorizationFailed`, `SkuNotAvailable`, `QuotaExceeded`, etc.) must **not** be retried — surface them.

Preflight does not guarantee provisioning. After `QuotaExceeded`, another defaulted region must meet user/project constraints and pass §1d; otherwise stop and suggest a quota increase.

## 2. Resource Group

```bash
az group show -n <rg> --only-show-errors 2>/dev/null || \
  az group create -n <rg> -l <region>
```
```powershell
az group show -n <rg> --only-show-errors 2>$null
if ($LASTEXITCODE -ne 0) { az group create -n <rg> -l <region> }
```

## 3. App Service Plan — **Linux, P0v3 by default**

> ⚠️ **MANDATORY**: Use `--is-linux` and the selected SKU (`P0v3` by default). Preserve an existing template's SKU. Use exactly the SKU and region checked in §1d, including in a new shell.

```bash
az appservice plan show -n <plan> -g <rg> --only-show-errors 2>/dev/null || \
  az appservice plan create -n <plan> -g <rg> --is-linux --sku "<selected-sku>" -l <region>
```
```powershell
az appservice plan show -n <plan> -g <rg> --only-show-errors 2>$null
if ($LASTEXITCODE -ne 0) {
  az appservice plan create -n <plan> -g <rg> --is-linux --sku "<selected-sku>" -l <region>
}
```

## 4. Web App — Node runtime (Linux)

### Discover available runtimes

Before the §1e summary, discover available runtimes:

```bash
az webapp list-runtimes --os linux --runtime node --query "[].config" -o tsv
```

Choose the latest runtime compatible with `package.json` `engines.node`, respecting any user-specified runtime. The output uses the pipe form (e.g., `NODE|26`) — **convert to colon form** for `<runtime>` and show it in §1e. Stop if discovery fails, the requested runtime is incompatible, or none matches. For existing apps, show their actual OS/runtime and surface mismatches; do not change the runtime silently.

> ⚠️ **Shell safety**: Always use the **colon** form (e.g., `NODE:26`) — never the pipe form `NODE|26`. The pipe is a shell operator in PowerShell, Bash, and cmd.

```bash
az webapp show -n <app> -g <rg> --only-show-errors 2>/dev/null || \
  az webapp create -n <app> -g <rg> -p <plan> --runtime "<runtime>"
```
```powershell
az webapp show -n <app> -g <rg> --only-show-errors 2>$null
if ($LASTEXITCODE -ne 0) {
  az webapp create -n <app> -g <rg> -p <plan> --runtime "<runtime>"
}
```

## 5. Verify

```bash
az webapp show -n <app> -g <rg> --query "{name:name, state:state, host:defaultHostName, linuxFx:siteConfig.linuxFxVersion}" -o table
```

Expected: `state: Running`, `linuxFx` matching the selected runtime (e.g., `NODE|26`; Azure stores the pipe form internally), and a host name.

## Notes

- ⛔ Never use `az webapp up` — deprecated. See [deploy-azcli.md](deploy-azcli.md).
- If the user requests a different SKU (e.g. `B1` for dev/test), respect it but warn that **P0v3** is the documented default.
- If a Windows plan is requested, hand off to `azure-prepare`.
