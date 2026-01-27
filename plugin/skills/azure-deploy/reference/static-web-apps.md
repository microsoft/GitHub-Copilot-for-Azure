# Static Web Apps Deployment Guide

Deploy static frontends and JAMstack applications with optional serverless APIs.

---

## Overview

Azure Static Web Apps provides:
- Global CDN distribution
- Free SSL certificates
- Integrated serverless APIs (managed Functions)
- GitHub/Azure DevOps CI/CD integration
- Preview environments for pull requests

**Best for:** React, Vue, Angular, Svelte, Gatsby, Hugo, plain HTML/CSS/JS sites

---

## Quick Start

```bash
# Create resource group
az group create --name myswa-rg --location centralus

# Create Static Web App (limited regions: centralus, eastus2, westus2, westeurope, eastasia)
az staticwebapp create \
  --name myswa \
  --resource-group myswa-rg \
  --location centralus \
  --sku Free

# 3. Get deployment token
TOKEN=$(az staticwebapp secrets list \
  --name myswa \
  --resource-group myswa-rg \
  --query "properties.apiKey" -o tsv)

# 4. Build and deploy
npm run build
swa deploy ./dist --deployment-token $TOKEN
```

---

## SKU Options

| SKU | Price | Features |
|-----|-------|----------|
| **Free** | $0 | 2 custom domains, 100GB bandwidth, community support |
| **Standard** | ~$9/mo | 5 custom domains, password protection, custom auth |

```bash
# Create with Standard SKU
az staticwebapp create \
  --name <app> \
  --resource-group <rg> \
  --sku Standard
```

---

## SWA CLI Usage

### Installation Options

**Option 1: Install locally in project (recommended)**
```bash
npm install -D @azure/static-web-apps-cli
```

Verify: `npx swa --version`

**Option 2: Install globally**
```bash
npm install -g @azure/static-web-apps-cli
```

Verify: `swa --version`

**Option 3: Use npx without installation (no setup required)**
```bash
npx @azure/static-web-apps-cli --version
```

> 💡 **Best Practice**: Use `npx swa` commands instead of `swa` directly to avoid "command not found" errors. This works whether SWA CLI is installed locally, globally, or not at all.

### Configuration Setup

**IMPORTANT: Do not use `swa init`. Create `swa-cli.config.json` manually for better control.**

**Example swa-cli.config.json:**
```json
{
  "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
  "configurations": {
    "app": {
      "appLocation": ".",
      "apiLocation": "api",
      "outputLocation": "dist",
      "appBuildCommand": "npm run build",
      "apiBuildCommand": "npm run build --if-present",
      "run": "npm run dev",
      "appDevserverUrl": "http://localhost:5173",
      "appName": "myapp",
      "resourceGroup": "myapp-rg"
    }
  }
}
```

**Configuration properties:**
- `appLocation` - Directory containing frontend source code
- `apiLocation` - Directory containing Azure Functions API code
- `outputLocation` - Build output directory (relative to appLocation)
- `appBuildCommand` - Command to build frontend
- `apiBuildCommand` - Command to build API
- `run` - Command to start dev server
- `appDevserverUrl` - Dev server URL to proxy
- `appName` - Azure Static Web App resource name
- `resourceGroup` - Azure resource group name

For complete schema, see: https://aka.ms/azure/static-web-apps-cli/schema

### Local Development

```bash
# Start with auto-detection (uses swa-cli.config.json)
npx swa start

# Specify build output and API
npx swa start ./dist --api-location ./api

# Proxy to dev server
npx swa start http://localhost:3000 --api-location ./api

# With custom port
npx swa start --port 4280

# Auto-start dev server
npx swa start http://localhost:3000 --run "npm start"
```

> 💡 **Tip**: If you have SWA CLI installed globally, you can use `swa` instead of `npx swa`.

**Common framework ports:**
| Framework | Port |
|-----------|------|
| React/Vue/Next.js | 3000 |
| Angular | 4200 |
| Vite | 5173 |

### Deploy

```bash
# Deploy using config (uses appName and resourceGroup from swa-cli.config.json)
npx swa deploy

# Deploy specific folder
npx swa deploy ./dist

# Deploy to production environment
npx swa deploy --env production

# Deploy with deployment token
npx swa deploy --deployment-token <TOKEN>

# Preview without deploying
npx swa deploy --dry-run

# Deploy with verbose output (RECOMMENDED for debugging)
npx swa deploy --verbose silly
```

> 💡 **Tip**: Always use `--verbose silly` flag when troubleshooting deployments to see all error details.

**Get deployment token:**
- Azure Portal: Static Web App → Overview → Manage deployment token
- CLI: `npx swa deploy --print-token`
- Environment variable: `SWA_CLI_DEPLOYMENT_TOKEN`

---

## Configuration: staticwebapp.config.json

Place in your output directory or repository root:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/images/*", "/api/*", "*.{css,js,png,jpg,svg}"]
  },
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/admin/*",
      "allowedRoles": ["admin"]
    }
  ],
  "responseOverrides": {
    "401": {
      "statusCode": 302,
      "redirect": "/.auth/login/aad"
    },
    "404": {
      "rewrite": "/404.html"
    }
  },
  "globalHeaders": {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff"
  },
  "platform": {
    "apiRuntime": "node:22"
  }
}
```

---

## Framework-Specific Setup

### Plain HTML (No Build Step)

For plain HTML sites without a build process, SWA CLI requires files in a dedicated output folder:

```bash
# Create output directory and copy files
mkdir -p dist
cp -r *.html *.css *.js *.png *.jpg *.svg dist/ 2>/dev/null || true

# Get deployment token
TOKEN=$(az staticwebapp secrets list \
  --name <app-name> \
  --resource-group <resource-group> \
  --query "properties.apiKey" -o tsv)

# Deploy from dist folder
swa deploy ./dist --deployment-token "$TOKEN" --env production

# Clean up temp folder (optional)
rm -rf dist
```

**Note:** SWA CLI does not support deploying directly from the root directory when it contains only HTML files. Always use an output folder like `dist/` or `public/`.

### React (Vite/CRA)

```bash
# Build
npm run build

# Deploy (Vite outputs to dist/, CRA to build/)
swa deploy ./dist --deployment-token $TOKEN
```

### Vue (Vite)

```bash
npm run build
swa deploy ./dist --deployment-token $TOKEN
```

### Angular

```bash
npm run build
# Output is in dist/<project-name>/browser
swa deploy ./dist/<project-name>/browser --deployment-token $TOKEN
```

### Next.js (Static Export)

Add to `next.config.js`:
```javascript
module.exports = {
  output: 'export',
  trailingSlash: true,
}
```

```bash
npm run build
swa deploy ./out --deployment-token $TOKEN
```

### Astro

```bash
npm run build
swa deploy ./dist --deployment-token $TOKEN
```

### Gatsby

```bash
npm run build
swa deploy ./public --deployment-token $TOKEN
```

---

## API Integration

### Managed Functions (Built-in)

Create `api/` folder in project root:

```
project/
├── src/
├── api/
│   ├── host.json
│   ├── package.json
│   └── hello/
│       ├── function.json
│       └── index.js
└── staticwebapp.config.json
```

**api/hello/index.js:**
```javascript
module.exports = async function (context, req) {
  context.res = {
    body: { message: "Hello from API!" }
  };
};
```

**api/hello/function.json:**
```json
{
  "bindings": [{
    "authLevel": "anonymous",
    "type": "httpTrigger",
    "direction": "in",
    "methods": ["get", "post"]
  }, {
    "type": "http",
    "direction": "out"
  }]
}
```

Deploy with API:
```bash
swa deploy ./dist --api-location ./api --deployment-token $TOKEN
```

### Linked Backend (Bring Your Own)

Link existing Function App, App Service, or Container App:

```bash
az staticwebapp backends link \
  --name <swa-name> \
  --resource-group <rg> \
  --backend-resource-id <resource-id> \
  --backend-region <region>
```

---

## Authentication

### Built-in Providers

```json
{
  "routes": [
    { "route": "/login", "redirect": "/.auth/login/github" },
    { "route": "/login/aad", "redirect": "/.auth/login/aad" },
    { "route": "/.auth/login/twitter", "statusCode": 404 }
  ]
}
```

Available providers: `github`, `aad` (Microsoft Entra ID), `twitter`

### Custom Authentication

Configure in Azure Portal or via ARM/Bicep for custom OpenID Connect providers.

### Access User Info

In your frontend:
```javascript
const response = await fetch('/.auth/me');
const { clientPrincipal } = await response.json();
// clientPrincipal.userId, .userRoles, .identityProvider
```

In API (Node.js):
```javascript
module.exports = async function (context, req) {
  const header = req.headers['x-ms-client-principal'];
  const user = header ? JSON.parse(Buffer.from(header, 'base64').toString()) : null;
};
```

---

## Custom Domains

```bash
# Add custom domain
az staticwebapp hostname set \
  --name <app> \
  --resource-group <rg> \
  --hostname www.example.com

# List domains
az staticwebapp hostname list \
  --name <app> \
  --resource-group <rg>
```

**DNS Configuration:**
- CNAME: Point `www` to `<app>.azurestaticapps.net`
- Root domain: Use Azure DNS or provider's ALIAS/ANAME record

---

## Environment Variables

```bash
# Set for production
az staticwebapp appsettings set \
  --name <app> \
  --resource-group <rg> \
  --setting-names \
    API_URL=https://api.example.com \
    FEATURE_FLAG=true

# List
az staticwebapp appsettings list \
  --name <app> \
  --resource-group <rg>
```

---

## Preview Environments

Automatically created for pull requests when using GitHub Actions.

```bash
# List environments
az staticwebapp environment list \
  --name <app> \
  --resource-group <rg>

# Delete preview environment
az staticwebapp environment delete \
  --name <app> \
  --resource-group <rg> \
  --environment-name <env-name>
```

---

## GitHub Actions Workflow

Auto-generated when linking GitHub repo, or create manually:

```yaml
name: Deploy to SWA
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build
        run: |
          npm install
          npm run build
          
      - name: Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.SWA_TOKEN }}
          action: upload
          app_location: /
          output_location: dist
          api_location: api
```

---

## Cleanup

```bash
# Delete Static Web App
az staticwebapp delete \
  --name <app> \
  --resource-group <rg> \
  --yes

# Delete resource group
az group delete --name <rg> --yes
```
