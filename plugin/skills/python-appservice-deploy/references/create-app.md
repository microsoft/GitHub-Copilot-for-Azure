# Create RG + App Service Plan + Web App (Linux, P0v3)

This skill creates resources only when they don't already exist. Always check first.

> 💡 **Shell note**: The idempotency checks in §§2–4 below use `2>/dev/null` (bash/zsh — Linux, macOS). On **PowerShell** (Windows), replace `2>/dev/null` with `2>$null` wherever it appears.

## 1. Resolve Azure context — minimize prompts

**Goal: ask the user at most ONE question (the app name).** Everything else is derived or defaulted. Never *prompt* the user for resource group name, app service plan name, region, or subscription unless an error forces it.

> 📌 **Honor user-supplied values.** The "one question" rule means *don't interrupt to prompt* — it does **not** mean ignore values the user already provided. If the user's initial request mentions an existing resource group, App Service Plan, region, or subscription (e.g., *"deploy to my-team-rg"*, *"use the prod-plan"*, *"in westus3"*), use those values verbatim and skip the corresponding derivation/default step. The idempotent `show || create` flow in §§2–4 already works correctly against existing resources — `az group show -n my-team-rg` will short-circuit creation if the RG exists. Only fall back to the derived defaults below for values the user did **not** supply.

### 1a. Subscription
```bash
az account show --query id -o tsv
```
- If a subscription is active, use it silently.
- If `az login` is required, prompt the user to log in (one-time).
- Only call `ask_user` if multiple subscriptions are configured AND no default is set.

### 1b. App name
Ask the user **once**:
> "What name would you like for your App Service? (Press Enter to auto-generate one.)"

If empty / "any" / "you choose", **call the generator script** instead of generating the name inline — the scripts implement the slug rules (lowercase, hyphen-collapse, ≤ 40 chars, leading-letter, `^[a-z][a-z0-9-]{1,38}[a-z0-9]$`) and 8-hex-char GUID suffix in one step:

- Bash / zsh (Linux, macOS): [`scripts/generate-app-name.sh`](../scripts/generate-app-name.sh)
  ```bash
  APP_NAME=$(./scripts/generate-app-name.sh)
  # or pass an explicit folder name:
  # APP_NAME=$(./scripts/generate-app-name.sh my-flask-app)
  ```
- PowerShell (Windows): [`scripts/generate-app-name.ps1`](../scripts/generate-app-name.ps1)
  ```powershell
  $appName = & .\scripts\generate-app-name.ps1
  # or pass an explicit folder name:
  # $appName = & .\scripts\generate-app-name.ps1 -FolderName "my-flask-app"
  ```

Example output: folder `my-flask-app/` → `my-flask-app-a3f9c1d2`.

### 1c. Derived names (use only when user did not specify)
If the user provided an RG or Plan name, use that. Otherwise default to:

| Resource | Default |
|---|---|
| Resource group | `<app-name>-rg` |
| App Service Plan | `<app-name>-plan` |

### 1d. Region (use user-supplied value if given; otherwise never ask unless forced)
1. If the user already specified a region in their request, use it.
2. Else read the CLI default with `az config get defaults.location -o tsv`. If the exit code is non-zero (no default set), treat as "unset" and continue. If you want to suppress the "Configuration <key> is not set" stderr line for cleanliness, redirect **only when the exit code is also checked** — never blindly drop stderr, since it would also swallow auth or transport errors. A safe pattern:
   ```bash
   REGION=$(az config get defaults.location -o tsv 2>/dev/null) || REGION=""
   ```
   ```powershell
   $region = az config get defaults.location -o tsv 2>$null; if ($LASTEXITCODE -ne 0) { $region = "" }
   ```
3. Else default to `eastus2`.
4. Only call `ask_user` if `az group create` later fails with a region/quota/availability error.

### 1e. Show the defaults summary BEFORE creating
Output a single concise block so the user sees exactly what will be created and can override before resources are made.

**Example** (substitute the actual values you derived above — these are illustrative, not a literal template to print verbatim):

```
Using these defaults for your Python App Service deployment:
  • App name        : flask-app-demo-27may
  • Resource group  : flask-app-demo-27may-rg     (auto-derived)
  • App Service Plan: flask-app-demo-27may-plan   (auto-derived)
  • Region          : eastus2                     (CLI default)
  • Plan SKU        : P0v3 Linux
  • Runtime         : PYTHON:3.14

Proceeding with create. Reply "stop" within the next message to change any value.
```

Do **not** call `ask_user` for confirmation here — just print the summary and proceed. The user can interrupt if they want changes.

## 1f. Transient error handling for create commands

If any `az ... create` in §§2–4 fails with a connection-level or 429/5xx error (e.g. `Connection reset`, `Read timed out`, `BadGatewayConnection`, `ServiceUnavailable`, `TooManyRequests`/HTTP 429, `502`/`503`/`504`), retry using the wrapper scripts — see [transient-retry.md](transient-retry.md). Configuration errors (`AuthorizationFailed`, `SkuNotAvailable`, `QuotaExceeded`, etc.) must **not** be retried — surface them to the user.

## 2. Resource Group

```bash
az group show -n <rg> --only-show-errors 2>/dev/null || \
  az group create -n <rg> -l <region>
```

## 3. App Service Plan — **Linux, P0v3 by default**

> ⚠️ **MANDATORY**: Use `--is-linux` and `--sku P0v3`. Do not change OS or SKU unless the user explicitly requests it.

```bash
az appservice plan show -n <plan> -g <rg> --only-show-errors 2>/dev/null || \
  az appservice plan create \
    -n <plan> \
    -g <rg> \
    --is-linux \
    --sku P0v3 \
    -l <region>
```

## 4. Web App — Python 3.14 runtime (Linux)

> ⚠️ **Shell safety**: Always use the **colon** form `PYTHON:3.14` — never the pipe form `PYTHON|3.14`. The pipe character is a shell operator in PowerShell, Bash, and cmd, and breaks the command even when quoted in some contexts. The colon form is fully supported by `az webapp create --runtime` and is shell-safe everywhere.

```bash
az webapp show -n <app> -g <rg> --only-show-errors 2>/dev/null || \
  az webapp create \
    -n <app> \
    -g <rg> \
    -p <plan> \
    --runtime "PYTHON:3.14"
```

> 💡 **Optional flag (newer CLI only)**: If `az webapp create --help` lists `--domain-name-scope`, you may append `--domain-name-scope TenantReuse` so the default `<app>.azurewebsites.net` hostname only needs to be unique within your Entra tenant. This flag was added to `az webapp create` in **July 2025** (Azure CLI ≥ 2.76). On older CLIs it produces `unrecognized arguments` and the create fails — so the skill omits it by default and relies on the 8-hex-char GUID suffix in §1b for collision avoidance. If you want to use it, gate it on a capability check:
> ```bash
> if az webapp create --help 2>&1 | grep -q -- '--domain-name-scope'; then DNS_FLAG="--domain-name-scope TenantReuse"; else DNS_FLAG=""; fi
> ```

### Discover available runtimes

If `PYTHON:3.14` is unavailable in the region:

```bash
az webapp list-runtimes --os linux --query "[?contains(@, 'PYTHON')]" -o tsv
```

The output uses the pipe form (e.g., `PYTHON|3.14`) — **convert to colon form** before passing to `--runtime`. Prefer 3.14; fall back to 3.13, then 3.12.

## 5. Verify

```bash
az webapp show -n <app> -g <rg> --query "{name:name, state:state, host:defaultHostName, linuxFx:siteConfig.linuxFxVersion}" -o table
```

Expected:
- `state: Running`
- `linuxFx: PYTHON|3.14` (Azure stores it in pipe form internally — this is normal)
- `host: <app>.azurewebsites.net`

## Notes

- ⛔ Never use `az webapp up` — deprecated. See [deploy-azcli.md](deploy-azcli.md) for the supported command flow.
- If the user explicitly requests a different SKU (e.g., `B1` for dev/test), respect it but warn that **P0v3** is the documented default for this skill.
- If a Windows plan is requested, this skill cannot proceed — hand off to `azure-prepare`.
