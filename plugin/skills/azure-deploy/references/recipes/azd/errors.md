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

**Symptom:** TypeScript compilation fails during remote build with permission errors.

**Root Cause:** Local `node_modules/` was uploaded with incorrect permissions, OR TypeScript source files were excluded from deployment.

**Solution:**

1. **Check `.funcignore` excludes `node_modules/`**:
   ```
   node_modules/
   ```

2. **Ensure `.funcignore` does NOT exclude TypeScript files**:
   - ❌ Do NOT have: `*.ts` or `tsconfig.json` in `.funcignore`
   - ✅ TypeScript source and config must be uploaded for remote build

3. **Correct `.funcignore` for remote build**:
   ```
   *.js.map
   .git*
   .vscode
   __azurite_db*__.json
   __blobstorage__
   __queuestorage__
   local.settings.json
   test
   node_modules/
   ```

4. **Ensure azure.yaml uses `language: ts`**:
   ```yaml
   services:
     functions:
       project: ./src/functions
       language: ts  # For remote build
       host: function
   ```

5. **Redeploy**:
   ```bash
   azd deploy --no-prompt
   ```

**Reference:** [TypeScript .funcignore fix](https://github.com/Azure-Samples/remote-mcp-functions-typescript/pull/35)

### Alternative: Local Build

If remote build continues to fail, switch to local build:

1. **Update azure.yaml**:
   ```yaml
   services:
     functions:
       project: ./src/functions
       language: js  # Changed from 'ts'
       host: function
       hooks:
         prepackage:
           shell: sh
           run: npm run build
   ```

2. **Update `.funcignore`** to exclude source:
   ```
   *.ts
   tsconfig.json
   node_modules/
   ```

3. **Redeploy**:
   ```bash
   azd deploy --no-prompt
   ```

## Application Insights Errors

### Error: No Traces in Application Insights

**Symptom:** Function App is running, but no telemetry appears in Application Insights.

**Common Causes:**

1. **Missing identity-based authentication configuration** (when `DisableLocalAuth: true`):

   **Check if App Insights has `DisableLocalAuth: true`**:
   ```bash
   az monitor app-insights component show -g <resource-group> -n <app-insights-name> --query "disableLocalAuth"
   ```

   **Solution:** Add required app setting and RBAC role:

   **App Setting** (add to Bicep):
   ```bicep
   APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'Authorization=AAD'
   ```

   **RBAC Role Assignment** (add to Bicep):
   ```bicep
   resource appInsightsRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
     name: guid(functionApp.id, appInsights.id, 'MonitoringMetricsPublisher')
     scope: appInsights
     properties: {
       roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '3913510d-42f4-4e42-8a64-420c390055eb')
       principalId: functionApp.identity.principalId
       principalType: 'ServicePrincipal'
     }
   }
   ```

2. **Incorrect authentication string for user-assigned identity**:

   For user-assigned managed identity:
   ```bicep
   APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'ClientId=${userAssignedIdentity.properties.clientId};Authorization=AAD'
   ```

3. **Missing managed identity on Function App**:
   
   Ensure Function App has managed identity enabled:
   ```bicep
   resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
     name: functionAppName
     identity: {
       type: 'SystemAssigned'
       // or for user-assigned:
       // type: 'UserAssigned'
       // userAssignedIdentities: {
       //   '${userAssignedIdentity.id}': {}
       // }
     }
   }
   ```

**Verification Steps:**

1. Check identity exists:
   ```bash
   az functionapp identity show -g <resource-group> -n <function-app-name>
   ```

2. Check app setting exists:
   ```bash
   az functionapp config appsettings list -g <resource-group> -n <function-app-name> --query "[?name=='APPLICATIONINSIGHTS_AUTHENTICATION_STRING']"
   ```

3. Check role assignment exists:
   ```bash
   az role assignment list --scope /subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Insights/components/<app-insights-name> --query "[?roleDefinitionName=='Monitoring Metrics Publisher']"
   ```

4. Wait 5-10 minutes for propagation, then test the function.

## Policy Compliance Errors

### Error: RequestDisallowedByPolicy - Local Auth Not Allowed

**Full Error:**
```
RequestDisallowedByPolicy: Resource 'evhns-xxx' was disallowed by policy.
Reasons: 'Local authentication methods are not allowed.'
```

**Affected Services:**
- Event Hubs
- Service Bus
- Storage Accounts
- Application Insights

**Solution:** Add security property to Bicep resource:

**Event Hubs:**
```bicep
properties: {
  disableLocalAuth: true
}
```

**Service Bus:**
```bicep
properties: {
  disableLocalAuth: true
}
```

**Storage Account:**
```bicep
properties: {
  allowSharedKeyAccess: false
}
```

**Application Insights:**
```bicep
properties: {
  DisableLocalAuth: true  // Note: Capital 'D'
}
```

Then reprovision:
```bash
azd provision --no-prompt
```

## Retry

```bash
azd up --no-prompt
```

## Cleanup (DESTRUCTIVE)

```bash
azd down --force --purge
```

⚠️ Permanently deletes ALL resources including databases and Key Vaults.
