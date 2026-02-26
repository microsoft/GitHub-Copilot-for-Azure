# Proposed Update: azure-validate → references/policy-validation.md or SKILL.md

> **Source**: AWS Lambda face-blur migration to Azure Functions (Flex Consumption)
> **Target**: `~/.agents/skills/azure-validate/references/policy-validation.md` or SKILL.md validation steps
> **Location**: Add as new validation checks

---

## Flex Consumption + EventGrid Source Validation Checks

When validating a Function App that uses blob triggers with `source: 'EventGrid'` on Flex Consumption, verify the following before deployment:

### Pre-Deployment Checklist

| # | Check | How to Verify | Failure Impact |
|---|-------|---------------|----------------|
| 1 | **alwaysReady configured for blob group** | Inspect Bicep for `alwaysReady: [{ name: 'blob', instanceCount: 1 }]` in `scaleAndConcurrency` | Trigger group never starts → events never delivered |
| 2 | **Queue endpoint configured** | Verify `AzureWebJobsStorage__queueServiceUri` is in app settings | Function fails to index with QueueServiceClient constructor error |
| 3 | **Event Grid subscription in Bicep (not CLI)** | Check that `Microsoft.EventGrid/systemTopics/eventSubscriptions` resource exists in `infra/` | CLI webhook validation times out on Flex Consumption |
| 4 | **Storage Queue Data Contributor RBAC** | Verify role assignment in Bicep alongside Storage Blob Data Owner | 403 errors during blob trigger indexing |
| 5 | **UAMI client ID passed to DefaultAzureCredential** | Check for `managedIdentityClientId: process.env.AZURE_CLIENT_ID` in SDK usage | Auth fails — tries System Assigned identity first |
| 6 | **AZURE_CLIENT_ID app setting exists** | Verify in Bicep app settings, pointing to UAMI client ID | DefaultAzureCredential cannot find UAMI |
| 7 | **disableLocalAuth on Cognitive Services** | Check Bicep for `disableLocalAuth: true` on any Cognitive Services accounts | Enterprise policy violation; API keys exposed |
| 8 | **allowSharedKeyAccess: false on Storage** | Check Bicep for `allowSharedKeyAccess: false` on storage accounts | Shared key access remains enabled |
| 9 | **Beta SDK versions pinned explicitly** | Check package.json for exact versions (e.g., `1.0.0-beta.3` not `^1.0.0`) | npm install fails to resolve version |
| 10 | **Event Grid webhook URL uses listKeys()** | Verify Bicep event subscription uses `listKeys()` for `blobs_extension` system key | Webhook URL missing auth key → 401 on event delivery |

### Validation Commands

```bash
# After azd provision, verify Event Grid subscription exists
az eventgrid system-topic event-subscription list \
  --system-topic-name evgt-<storageAccountName> \
  --resource-group <rg> -o table

# Verify function app has alwaysReady configured
az functionapp show --name <funcApp> --resource-group <rg> \
  --query "properties.functionAppConfig.scaleAndConcurrency.alwaysReady" -o json

# Verify RBAC roles assigned
az role assignment list --assignee <uamiPrincipalId> --scope <storageAccountId> -o table

# Verify queue endpoint in app settings
az functionapp config appsettings list --name <funcApp> --resource-group <rg> \
  --query "[?name=='AzureWebJobsStorage__queueServiceUri'].value" -o tsv
```
