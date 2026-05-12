# Blocked Patterns

Commands the agent must NEVER execute. Block decisions are non-negotiable — user must run blocked commands manually outside AppOnboard.

| Pattern | Action | Reason |
|---------|--------|--------|
| `rm -rf` on `infra/`, `.azure/`, `.copilot-azure/` | ⛔ Block | Prevents accidental IaC deletion |
| `git push --force` to `main` or `master` | ⛔ Block | Prevents force-push of generated code |
| `DROP TABLE` / `DROP DATABASE` | ⛔ Block | Prevents data loss |
| `terraform destroy` | ⛔ Block | Prevents accidental teardown (user must run manually) |
| `az group delete` | ⛔ HARD BLOCK | **NEVER delete resource groups yourself.** During healing: if switching regions/RGs, add the old RG to your `orphanedResourceGroups[]` list (per `OrphanResourceGroup` in `session-schemas-deploy.ts`) instead of deleting it. At handoff: emit `az group delete` commands in the handoff message for the USER to run — the agent never executes them. If you are about to type `az group delete` into a terminal command, STOP — you are violating this rule. Track it in `orphanedResourceGroups[]` instead. |
| `az containerapp up --source` | ⛔ Block | Creates ACR + CA Environment + Log Analytics imperatively — orphan resources invisible to `terraform destroy`, `az deployment sub delete`, and session tag-based bulk cleanup. State drift from IaC is unrecoverable. Use Bicep + `az deployment group create`. For code deploy on existing CA, use Step 6d |
| `az appservice plan update` | ⛔ Block | Imperative SKU change — edit Bicep + redeploy |
| `az webapp update` | ⛔ Block | Imperative resource modification — all changes via IaC |
| `az functionapp update` | ⛔ Block | Imperative resource modification — all changes via IaC |
| `az webapp deployment source config-zip` | ⛔ Block | Requires SCM basic auth — use `az webapp deploy` (Entra auth) |
| `az webapp deploy --track-status` | ⛔ Block | `--track-status` flag does not exist. Remove it. |
| `az webapp up` | ⛔ Block | Creates App Service Plan + App imperatively — bypasses IaC entirely |
| `az containerapp update` (config changes) | ⛔ Block | Imperative resource modification — all changes via IaC |
| `az containerapp update --revision-suffix` (no config changes) | ⚠️ ALLOWED | KV secret rotation only — when KV secrets were updated post-deploy and a new revision is needed to pick up cached values. Log in deploy-audit.log with reason: "KV secret rotation" |
| `az webapp delete` | ⛔ Block | Imperative resource deletion — destroys resources outside IaC |
| `az appservice plan delete` | ⛔ Block | Imperative plan deletion — remove from Bicep + redeploy instead |
| `az containerapp update --image` | ⛔ Block (during healing) | Imperative image swap causes IaC drift — update Bicep + redeploy |
| Inline secret values in CLI args | ⛔ Block | `--parameters password=MyP@ss$word!` breaks shell escaping and leaks secrets in audit logs. Pass secrets via `main.parameters.json`, `terraform.tfvars`, or `az keyvault secret set --file`. |
| Writing secrets to temp files on disk | ⛔ Block | ⛔ NEVER write secrets to temp files on disk. Seed secrets into Key Vault via `az keyvault secret set`, then reference via SecretUri in IaC. Temp files risk exposure in crash dumps, logs, and unprotected storage. |
| `az group create` (during healing) | ⛔ HARD BLOCK | **NEVER create resource groups imperatively during healing.** All RG creation must go through `az deployment sub create` with Bicep `targetScope = 'subscription'`. If you need a new RG for region fallback, update the Bicep region parameter and redeploy. |
| `az rest --method put/patch` (for individual resource creation) | ⛔ HARD BLOCK | **NEVER create individual Azure resources via REST API as a fallback for Bicep failures.** After a deployment failure, the ONLY allowed remediation is: fix the Bicep parameters/template → re-run `az deployment sub create`. Compiling Bicep→ARM and deploying via REST is still imperative resource creation. |

> **Repos with existing `azure.yaml`:** See [`pipeline-rules.md`](../../references/pipeline-rules.md) § azure.yaml prohibition. Deploy via `az deployment sub create` — do NOT run `azd up`.
