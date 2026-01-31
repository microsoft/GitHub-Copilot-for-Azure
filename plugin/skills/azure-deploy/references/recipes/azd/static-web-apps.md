# Static Web Apps Deployment with AZD

Guidance for deploying Azure Static Web Apps using Azure Developer CLI.

## Overview

Azure Static Web Apps (SWA) deployment with `azd` uses the SWA CLI (`swa deploy`) under the hood. The deployment process automatically:
1. Provisions the Static Web App resource in Azure (if needed)
2. Retrieves the deployment token from the resource
3. Builds the app (if build is configured)
4. Deploys static content and API to Azure

## Prerequisites

- Static Web App resource provisioned via `azd provision` or `azd up`
- SWA CLI installed (automatically installed by azd if needed)
- Valid Azure subscription with Static Web Apps available in the target region

## Deployment Command

```bash
# Full deployment (provision + deploy)
azd up --no-prompt

# Deploy only (infrastructure already exists)
azd deploy --no-prompt
```

## Configuration Patterns

### Pure Static HTML Sites (No Build)

For sites with only HTML, CSS, and JavaScript files that don't require a build step:

**azure.yaml:**
```yaml
name: my-static-site
services:
  web:
    project: ./
    host: staticwebapp
    # Do NOT specify 'language' field
    # This prevents npm install attempts
```

**Bicep (infra/main.bicep):**
```bicep
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: '${resourcePrefix}-web-${uniqueHash}'
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/'
      outputLocation: '/'
      skipAppBuild: true  # CRITICAL: Skip Oryx build
    }
  }
}
```

### Sites With Build Steps (React, Vue, Angular)

For SPAs that require `npm run build` or similar:

**azure.yaml:**
```yaml
name: my-react-app
services:
  web:
    project: ./src/web
    language: js
    host: staticwebapp
    dist: build  # Output folder after build
```

**Bicep:**
```bicep
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: '${resourcePrefix}-web-${uniqueHash}'
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/'
      outputLocation: 'build'
      apiLocation: 'api'  # Optional
    }
  }
}
```

### With Azure Functions API

For static sites with integrated serverless API:

**Project Structure:**
```
project/
├── src/
│   ├── index.html
│   └── ...
├── api/
│   ├── hello/
│   │   └── index.js
│   └── host.json
└── azure.yaml
```

**Bicep:**
```bicep
buildProperties: {
  appLocation: 'src'
  apiLocation: 'api'
  outputLocation: 'dist'
}
```

## Common Issues

### Issue: "npm install" runs for pure static site

**Symptom:** azd tries to run `npm install` even though there's no package.json or build process needed.

**Cause:** The `language: js` field in azure.yaml triggers build detection.

**Fix:** Remove the `language` field from azure.yaml for pure static sites:

```yaml
services:
  web:
    project: ./
    host: staticwebapp
    # language: js  <- REMOVE THIS LINE
```

### Issue: "Request is missing the pull request id"

**Symptom:** Deployment fails with error about missing PR ID.

**Cause:** The deployment is configured for preview environments but triggered without a PR context.

**Fix:** This error typically occurs when:
1. Using GitHub Actions workflow that expects `pull_request` trigger but running on `push`
2. Misconfigured deployment token or workflow

**For azd deployments:** This should not occur as azd deploys directly to production. If you see this error, ensure you're using `azd deploy` and not a GitHub Actions workflow.

**For GitHub Actions:** Ensure your workflow is configured correctly:
```yaml
on:
  push:
    branches: [main]     # Production deployment
  pull_request:
    branches: [main]     # Preview deployment
```

### Issue: "Static Web Apps not available in eastus"

**Symptom:** Provisioning fails because Static Web Apps aren't available in the selected region.

**Cause:** Not all Azure regions support Static Web Apps.

**Fix:** Update your `azure.yaml` or `.azure/<env>/.env` file to use a supported region:

Supported regions include:
- `eastus2`
- `westus2`
- `centralus`
- `westeurope`
- `eastasia`

Check current availability: https://azure.microsoft.com/en-us/explore/global-infrastructure/products-by-region/?products=static-apps

### Issue: Deployment succeeds but site shows "Application Error"

**Symptom:** `azd up` completes successfully but the site returns 500 errors or shows "Application Error".

**Cause:** 
1. Incorrect `outputLocation` in buildProperties
2. Build failed but deployment continued
3. Missing index.html in the deployed location

**Fix:**
1. Verify your build output location matches the `outputLocation` setting
2. Check deployment logs: `azd deploy --debug`
3. Ensure your root folder contains `index.html`

## Deployment Token

The deployment token is automatically managed by azd when using `azd deploy`. For manual deployments or CI/CD:

### Get deployment token via Azure CLI:

```bash
az staticwebapp secrets list \
  --name <static-web-app-name> \
  --query "properties.apiKey" \
  -o tsv
```

### Use in GitHub Actions:

```yaml
- name: Deploy
  uses: Azure/static-web-apps-deploy@v1
  with:
    azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
    app_location: '/'
    output_location: 'dist'
```

Store the token as a repository secret named `AZURE_STATIC_WEB_APPS_API_TOKEN`.

## Region Availability

Static Web Apps are not available in all Azure regions. Before provisioning:

1. Check the Azure portal for current region availability
2. Use established regions like `eastus2`, `westus2`, or `westeurope`
3. If your preferred region doesn't support SWA, choose an alternative

Set region in `.azure/<env>/.env`:
```
AZURE_LOCATION=eastus2
```

## Best Practices

1. **Use Free SKU for development/testing**, Standard for production with custom domains and auth requirements
2. **Omit `language` field in azure.yaml for pure static sites** to prevent unnecessary build attempts
3. **Set `skipAppBuild: true` in Bicep** for pure static deployments
4. **Test builds locally** before deploying to ensure build configuration is correct
5. **Use `staticwebapp.config.json`** for routing and authentication configuration
6. **Enable Application Insights** for production deployments to monitor performance

## Verification

After deployment, verify your Static Web App:

```bash
# Get deployment information
azd show

# Test the deployed site
curl -s https://<your-app>.azurestaticapps.net

# Check deployment history in Azure Portal
az staticwebapp show --name <app-name> --query "defaultHostname" -o tsv
```

## References

- [Static Web Apps Service Reference](../../services/static-web-apps.md)
- [Static Web Apps Build Configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration)
- [SWA CLI Documentation](https://azure.github.io/static-web-apps-cli/)
- [Azure Regions with Static Web Apps](https://azure.microsoft.com/en-us/explore/global-infrastructure/products-by-region/?products=static-apps)
