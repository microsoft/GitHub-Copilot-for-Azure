# Deploy Safety

Hook-based safety rules for the deploy phase. Block destructive operations, audit all deployment commands.

## Blocked Patterns

| Pattern | Action | Reason |
|---------|--------|--------|
| `rm -rf` on `infra/`, `.azure/`, `.copilot-azure/` | ⛔ Block | Prevents accidental IaC deletion |
| `git push --force` to `main` or `master` | ⛔ Block | Prevents force-push of generated code |
| `DROP TABLE` / `DROP DATABASE` | ⛔ Block | Prevents data loss |
| `terraform destroy` | ⛔ Block | Prevents accidental teardown (user must run manually) |
| `az group delete` | ⛔ HARD BLOCK | **NEVER delete resource groups yourself.** During healing: if switching regions/RGs, add the old RG to your `orphanedResourceGroups[]` list (per `OrphanResourceGroup` in `session-schemas-deploy.ts`) instead of deleting it. At handoff: emit `az group delete` commands in `deploy-result.json.cleanupCommands` and the handoff message for the USER to run — the agent never executes them. If you are about to type `az group delete` into a terminal command, STOP — you are violating this rule. Track it in `orphanedResourceGroups[]` instead. |
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

## 403 Scope Fallback

When `az deployment sub create` returns 403 (insufficient subscription-scope permissions), do NOT halt immediately:

1. **Restructure Bicep to RG-scope** — change `targetScope = 'subscription'` to resource-group scope, remove the `Microsoft.Resources/resourceGroups` resource.
2. **Create the RG via CLI** — `az group create -n {rg} -l {region} --tags bya-skill=true bya-session-id={sessionId} created-at={createdAt} environment={environmentName} deployed-by={deployedBy}`. All 5 BYA tags MUST be included.
3. **Retry with `az deployment group create`** — use `--resource-group {rg}` instead of subscription scope.
4. **If retry ALSO fails with 403** → classify as `ENVIRONMENT_BLOCKING`. Surface required role: `az role assignment create --role Contributor --assignee {user} --scope /subscriptions/{sub}/resourceGroups/{rg}`.

Log both attempts in `deploy-audit.log`.

## Audit Log

All deployment commands logged to `.copilot-azure/sessions/{id}/deploy-audit.log` (JSON Lines):

```jsonc
{"timestamp": "2025-01-15T10:30:00Z", "command": "az deployment group create", "args": "--resource-group rg-myapp-dev --template-file infra/main.bicep", "status": "started"}
{"timestamp": "2025-01-15T10:32:15Z", "command": "az deployment group create", "args": "--resource-group rg-myapp-dev --template-file infra/main.bicep", "status": "succeeded", "deploymentId": "abc123"}
```

## Rules

- Every `az deployment` and `terraform apply` command MUST be logged before execution
- Block decisions are non-negotiable — user must run blocked commands manually outside BYA
- Audit log survives session — never delete or truncate during normal operation

## Post-Deploy Tag Verification

> ⛔ After `az deployment sub create` or `az rest` deployment completes, verify all 5 BYA tags are present:
> ```powershell
> az group show -n {rg} --query tags -o json
> ```
> Required tags: `bya-skill`, `bya-session-id`, `created-at`, `environment`, `deployed-by`. If any are missing (common when `az rest` fallback doesn't propagate all parameters), re-apply via `az tag update --resource-id /subscriptions/{sub}/resourceGroups/{rg} --operation merge --tags {missing tags}`.

## `az rest` on Windows PowerShell

> When using `az rest --method put` or `--method patch` on Windows PowerShell, ALWAYS include `--headers "Content-Type=application/json"`. Without it, the request returns 415 Unsupported Media Type. This is a known Windows PowerShell quoting difference — bash does not require it.

## Deployment Operation Polling

> ⛔ **For deployments with >5 resources, poll operations every 30s during `az deployment sub create`:**
> ```powershell
> az deployment operation list --name {deploymentName} --subscription {subscriptionId} --query "[?properties.provisioningState=='Failed'].{resource:properties.targetResource.resourceName, error:properties.statusMessage.error.code}" -o table
> ```
> Wait for FULL completion before healing — collect ALL errors in one pass, fix IaC for all issues, then redeploy. Do NOT fix one error and immediately redeploy — you'll miss concurrent failures and waste healing cycles.

## Re-Approval Gates

> ⛔ **Region or service type changes ALWAYS require re-approval.** If self-healing, error recovery, or quota fallback changes the **region** or **service type** from what the user approved at the deploy gate, you MUST re-present the approval gate with the updated values. Do NOT silently apply region changes.

| Change | Re-Approval Required? | Action |
|--------|----------------------|--------|
| Region changed (e.g., `eastus` → `westus2`) | **YES** | Re-present deploy approval gate with new region |
| Service type changed (e.g., App Service → Container Apps) | **YES** | Route back to prepare for re-planning |
| SKU changed (e.g., F1 → B1) | **YES** | Re-present deploy approval gate with new SKU + cost delta |
| Resource name changed | No | Informational — log in audit |
| Retry same deployment (transient error) | No | Auto-retry per backoff schedule |

## Antipatterns

### RG delete-then-recreate

⛔ Do NOT `az group delete --no-wait` then `az group create` with the same name. Background deletion takes 5-15 minutes — the new RG will be destroyed when the old delete completes. Instead:
- Use a **different RG name** (append new session suffix), OR
- **Wait for deletion**: `az group wait --name {rg} --deleted --timeout 900`

## Artifact Reconciliation After Healing

> ⛔ **Session artifacts MUST stay in sync with deployed state.** Reconciliation is triggered by ANY of: **region change, SKU change, service type change, or resource name change** — because downstream phases (deploy handoff, compliance scans, session resume) read these artifacts for portal links, cost estimates, and cleanup commands. Stale artifacts cause wrong regions in portal links, incorrect costs at handoff, and cleanup commands that miss orphaned resources.
>
> After ANY self-healing action, service switch, or region fallback that changes deployed resources:

1. **Update `prepare-plan.json`** — reflect the actual services, SKUs, and regions deployed (not the original plan). Also set `quotaValidation.verified: true` and `quotaValidation.reason: "Confirmed by successful deployment"` — a completed deployment is the strongest quota proof.
2. **Update `scaffold-manifest.json`** — update `files[]` if IaC was regenerated, update `validationResult` if re-validated
3. **Update `context.json`** — update `azure.region`, service references, and `lastModifiedUtc`
4. **Track orphaned resource groups during healing** — ⛔ When a healing attempt switches to a new RG (region fallback, naming conflict), IMMEDIATELY append the **old** RG to the running `orphanedResourceGroups[]` list (verify it exists + is empty first). This list is written as-is to `deploy-result.json` at Step 8 — no post-hoc diffing.

Stale artifacts cause downstream failures: the handoff references wrong regions, compliance scans check wrong resources, and session resume operates on outdated state.
