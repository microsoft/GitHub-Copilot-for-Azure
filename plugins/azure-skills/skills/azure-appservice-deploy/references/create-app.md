# Create RG + App Service Plan + Web App (Linux, P0v3)

Creates resources only when missing.

> 💡 **Shell note**: Bash blocks below use `\` line continuation, `||`, `2>/dev/null`, `$(…)`. PowerShell equivalents are shown alongside where the bash form doesn't round-trip — substitute `` ` `` for `\`, `2>$null` for `2>/dev/null`, and `$LASTEXITCODE` checks for `||`.

## 1. Resolve Azure context — minimize prompts

**Ask the user at most ONE question (the app name).** Derive everything else. If the user's request already names an RG / Plan / region / subscription (e.g. *"deploy to my-team-rg in westus3"*), use those values verbatim and skip the corresponding derivation.

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

Example: folder `my-flask-app/` → `my-flask-app-a3f9c1d2`.

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

### 1e. Show the defaults summary BEFORE creating
Print one concise block so the user can interrupt to override.

**Example** (illustrative — substitute the actual derived values, do not print verbatim):

```
Using these defaults for your App Service deployment:
  • App name        : flask-app-demo-27may
  • Resource group  : flask-app-demo-27may-rg     (auto-derived)
  • App Service Plan: flask-app-demo-27may-plan   (auto-derived)
  • Region          : eastus2                     (CLI default)
  • Plan SKU        : P0v3 Linux
  • Runtime         : PYTHON:3.14

Proceeding with create. Reply "stop" within the next message to change any value.
```

Do **not** call `ask_user` for confirmation here — just print and proceed.

### 1f. Transient error handling
On connection-level or 429/5xx errors from any `az ... create` in §§2–4, see [transient-retry.md](transient-retry.md). Configuration errors (`AuthorizationFailed`, `SkuNotAvailable`, `QuotaExceeded`, etc.) must **not** be retried — surface them.

## 2. Resource Group

```bash
az group show -n "<rg>" --only-show-errors
# Only after Azure confirms the resource group is missing:
az group create -n "<rg>" -l "<region>"
```

## 3. App Service Plan — **Linux, P0v3 by default**

> ⚠️ **MANDATORY**: Use `--is-linux` and the selected SKU (`P0v3` by default), matching the SKU and region checked in §1d. Preserve an existing template's SKU. Do not change OS or SKU unless the user explicitly requests it.

```bash
az appservice plan show -n "<plan>" -g "<rg>" --only-show-errors
# Only after Azure confirms the plan is missing:
az appservice plan create -n "<plan>" -g "<rg>" --is-linux --sku "<selected-sku>" -l "<region>"
```

## 4. Web App — selected runtime (Linux)

> ⚠️ **Shell safety**: Always use the **colon** form (e.g. `PYTHON:3.14`) — never the pipe form `PYTHON|3.14`. The pipe character is a shell operator in PowerShell, Bash, and cmd. Use the compatible runtime selected from the language guide.

```bash
az webapp show -n "<app>" -g "<rg>" --only-show-errors
# Only after Azure confirms the app is missing:
az webapp create -n "<app>" -g "<rg>" -p "<plan>" --runtime "<runtime>"
```

The 8-hex-char GUID suffix from §1b is sufficient for global hostname uniqueness; the optional `--domain-name-scope TenantReuse` flag (Azure CLI ≥ 2.76, July 2025) is intentionally omitted to stay compatible with older CLIs.

### Discover available runtimes

Before printing the defaults summary, follow the selected language guide to discover a compatible Linux runtime. For example, for Python:

```bash
az webapp list-runtimes --os linux --runtime python --query "[].config" -o tsv
```

Convert pipe-form output (e.g. `PYTHON|3.14`) to colon form before passing to `--runtime`. Stop if discovery fails, no compatible runtime is available, or an existing target has an incompatible OS/runtime; don't change it silently.

## 5. Verify

```bash
az webapp show -n <app> -g <rg> --query "{name:name, state:state, host:defaultHostName, linuxFx:siteConfig.linuxFxVersion}" -o table
```

Expected: `state: Running`, `linuxFx` matching the selected runtime (Azure may store it in pipe form), and a nonempty hostname.

## Notes

- ⛔ Never use `az webapp up` — deprecated. See [deploy-azcli.md](deploy-azcli.md).
- If the user requests a different SKU (e.g. `B1` for dev/test), respect it but warn that **P0v3** is the documented default.
- If a Windows plan is requested, hand off to `azure-prepare`.
