# AZD Errors

## Common Errors

| Error | Resolution |
|-------|------------|
| Not authenticated | `azd auth login` |
| No environment | `azd env select <name>` |
| Provision failed | Check Bicep errors in output |
| Deploy failed | Check build/Docker errors |
| Package failed | Verify Dockerfile and dependencies |
| Quota exceeded | Request increase or change region |

## TypeScript Functions Deployment Errors

### Error: "sh: 1: tsc: Permission denied"

**Root Cause:** Local `node_modules/` uploaded with wrong permissions OR TypeScript source excluded.

**Solution:**

1. Ensure `.funcignore` includes `node_modules/` and does NOT exclude `*.ts` or `tsconfig.json`
2. Ensure `azure.yaml` uses `language: ts` for remote build
3. Redeploy: `azd deploy --no-prompt`

**For detailed .funcignore configuration**, see [azure-prepare skill typescript-funcignore.md](../../../../azure-prepare/references/recipes/azd/typescript-funcignore.md)

### Alternative: Switch to Local Build

Update `azure.yaml` to use `language: js` with a `prepackage` hook to run `npm run build`.

## Application Insights Errors

### Error: No Traces in Application Insights

**Symptom:** Function App running but no telemetry in Application Insights.

**Common Causes:**
1. Missing `APPLICATIONINSIGHTS_AUTHENTICATION_STRING` app setting (when `DisableLocalAuth: true`)
2. Missing `Monitoring Metrics Publisher` RBAC role
3. Incorrect client ID for user-assigned identity
4. Managed identity not enabled

**Quick Fix - Add Required Bicep:**
```bicep
// App setting
APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'Authorization=AAD'

// Role assignment
resource appInsightsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, appInsights.id)
  scope: appInsights
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '3913510d-42f4-4e42-8a64-420c390055eb')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

**Verify:**
```bash
az functionapp identity show -g <rg> -n <app>
az functionapp config appsettings list -g <rg> -n <app> --query "[?name=='APPLICATIONINSIGHTS_AUTHENTICATION_STRING']"
```

Wait 5-10 minutes for propagation.

**For complete setup**, see [azure-prepare skill appinsights-auth.md](../../../../azure-prepare/references/recipes/azd/appinsights-auth.md)

## Policy Compliance Errors

### Error: RequestDisallowedByPolicy - Local Auth Not Allowed

**Error Message:**
```
RequestDisallowedByPolicy: Resource 'evhns-xxx' was disallowed by policy.
Reasons: 'Local authentication methods are not allowed.'
```

**Affected Services:** Event Hubs, Service Bus, Storage, Application Insights

**Solution - Add to Bicep:**
- Event Hubs/Service Bus: `disableLocalAuth: true`
- Storage: `allowSharedKeyAccess: false`
- Application Insights: `DisableLocalAuth: true`

Then reprovision: `azd provision --no-prompt`

**For complete examples**, see [azure-prepare skill enterprise-policy.md](../../../../azure-prepare/references/recipes/azd/enterprise-policy.md)

## Retry

```bash
azd up --no-prompt
```

## Cleanup (DESTRUCTIVE)

```bash
azd down --force --purge
```

⚠️ Permanently deletes ALL resources including databases and Key Vaults.
