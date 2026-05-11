# Bicep — App Service Patterns

App Service-specific Bicep patterns. For shared patterns (skeleton, naming, tags, security defaults, data modules), see [bicep-patterns.md](bicep-patterns.md).

## Module Template

Standard App Service module with managed identity and SCM/FTP auth disabled. Use this as the base for ALL App Service resources.

```bicep
param location string
param tags object
param appServicePlanId string
param appServiceName string

resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
    }
  }
}

// SCM basic auth — enabled in IaC for deploy convenience. Deploy phase re-disables via REST API after code upload.
resource scmAuth 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: appService
  name: 'scm'
  properties: {
    allow: true
  }
}

// ⛔ MANDATORY — disable FTP basic auth
resource ftpAuth 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: appService
  name: 'ftp'
  properties: {
    allow: false
  }
}

output appServiceId string = appService.id
output principalId string = appService.identity.principalId
```

> ⛔ **Every App Service module MUST include:** (1) `identity: { type: 'SystemAssigned' }`, (2) `scm` basicPublishingCredentialsPolicies with `allow: true` (IaC sets enabled for deploy convenience — deploy phase re-disables via REST API after code upload), (3) `ftp` basicPublishingCredentialsPolicies with `allow: false`. Missing any of these → self-review L1 `FLAGGED`.

## Native Module Deploy Strategy

When `prepare-plan.json.deployStrategy` exists with `codeDeployPattern: "startup-install"`, apply these patterns to the App Service Bicep:

```bicep
resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  tags: tags
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|${nodeVersion}'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      // Startup command: Oryx build is primary, this is the safety-net fallback.
      // Runs npm install only if node_modules doesn't exist (Oryx missed it).
      // MUST be inline — never a .sh file (Windows CRLF → bash exit code 2).
      appCommandLine: '${deployStrategy.startupCommand}'
      appSettings: [
        // Primary: tell Oryx to run npm install during zip deploy
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'ENABLE_ORYX_BUILD', value: 'true' }
        // Extended timeout for native module compilation (max 1800, default 230)
        { name: 'WEBSITES_CONTAINER_START_TIME_LIMIT', value: '1800' }
        // App-specific settings
        { name: 'NODE_ENV', value: 'production' }
      ]
    }
  }
}
```

**Rules:**
- ⛔ **Inline `appCommandLine` only** — never generate a `.sh` startup script file. Files created on Windows have CRLF line endings → bash exit code 2 on Linux
- ⛔ **Entry point from manifest** — read `package.json.scripts.start` or `.main`, never hardcode `index.js`
- ⛔ **`WEBSITES_CONTAINER_START_TIME_LIMIT` = 1800** (the maximum). Native compilation takes 2-5 min; Python with scipy can take longer
- When `deployStrategy` is absent (no native modules), do NOT set `appCommandLine` — let Oryx use its default startup

**Self-review check (L2 Pattern):** If `prereq-output.json.components[].buildRequirements.hasNativeModules == true` for a component mapped to App Service, verify the Bicep contains BOTH `appCommandLine` and `WEBSITES_CONTAINER_START_TIME_LIMIT`. Mark as **FLAGGED** if either is missing.
