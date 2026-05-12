# Code Deployment — Static Web Apps

## Static Web Apps — Content Deployment (Step 6c)

Deploy content using the SWA CLI with deployment token.

**Pre-check:** Verify `swa` CLI is installed: `npx --yes @azure/static-web-apps-cli --version`. If not available, install: `npm install -g @azure/static-web-apps-cli`.

| Step | Command | Notes |
|------|---------|-------|
| 1. Get token | `$token = az staticwebapp secrets list --name {swa} -g {rg} --query "properties.apiKey" -o tsv 2>$null` | Store in variable first — do NOT pass inline. ⛔ **On Windows, use `2>$null`** (not `2>&1`) — Azure CLI Python warnings corrupt `-o tsv` output |
| 2. Set env var | `$env:SWA_CLI_DEPLOYMENT_TOKEN = $token` | ⛔ Use env var ONLY — do NOT pass `--deployment-token $token` as CLI arg (leaks token in process args / transcript) |
| 3. Copy to temp | `$tempDir = "C:\temp\swa-deploy"; Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Path $tempDir -Force \| Out-Null; Copy-Item -Path .\* -Destination $tempDir -Recurse -Exclude @('.git','.copilot-azure','node_modules','.azure','infra')` | ⛔ **MANDATORY on Windows** — `$env:TEMP` often contains spaces (e.g., `C:\Users\Jane Doe\AppData\Local\Temp`). Always use a hardcoded space-free path on the FIRST attempt — do NOT use `$env:TEMP` and retry. On macOS/Linux, use `/tmp/swa-deploy` instead. |
| 4. Deploy | `swa deploy $tempDir --app-name {swaName} --env production` | ⛔ **`--app-name` is MANDATORY** — without it, the SWA CLI launches an interactive "create new project?" prompt that fails in automation. `{swaName}` = the SWA resource name from `prepare-plan.json.naming.resources[]`. SWA CLI reads `SWA_CLI_DEPLOYMENT_TOKEN` from env var automatically — do NOT pass `--deployment-token` flag (leaks token in command args) |
| 5. Clean up | `Remove-Item -Recurse -Force $tempDir` | Clean temp dir after successful deploy |

⛔ **`az staticwebapp deploy` does NOT exist** — the correct CLI is `swa deploy` (from `@azure/static-web-apps-cli`).

⛔ **SWA deploy audit logging.** Log the `az staticwebapp secrets list` and `swa deploy` commands in `deploy-audit.log`.
