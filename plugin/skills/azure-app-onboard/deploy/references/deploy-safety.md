# Deploy Safety

Hook-based safety rules for the deploy phase. Block destructive operations, audit all deployment commands.

## deploy-result.json Skeleton (write at Step 5b)

Write this using `create` tool BEFORE the first `az deployment` command:
```jsonc
{
  "sessionId": "{sessionId}",
  "deploymentNames": ["{deploymentName}"],
  "resourceGroupName": "{rg}",
  "status": "in-progress",
  "resourceIds": [],
  "endpoints": [],
  "healthStatus": "unknown",
  "duration": { "totalSeconds": 0, "startedUtc": "{ISO-now}", "completedUtc": "" },
  "warnings": [],
  "partial": false,
  "resourceResults": [],
  "orphanedResourceGroups": [],
  "healingAttempts": []
}
```
Append to `deploymentNames[]` on each healing retry that generates a new `--name`.

## Deploy Checklist (compaction-safe — generated at Step 5b)

> ⛔ **You MUST read [`deploy-checklist-template.md`](deploy-checklist-template.md)** at Step 5b to generate the checklist. Write the result to `.copilot-azure/sessions/{id}/deploy-checklist.md`. Re-read the generated checklist after every long-running command, failed health check, and conversation compaction.

## Finalize deploy-result.json (Step 8)

Overwrite the skeleton with real values:
- `status` → `"succeeded"` or `"failed"`
- `deploymentNames` → ALL names used (initial + retries)
- `healthStatus` → worst across endpoints
- `duration.completedUtc` → now
- `resourceResults` → one entry per resource from `az deployment operation list`

## Blocked Patterns

> ⛔ **You MUST read [`blocked-patterns.md`](blocked-patterns.md)** before running ANY `az` command during the deploy phase. This file contains every command the agent is forbidden from executing. Block decisions are non-negotiable — user must run blocked commands manually outside AppOnboard.

## 403 Scope Fallback

When `az deployment sub create` returns 403 (insufficient subscription-scope permissions), do NOT halt immediately:

1. **Restructure Bicep to RG-scope** — change `targetScope = 'subscription'` to resource-group scope, remove the `Microsoft.Resources/resourceGroups` resource.
2. **Create the RG via CLI** — `az group create -n {rg} -l {region} --tags app-onboard-skill=true app-onboard-session-id={sessionId} created-at={createdAt} environment={environmentName} deployed-by={deployedBy}`. All 5 AppOnboard tags MUST be included.
3. **Retry with `az deployment group create`** — use `--resource-group {rg}` instead of subscription scope.
4. **If retry ALSO fails with 403** → classify as `ENVIRONMENT_BLOCKING`. Surface required role: `az role assignment create --role Contributor --assignee {user} --scope /subscriptions/{sub}/resourceGroups/{rg}`.

Log both attempts in `deploy-audit.log`.

## Audit Log

> ⛔ **Write INCREMENTALLY — one entry per command, SAME turn as the command.**
> Do NOT batch audit log writes to the end of the phase. Output budget truncation
> will drop them. Each command gets 2 entries (started + result) written immediately.

All deployment commands logged to `.copilot-azure/sessions/{id}/deploy-audit.log`. One line per event, pipe-delimited for low token cost:

```
2025-01-15T10:30:00Z | az deployment group create --rg rg-myapp-dev | started
2025-01-15T10:32:15Z | az deployment group create --rg rg-myapp-dev | succeeded
```

## Rules

- Every `az deployment` and `terraform apply` command MUST be logged before execution
- Block decisions are non-negotiable — user must run blocked commands manually outside AppOnboard
- Audit log survives session — never delete or truncate during normal operation

## Shell Execution Rules

> ⛔ **NEVER use async/background shells for variable setup.** Use sync shells so state (variables, passwords) persists across commands. Async shells exit after the command and lose all state.

> ⛔ **Generate secrets ONCE — reuse everywhere.** For PostgreSQL + Key Vault deployments: generate the password ONCE using `openssl rand -base64 32`, pass to BOTH `az deployment sub create --parameters pgAdminPassword={value}` AND `az keyvault secret set --value {value}` IN THE SAME shell command block. NEVER generate separate passwords — shell variables don't persist across Copilot CLI tool calls.

> ⛔ **`az webapp deploy` does NOT support `--track-status`.** This flag does not exist. Do not add it to any `az webapp deploy` command.

## Post-Deploy Tag Verification

> ⛔ After `az deployment sub create` or `az rest` deployment completes, verify all 5 AppOnboard tags are present:
> ```powershell
> az group show -n {rg} --query tags -o json
> ```
> Required tags: `app-onboard-skill`, `app-onboard-session-id`, `created-at`, `environment`, `deployed-by`. If any are missing (common when `az rest` fallback doesn't propagate all parameters), re-apply via `az tag update --resource-id /subscriptions/{sub}/resourceGroups/{rg} --operation merge --tags {missing tags}`.

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
