# Troubleshooting Guide

Common issues and solutions for Azure deployments.

---

## Quick Diagnostics

```bash
# Check Azure CLI login status
az account show

# Check subscription
az account list --output table

# Test connectivity
az group list --output table
```

---

## Authentication Issues

### "Please run 'az login'"

```bash
# Interactive login (opens browser)
az login

# Device code login (for remote/headless)
az login --use-device-code

# Service principal login (CI/CD)
az login --service-principal -u <app-id> -p <secret> --tenant <tenant-id>
```

### Wrong Subscription

```bash
# List all subscriptions
az account list --output table

# Set correct subscription
az account set --subscription "<name-or-id>"

# Verify
az account show --query name -o tsv
```

### Token Expired

```bash
# Force re-authentication
az account clear
az login
```

---

## Static Web Apps Issues

### Deployment Token Invalid

```bash
# Get new token
az staticwebapp secrets list \
  --name <app> \
  --resource-group <rg> \
  --query "properties.apiKey" -o tsv

# Or reset token
az staticwebapp secrets reset-api-key \
  --name <app> \
  --resource-group <rg>
```

### Wrong Output Directory

Check framework output locations:

| Framework | Output |
|-----------|--------|
| Vite/Vue/React | `dist/` |
| CRA | `build/` |
| Angular | `dist/<project>/browser/` |
| Next.js (static) | `out/` |
| Gatsby | `public/` |
| Astro | `dist/` |

```bash
# Build first, then check output exists
npm run build
ls -la dist/  # or build/, out/, etc.

# Deploy with correct path
swa deploy ./dist --deployment-token $TOKEN
```

### Routes Not Working (404 on Refresh)

Add `staticwebapp.config.json`:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "*.{css,js,png,jpg,svg,ico}"]
  }
}
```

### API Not Deploying

```bash
# Ensure API folder exists and has required files
ls -la api/
# Should have: host.json, package.json (for Node), function folders

# Deploy with API location
swa deploy ./dist --api-location ./api --deployment-token $TOKEN
```

### SWA CLI Errors

```bash
# Update CLI
npm install -g @azure/static-web-apps-cli@latest

# Clear cache
rm -rf ~/.swa

# Debug mode
SWA_CLI_DEBUG=* swa deploy ./dist
```

### SWA CLI Local Server Terminates (macOS)

**Problem:** `swa start` exits unexpectedly or session becomes invalid.

**Cause:** macOS lacks `setsid` command used for process isolation. Background mode may not work correctly.

**Solutions:**
1. **Use alternative preview methods (recommended):**
   ```bash
   # For Vite projects
   npm run build && npm run preview
   
   # For any static site
   npx serve dist
   ```

2. **Run SWA CLI in foreground in a dedicated terminal:**
   ```bash
   # Don't background the process
   swa start ./dist
   # Keep this terminal open while testing
   ```

3. **For API testing, deploy to Azure instead:**
   ```bash
   swa deploy ./dist --deployment-token $TOKEN
   # Test the deployed URL
   ```

---

## Azure Functions Issues

### "func is not recognized"

```bash
# Install Functions Core Tools
npm install -g azure-functions-core-tools@4

# Or via Homebrew (macOS)
brew tap azure/functions
brew install azure-functions-core-tools@4

# Verify
func --version
```

### Missing host.json

Create `host.json` in project root:

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true
      }
    }
  }
}
```

### Storage Connection Error

```bash
# For local development, use emulator
# local.settings.json:
{
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true"
  }
}

# Install and start Azurite
npm install -g azurite
azurite --silent
```

### Runtime Version Mismatch

```bash
# Check deployed runtime
az functionapp config show \
  --name <app> \
  --resource-group <rg> \
  --query "linuxFxVersion" -o tsv

# Update runtime
az functionapp config set \
  --name <app> \
  --resource-group <rg> \
  --linux-fx-version "Node|20"
```

### Deploy Fails with "No functions found"

```bash
# Check function structure
# v4 model (Node.js): Functions in src/functions/
# v1 model: Each function needs function.json

# Ensure package.json has main entry
# package.json: "main": "dist/src/functions/*.js"

# Build before deploy
npm run build
func azure functionapp publish <app>
```

---

## App Service Issues

### "Resource not found"

```bash
# Verify resource exists
az webapp show --name <app> --resource-group <rg>

# If not, create it
az webapp create \
  --name <app> \
  --resource-group <rg> \
  --plan <plan> \
  --runtime "NODE:20-lts"
```

### Wrong Runtime

```bash
# List available runtimes
az webapp list-runtimes --os linux

# Update runtime
az webapp config set \
  --name <app> \
  --resource-group <rg> \
  --linux-fx-version "NODE:20-lts"
```

### App Not Starting

```bash
# Check logs
az webapp log tail --name <app> --resource-group <rg>

# Check startup command
az webapp config show \
  --name <app> \
  --resource-group <rg> \
  --query "appCommandLine"

# Set startup command
az webapp config set \
  --name <app> \
  --resource-group <rg> \
  --startup-file "npm start"
```

### Deployment Fails

```bash
# Enable build during deploy
az webapp config appsettings set \
  --name <app> \
  --resource-group <rg> \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true

# Check deployment logs
az webapp log deployment show \
  --name <app> \
  --resource-group <rg>
```

### Out of Memory

```bash
# Scale up to larger plan
az appservice plan update \
  --name <plan> \
  --resource-group <rg> \
  --sku P1v3

# Or add more instances
az appservice plan update \
  --name <plan> \
  --resource-group <rg> \
  --number-of-workers 2
```

---

## azd Issues

### "azd not found"

```bash
# Install azd
# macOS
brew install azd

# Windows
winget install Microsoft.Azd

# Linux
curl -fsSL https://aka.ms/install-azd.sh | bash

# Verify
azd version
```

### Provision Fails

```bash
# Debug mode
azd provision --debug

# Validate Bicep syntax
az bicep build --file infra/main.bicep

# Check for existing resources with same name
az resource list --name <resource-name> --output table
```

### "Environment not initialized"

```bash
# Create or select environment
azd env new dev
azd env select dev

# Set required values
azd env set AZURE_LOCATION eastus
```

### Bicep Errors

```bash
# Update Bicep CLI
az bicep upgrade

# Validate before deploy
az bicep build --file infra/main.bicep --stdout

# Check for AVM module updates
az bicep restore --file infra/main.bicep
```

---

## Common CLI Errors

### "InvalidTemplateDeployment"

Usually means Bicep/ARM template has errors:

```bash
# Get detailed error
az deployment sub what-if \
  --location <location> \
  --template-file infra/main.bicep \
  --parameters environmentName=test

# Common causes:
# - Resource name already exists
# - Invalid SKU for region
# - Missing required parameters
```

### "AuthorizationFailed"

```bash
# Check your role assignments
az role assignment list --assignee $(az account show --query user.name -o tsv)

# You may need Contributor or Owner role on subscription/resource group
```

### "QuotaExceeded"

```bash
# Check quota
az vm list-usage --location <location> --output table

# Request increase in Azure Portal:
# Subscriptions > Usage + quotas > Request increase
```

### "ResourceGroupNotFound"

```bash
# Create the resource group
az group create --name <rg> --location <location>
```

---

## Network Issues

### CORS Errors (Local Development)

```bash
# Functions: Add to local.settings.json
{
  "Host": {
    "CORS": "*"
  }
}

# Or start with flag
func start --cors "*"
```

### SSL/TLS Errors

```bash
# Skip SSL verification (dev only!)
az config set core.disable_ssl_verification=true

# Better: Update CA certificates
# macOS
brew install ca-certificates

# Ubuntu
sudo apt update && sudo apt install ca-certificates
```

---

## Cleanup

### Delete Failed Deployments

```bash
# Delete resource group (removes all resources)
az group delete --name <rg> --yes --no-wait

# Delete specific resource
az resource delete \
  --ids "/subscriptions/.../resourceGroups/.../providers/..."
```

### Purge Soft-Deleted Resources

```bash
# Key Vault
az keyvault purge --name <vault>

# App Configuration
az appconfig purge --name <config>

# azd (full cleanup)
azd down --purge
```
