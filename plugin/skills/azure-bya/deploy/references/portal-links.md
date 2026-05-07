# Portal Monitoring Links

Print a portal monitoring link immediately after the deployment command is launched — do NOT wait for it to finish. The user wants to watch resources being created in real time.

## Generate via PowerShell — NEVER construct manually

The `%2F` encoding is critical and models consistently decode it back to `/` during text generation, producing broken links. Always use `.Replace('/', '%2F')`.

```powershell
# Subscription-scope deployment
$resId = "/subscriptions/{subscriptionId}/providers/Microsoft.Resources/deployments/{deploymentName}"
$link = "https://portal.azure.com/#view/HubsExtension/DeploymentDetailsBlade/~/overview/id/$($resId.Replace('/', '%2F'))"
Write-Output $link
Start-Process $link

# Resource-group-scope deployment
$resId = "/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.Resources/deployments/{deploymentName}"
$link = "https://portal.azure.com/#view/HubsExtension/DeploymentDetailsBlade/~/overview/id/$($resId.Replace('/', '%2F'))"
Write-Output $link
Start-Process $link
```

Substitute `{subscriptionId}`, `{resourceGroup}`, `{deploymentName}` with real values.

For Terraform (no single ARM deployment): `https://portal.azure.com/#@{tenantId}/resource/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/activitylog`

> 💡 For Bicep, always pass an explicit `--name` so the link is deterministic. Resolve `{subscriptionId}` and `{resourceGroup}` from `context.json`. For Terraform, resolve `{tenantId}` via `az account show --query tenantId -o tsv`.

## Chat Output Rules

1. **Chat output:** `🔗 Monitor your deployment:`
2. **Terminal command:** the PowerShell snippet above (outputs the bare URL and auto-opens it in the default browser via `Start-Process`)
3. **Read the terminal output** — extract the URL string
4. **Chat output (next message):** paste the bare URL on its own line — no backticks, no markdown, no emoji on the same line

⛔ **Link must be ctrl+clickable.** The URL MUST be the ONLY content on its line — no emoji, no text, no backticks, no markdown formatting, no `[text](url)` wrapping on the same line. Terminals auto-linkify bare URLs but ONLY when the URL is alone on the line.

⛔ **Emit a NEW link for each deployment attempt.** When healing causes a redeploy with a different `--name`, print a new link and mark the previous one superseded:
```
⚠️ Previous deployment link is stale — use this one:
https://portal.azure.com/.../{newDeploymentName}
```
