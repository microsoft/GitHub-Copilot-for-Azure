# Portal Monitoring Links

Single source for the deployment portal link. deploy/SKILL.md Step 6 and the preflight checklist both reference this file — do NOT re-derive or improvise a different URL format anywhere.

Generate the portal link **BEFORE** running `az deployment sub create` — the deployment name is deterministic, so the link resolves before the deployment even starts. The user wants to watch resources being created in real time. Generating it after the deployment completes defeats this.

## Generate via PowerShell — NEVER construct manually

The `%2F` encoding is critical and models consistently decode it back to `/` during text generation, producing broken links. Always use `.Replace('/', '%2F')`.

```powershell
# Subscription-scope deployment (default)
$deploymentName = "app-onboard-deploy-$('{sessionId}'.Substring(0,8))"
$resId = "/subscriptions/{subscriptionId}/providers/Microsoft.Resources/deployments/$deploymentName"
$link = "https://portal.azure.com/#view/Microsoft_Azure_Resources/DeploymentDetails.MenuView/~/overview/id/$($resId.Replace('/', '%2F'))"
Write-Output "LINK=$link"
Start-Process $link 2>$null
```

Read the `LINK=` line from terminal output and print the URL in chat on its own bare line. Then deploy:
```powershell
az deployment sub create --name $deploymentName --subscription {subscriptionId} --location {location} --template-file infra/main.bicep --parameters @infra/main.parameters.json
```

### RG-scope (403 fallback)

Use `az deployment group create --name $deploymentName --resource-group {rg}` and adjust `$resId` to include `/resourceGroups/{rg}`:
```powershell
$resId = "/subscriptions/{subscriptionId}/resourceGroups/{rg}/providers/Microsoft.Resources/deployments/$deploymentName"
$link = "https://portal.azure.com/#view/Microsoft_Azure_Resources/DeploymentDetails.MenuView/~/overview/id/$($resId.Replace('/', '%2F'))"
Write-Output "LINK=$link"
Start-Process $link 2>$null
```

### Terraform (no single ARM deployment)

`https://portal.azure.com/#@{tenantId}/resource/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/activitylog`

> 💡 Resolve `{subscriptionId}` and `{resourceGroup}` from `context.json`. For Terraform, resolve `{tenantId}` via `az account show --query tenantId -o tsv`.

## Chat output rules

- Paste the bare URL on its **own line** — no backticks, no markdown link syntax, no emoji on the same line. Terminals auto-linkify bare URLs ONLY when the URL is alone on the line, so it stays ctrl+clickable.
- This is a deployment-details link, NOT a resource-group `/overview` link. A resource-group link does not show live provisioning progress.

## Same-scope retries vs new names

The portal link stays valid for same-scope retries — ARM overwrites in place. Generate a new name (e.g., `app-onboard-deploy-{first8}-2`) **only** when scope or RG changes.

⛔ **Emit a NEW link whenever the deployment name changes.** When healing causes a redeploy with a different `--name`, re-run the snippet with the new name and print the new link:
```
⚠️ Previous deployment link is stale — use this one:
https://portal.azure.com/.../{newDeploymentName}
```
