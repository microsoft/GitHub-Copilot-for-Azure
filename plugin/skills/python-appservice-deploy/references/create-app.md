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

ARM `PUT` operations (`az group create`, `az appservice plan create`, `az webapp create`) occasionally fail with **transient** errors such as `Connection reset`, `Connection aborted`, `ConnectionError`, `HTTPSConnectionPool ... Read timed out`, `BadGatewayConnection`, `ServiceUnavailable`, `TooManyRequests` (HTTP `429`), or HTTP `502 / 503 / 504`. These are **not** configuration problems — they're flaky ARM frontend / network blips and they almost always succeed on the next attempt.

**Rule for the agent:** Apply this retry pattern to every `az ... create` command in this skill (sections 2, 3, and 4 below) **without narrating "let me retry"** to the user. Just do it silently.

- Up to **2 retries** (3 attempts total).
- Wait **5 seconds** before retry #1, **15 seconds** before retry #2 (simple backoff). If the error includes a `Retry-After` header, honour that value instead of the fixed delay.
- **Always wrap the full idempotent pair** `(az ... show ... 2>/dev/null) || (az ... create ...)` — never the bare `create`. If a previous attempt succeeded server-side but the client lost the connection, the `show` short-circuits the next attempt and avoids a false `Conflict / NameAlreadyExists` failure.
- **Only retry** when stderr matches one of: `Connection reset`, `Connection aborted`, `ConnectionError`, `Read timed out`, `BadGatewayConnection`, `ServiceUnavailable`, `Max retries exceeded`, `TooManyRequests`, HTTP `429`, `502`, `503`, `504`.
- **Do NOT retry** on: `AuthorizationFailed`, `SubscriptionNotFound`, `ResourceGroupNotFound`, `InvalidTemplateDeployment`, `SkuNotAvailable`, `QuotaExceeded`, or any `4xx` other than `429`. (`Conflict` / `NameAlreadyExists` will be short-circuited by the `show` half of the idempotent pair above and should not be hit during retry.)
- After the final failed attempt, surface the original error to the user with one line of context (e.g. "ARM frontend is returning transient errors — please retry in a few minutes").

PowerShell pattern (apply around the full `show || create` pair from sections 2, 3, and 4):

```powershell
$attempt = 0; $maxAttempts = 3
while ($true) {
  $attempt++
  # Wrap the full idempotent pair, not just `create`:
  $err = (& { <az-show-command> -o none 2>$null; if ($LASTEXITCODE -ne 0) { <az-create-command> -o none } }) 2>&1
  if ($LASTEXITCODE -eq 0) { break }
  $transient = $err -match 'Connection reset|Connection aborted|ConnectionError|Read timed out|BadGatewayConnection|ServiceUnavailable|Max retries exceeded|TooManyRequests|\b429\b|\b50[234]\b'
  if (-not $transient -or $attempt -ge $maxAttempts) { Write-Error $err; throw "az create failed" }
  Start-Sleep -Seconds (@(5,15)[$attempt-1])
}
```

Bash equivalent (wrap the full `show || create` pair; same retry / non-retry classification):

```bash
for attempt in 1 2 3; do
  # Wrap the full idempotent pair, not just `create`:
  if err=$({ <az-show-command> -o none 2>/dev/null || <az-create-command> -o none; } 2>&1); then break; fi
  if ! echo "$err" | grep -qE 'Connection reset|Connection aborted|ConnectionError|Read timed out|BadGatewayConnection|ServiceUnavailable|Max retries exceeded|TooManyRequests|\b429\b|\b50[234]\b'; then
    echo "$err" >&2; exit 1
  fi
  [ $attempt -eq 3 ] && { echo "$err" >&2; exit 1; }
  sleep $([ $attempt -eq 1 ] && echo 5 || echo 15)
done
```

> 💡 Because the retry wraps `(show || create)`, a `Conflict` / `NameAlreadyExists` from a partial first attempt cannot bubble up — the second attempt's `show` succeeds and short-circuits the `create`.

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
