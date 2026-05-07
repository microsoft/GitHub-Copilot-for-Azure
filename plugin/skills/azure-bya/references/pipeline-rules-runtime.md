# Pipeline Rules — Runtime Reference

Known platform bugs and deploy timing. Read before deploy completion or on scaffold/deploy error.

For core pipeline rules (approval gates, phase lifecycle, session artifacts, security baseline), see [pipeline-rules.md](pipeline-rules.md).

## Known Platform Bugs

| Bug | Symptom | Workaround |
|-----|---------|------------|
| SWA CLI Windows path with spaces | `StaticSitesClient.exe` fails when workspace path contains spaces | Use a space-free temp path on FIRST attempt (e.g., `C:\temp\swadeploy`) — do NOT wait for retry. Copy app content to the temp path before running `swa deploy`. |
| `az deployment sub validate` HTTP stream | "HTTP response stream consumed" error (known Azure CLI bug) | Use `az deployment sub what-if` instead |
| `az deployment sub create` HTTP stream | Same "content already consumed" error on `create` (not just `validate`) — Azure CLI 2.75.0+ | Use `az rest --method PUT` on the deployment URI as fallback. See deploy SKILL.md § 403 Scope Fallback for the REST API pattern. |
| `az quota list` extension permission error | `PermissionError: [WinError 5] Access is denied` — can be from ANY extension (quota, azure-devops, etc.), blocks ALL `az` extension commands | **Use `az rest` instead of `az quota list`.** `az rest` is a built-in command that bypasses extension loading entirely. See [sku-quota-validation.md](../prepare/references/sku-quota-validation.md) for the `az rest` URL pattern. Do NOT attempt to fix the extension — the REST API approach is strictly superior. |
| Managed identity sidecar OOM on F1/B1 Linux | `503 Service Unavailable` with `Microsoft.Azure.WebSites.DataProtection` or `/msi/token` timeout | Avoid managed identity on F1/B1 Linux — use connection strings or upgrade SKU |
| `Compress-Archive` path flattening | PowerShell's `Compress-Archive -Path $files.FullName` uses absolute paths, flattening directory structure | Use `System.IO.Compression.ZipFile` with relative paths instead |
| AADSTS530084 (Terraform) | Token protection conditional access policy breaks `azurerm` provider auth; regular `az` CLI commands work fine | Re-scaffold as Bicep |
| Secret values with shell special chars | Passwords containing `$`, `` ` ``, `!`, `'`, `"` break when passed as inline CLI args (`--parameters key=val`) | **ALWAYS pass secrets via `main.parameters.json` or `terraform.tfvars`** — never as inline `--parameters` args. For deploy-phase secret seeding (`az keyvault secret set`), use `--file` with a temp file or pipe from stdin to avoid shell interpolation. |
| `az acr task logs` encoding crash on Windows | `UnicodeEncodeError: 'charmap' codec can't encode character '\u2a2f'` when streaming ACR build logs containing Unicode (e.g., Next.js ⨯ error marker) | Use `--no-format` flag + strip non-ASCII: `az acr task logs --run-id {id} --no-format 2>$null \| ForEach-Object { $_ -replace '[^\x20-\x7E]', '?' }`. Or use REST API: get log SAS URL via `az rest --method POST --url ".../runs/{runId}/listLogSasUrl?api-version=2019-06-01-preview" --query logLink -o tsv` then download with `Invoke-RestMethod`. |
| `create` tool nested path failure | `"Parent directory does not exist"` when creating files in `.copilot-azure/sessions/{id}/` | Run `New-Item -ItemType Directory -Path {parent} -Force` before `create`. Platform tool limitation — agent always recovers. |
| Windows PowerShell `az rest` 415 error | `az rest --method put --body '{json}'` returns `415 Unsupported Media Type` on Windows PowerShell | Add `--headers "Content-Type=application/json"` to every `az rest --method put` call |

## Deploy Timing

- **F1 App Service cold-start:** After IaC creation, F1 plans need 30–120 seconds before the Kudu sidecar is ready. Deploying code immediately after `az deployment group create` returns causes 504 Gateway Timeout. Wait for sidecar readiness before code deployment.
- **Identity tag resolution:** Resolve `deployed-by` once at session start via `az ad signed-in-user show`. Without this, resources may receive inconsistent tag values (display name, UPN, or hardcoded strings) across different runs.

## Context Compaction Recovery

⛔ **After ANY conversation compaction during the deploy phase, re-read `deploy/SKILL.md` Steps 4-8 before proceeding.** Compaction during long-running `az deployment sub create` (7-18 min) evicts the approval gate template, portal link pattern, audit log format, deploy-result.json template, and SCM lockdown procedure. If compaction occurs between scaffold and deploy gates, the approval gate format is also lost.

## Shell Usage Rules

⛔ **NEVER use async/background shells for variable setup, password generation, or any operation whose output is needed by subsequent commands.** Use synchronous shells for ALL deploy-phase operations. Shell variables do NOT persist between tool calls — generate secrets inline within the SAME command that consumes them. Never store passwords in `$env:` variables for later use across separate tool calls.
