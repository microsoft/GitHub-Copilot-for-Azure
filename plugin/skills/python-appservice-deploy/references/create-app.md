# Create RG + App Service Plan + Web App (Linux, P0v3)

This skill creates resources only when they don't already exist. Always check first.

> 💡 **Shell note**: The idempotency checks in §§2–4 below use `2>/dev/null` (bash/zsh — Linux, macOS). On **PowerShell** (Windows), replace `2>/dev/null` with `2>$null` wherever it appears.

## 1. Resolve Azure context — minimize prompts

**Goal: ask the user at most ONE question (the app name).** Everything else is derived or defaulted. Never ask the user for resource group name, app service plan name, region, or subscription unless an error forces it.

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

If empty / "any" / "you choose":
- Take the current working folder name, lowercase it, replace non-`[a-z0-9]` with `-`, collapse repeats, trim hyphens.
- Generate a new GUID (PowerShell: `[guid]::NewGuid().ToString()`, Bash: `uuidgen | tr '[:upper:]' '[:lower:]'`).
- Take the **first 8 hex chars** of the GUID (segment before the first `-`): `<slug>-<8-hex-chars>`.
- Truncate the slug so total length ≤ 40 chars.
- Must match `^[a-z][a-z0-9-]{1,38}[a-z0-9]$`.

Example: folder `my-flask-app/`, GUID `a3f9c1d2-...` → `my-flask-app-a3f9c1d2`.

### 1c. Derived names (NEVER ask)
| Resource | Default |
|---|---|
| Resource group | `<app-name>-rg` |
| App Service Plan | `<app-name>-plan` |

### 1d. Region (NEVER ask unless forced)
1. `az config get defaults.location -o tsv 2>/dev/null` (bash/zsh) or `az config get defaults.location -o tsv 2>$null` (PowerShell) → use it if set.
2. Else default to `eastus2`.
3. Only call `ask_user` if `az group create` later fails with a region/quota/availability error.

### 1e. Show the defaults summary BEFORE creating
Output a single concise block so the user sees exactly what will be created and can override before resources are made:

```
Using these defaults for your Python App Service deployment:
  • App name        : flask-app-demo-27may
  • Resource group  : flask-app-demo-27may-rg     (auto-derived)
  • App Service Plan: flask-app-demo-27may-plan   (auto-derived)
  • Region          : eastus2                     (CLI default)
  • Plan SKU        : P0V3 Linux
  • Runtime         : PYTHON:3.14

Proceeding with create. Reply "stop" within the next message to change any value.
```

Do **not** call `ask_user` for confirmation here — just print the summary and proceed. The user can interrupt if they want changes.

## 1f. Transient error handling for create commands

ARM `PUT` operations (`az group create`, `az appservice plan create`, `az webapp create`) sometimes fail with **transient** errors (`Connection reset`, `Connection aborted`, `ConnectionError`, `Read timed out`, `BadGatewayConnection`, `ServiceUnavailable`, `TooManyRequests` / HTTP `429`, or HTTP `502`/`503`/`504`). These are flaky ARM frontend / network blips, not configuration problems — they almost always succeed on retry.

**Rules:**

- Apply to every `az ... create` in this skill (§§2–4); retry **silently** (do not narrate "let me retry").
- Up to **2 retries** (3 attempts total); wait **5s** before retry #1 and **15s** before retry #2. If the error carries a `Retry-After` header, honour that value instead.
- **Wrap the full idempotent pair** `(az ... show ...) || (az ... create ...)` — never the bare `create`. The `show` short-circuits any partially-succeeded prior attempt and avoids false `Conflict` / `NameAlreadyExists`.
- **Retry only** when stderr matches the `TRANSIENT` regex below. Do **NOT** retry on `AuthorizationFailed`, `SubscriptionNotFound`, `ResourceGroupNotFound`, `InvalidTemplateDeployment`, `SkuNotAvailable`, `QuotaExceeded`, or any non-429 4xx. After 3 failed attempts, surface the original error with one line of context (e.g., "ARM frontend is returning transient errors — please retry in a few minutes").

```bash
TRANSIENT='Connection reset|Connection aborted|ConnectionError|Read timed out|BadGatewayConnection|ServiceUnavailable|Max retries exceeded|TooManyRequests|\b429\b|\b50[234]\b'
for attempt in 1 2 3; do
  if err=$({ <az-show-command> -o none 2>/dev/null || <az-create-command> -o none; } 2>&1); then break; fi
  if ! echo "$err" | grep -qE "$TRANSIENT"; then echo "$err" >&2; exit 1; fi
  [ $attempt -eq 3 ] && { echo "$err" >&2; exit 1; }
  sleep $([ $attempt -eq 1 ] && echo 5 || echo 15)
done
```

**PowerShell adaptation:** replace `2>/dev/null` → `2>$null`; swap the loop for `for ($i=1; $i -le 3; $i++)`; use `$err -match $TRANSIENT` instead of `grep -qE`; use `Start-Sleep -Seconds (@(5,15)[$i-1])`. Same `TRANSIENT` regex.

## 2. Resource Group

```bash
az group show -n <rg> --only-show-errors 2>/dev/null || \
  az group create -n <rg> -l <region>
```

## 3. App Service Plan — **Linux, P0v3 by default**

> ⚠️ **MANDATORY**: Use `--is-linux` and `--sku P0V3`. Do not change OS or SKU unless the user explicitly requests it.

```bash
az appservice plan show -n <plan> -g <rg> --only-show-errors 2>/dev/null || \
  az appservice plan create \
    -n <plan> \
    -g <rg> \
    --is-linux \
    --sku P0V3 \
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
