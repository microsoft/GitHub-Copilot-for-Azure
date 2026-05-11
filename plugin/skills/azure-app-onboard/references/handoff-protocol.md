# Handoff Protocol — Step 9

Offer next steps: CI/CD setup, monitoring, domain config, **🗑️ resource cleanup**, skill-based suggestions. Session artifacts remain for deferred pickup.

## Deployment Identity

> ⛔ **Start handoff with deployment identity.** First lines of the handoff response MUST be:
> ```
> 🏢 Subscription: {context.json.azure.subscriptionName} ({context.json.azure.subscriptionId})
> 📁 Resource Group: {context.json.azure.resourceGroup}
> 🌍 Region: {context.json.azure.region}
> 🔗 Portal: https://portal.azure.com/#@/resource/subscriptions/{subId}/resourceGroups/{rgName}/overview
> ```
> Source: `context.json.azure`. This is the user's quickest path to finding their resources after the session ends.

See [deployment-summary-template.md](deployment-summary-template.md) for the full deployment summary format.

## Artifact Self-Check

> ⛔ **Artifact self-check — MANDATORY before handoff.** Verify these exist before presenting cleanup or next steps:
> 1. `deploy-result.json` in session folder — if missing, read [`session-schemas-deploy.ts`](session-schemas-deploy.ts) and write it NOW with status, endpoints, health, `orphanedResourceGroups[]`
> 2. `deploy-audit.log` in session folder — if missing, reconstruct from terminal history
> 3. Portal deployment link printed in chat — if missing, generate from `$resId` pattern (see deploy/SKILL.md Step 6) and print now

## Post-Deploy Recommendations

> ⛔ **`postDeployRecommendations[]` MUST be surfaced — not silently dropped.** Read `prepare-plan.json.postDeployRecommendations[]` (already merged with prereq findings by the prepare phase). Present EACH entry as a numbered recommendation with this format:
> ```
> 📋 Post-deploy recommendations:
> 1. **{title}** ({effort} effort) — {reason}. Services: {services[]}
> 2. ...
> ```
> This section MUST appear BEFORE the skill-based suggestions and AFTER the cleanup commands. If `postDeployRecommendations[]` is empty, print "No post-deploy recommendations." Do NOT skip this section — findings buried in JSON artifacts are easily dropped from the handoff if not explicitly surfaced here.

## Cleanup Commands

> ⛔ **Cleanup commands are MANDATORY — always print BOTH.** Every handoff must include these two cleanup blocks, regardless of whether healing occurred or orphans exist.

**Primary cleanup (always print):**
```
🗑️ Delete this deployment's resources:
  → az group delete -n {rg} --yes --no-wait
```
For Terraform: `cd infra && terraform destroy`.

**Tag-based bulk cleanup (always print — catches orphans from healing):**
```
🏷️ Delete ALL resources from this AppOnboard session (safety net):
  → az group list --tag app-onboard-session-id={sessionId} --query "[].name" -o tsv | ForEach-Object { az group delete -n $_ --yes --no-wait }
```
This command finds every RG tagged with the current session ID — including orphans created during region fallback or naming conflict healing that may not appear in `deploy-result.json`. It is the authoritative cleanup path.

**If `deploy-result.json.orphanedResourceGroups[]` is non-empty**, also list each known orphan explicitly:
```
⚠️ Orphaned resource groups from healing:
- rg-myapp-dev-eastus (empty — region fallback to westus2)
  → az group delete -n rg-myapp-dev-eastus --yes --no-wait
```
For orphans with a `subscription` field (from subscription switch healing), include `--subscription {subscription}` in the delete command.

**If `deploy-result.json.healingAttempts[]` is non-empty**, surface a healing summary:
```
⚕️ Deployment required {N} healing attempts:
{for each attempt: "  - Attempt {N}: {error} → {action} → {outcome}"}
```
This tells the user WHY the deployment took longer than expected and what was automatically fixed. Include subscription changes, naming renames, region fallbacks — anything the user should be aware of.

**Cross-session cleanup (optional — show if user asks):**
```
🔍 Find ALL AppOnboard resources across all sessions:
  → az group list --tag app-onboard-skill=true -o table
```

## Skill-Based Next Steps

> ⛔ **Skill-based next steps are MANDATORY.** Always suggest at minimum `azure-compliance` and `azure-resource-visualizer`. Evaluate every condition below.

| Condition | Suggest | Why |
|-----------|---------|-----|
| Always | **`azure-compliance`** — "Run a compliance scan on your deployed resources" | Security/best-practice audit of what was just created |
| Always | **`azure-resource-visualizer`** — "Generate an architecture diagram of your resource group" | Visual confirmation of deployed topology |
| Health check failed or `healthStatus: "degraded"/"unreachable"` | **`azure-diagnostics`** — "Troubleshoot your deployment with diagnostics" | Deep troubleshooting beyond AppOnboard's health checks |
| `context.json.intent` mentions auth, login, OAuth, or `prereq-output.json` detected MSAL/passport/auth libraries | **`entra-app-registration`** — "Set up app registration for your auth flow" | OAuth/MSAL requires Entra app reg that AppOnboard doesn't scaffold |
| `postDeployRecommendations[]` contains upgrade suggestions | **`azure-upgrade`** — "Upgrade your runtime or framework version" | Framework/runtime migration is outside AppOnboard scope |
| Deployed resources include storage-heavy patterns | **`azure-storage`** — "Optimize your storage configuration" | Storage tuning beyond IaC defaults |
| `postDeployRecommendations[]` contains entries with "RBAC", "role", or "custom role" in title/reason | **`mcp_azure_mcp_role`** — "I can configure the custom role assignments for your deployed resources now. Want me to run it?" Call `mcp_azure_mcp_role` with `intent: "list role assignments for resource group {rgName}"` to show current state, then offer to create the custom role definition. | AppOnboard scaffolds built-in roles only; custom roles require post-deploy configuration via the RBAC MCP tool |

> ⛔ **Auth-aware handoff — MANDATORY CHECK.** Before presenting next steps, scan `context.json.intent` for auth/login/OAuth keywords AND check `prereq-output.json` for MSAL, passport, `@azure/msal-*`, `next-auth`, `auth0`, or any auth library detection. If either condition is true, you MUST include **`entra-app-registration`** in the handoff: "Set up app registration for your auth flow." OAuth/MSAL requires an Entra app registration that AppOnboard does not scaffold — omitting this leaves the user with a broken auth flow.
