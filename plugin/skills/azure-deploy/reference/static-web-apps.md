# Static Web Apps Deployment Guide

Deploy static frontends (React, Vue, Angular, etc.) with optional serverless Azure Functions APIs.

---

## Overview

Azure Static Web Apps (SWA) provides:
- Global CDN distribution for fast content delivery
- Free SSL certificates with automatic renewal
- Integrated serverless APIs (managed Azure Functions)
- GitHub/Azure DevOps CI/CD integration
- Automatic preview environments for pull requests
- Built-in authentication with GitHub, Microsoft Entra ID, Twitter

**Best for:** React, Vue, Angular, Svelte, Next.js (SSG), Gatsby, Hugo, Astro, plain HTML/CSS/JS sites

---

## Prerequisites

### Required Tools
- **SWA CLI** - Static Web Apps command-line tool
- **Azure CLI** - For resource management
- **Node.js** - For SWA CLI and managed Functions APIs

### Installation

**SWA CLI - Option 1: Install locally in project (recommended)**
```bash
npm install -D @azure/static-web-apps-cli
```

Verify: `npx swa --version`

**SWA CLI - Option 2: Install globally**
```bash
npm install -g @azure/static-web-apps-cli
```

Verify: `swa --version`

**SWA CLI - Option 3: Use npx without installation (no setup required)**
```bash
npx @azure/static-web-apps-cli --version
```

> 💡 **Best Practice**: Use `npx swa` commands instead of `swa` directly to avoid "command not found" errors. This works whether SWA CLI is installed locally, globally, or not at all.

---

## Quick Start

```bash
# 1. Create resource group
az group create --name myswa-rg --location centralus

# 2. Create Static Web App (limited regions: centralus, eastus2, westus2, westeurope, eastasia)
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
npx swa deploy ./dist --deployment-token "$TOKEN" --env production
```

> ⚠️ **CRITICAL: SWA CLI Directory Rule**
> 
> **Always run `swa deploy` from a PARENT directory, pointing to the output folder.** The SWA CLI will fail silently with "Current directory cannot be identical to or contained within artifact folders" if you run it from inside the deployment directory.
> 
> **✅ Correct:** `cd C:\projects && swa deploy .\myapp\dist`
> 
> **❌ Wrong:** `cd C:\projects\myapp\dist && swa deploy .`
> 
> For plain HTML sites without a build step, copy files to a `dist/` folder first, then deploy from the parent directory.

---

## SKU Options

| SKU | Price | Features |
|-----|-------|----------|
| **Free** | $0/month | 2 custom domains, 100GB bandwidth/month, community support |
| **Standard** | ~$9/month | 5 custom domains, unlimited bandwidth, password protection, custom auth providers, SLA |

```bash
# Create with Standard SKU
az staticwebapp create \
  --name myapp \
  --resource-group myapp-rg \
  --location centralus \
  --sku Standard
```

---

## Configuration Files

### swa-cli.config.json (SWA CLI Settings)

**IMPORTANT: Do not use `swa init`. Create this file manually for better control.**

Place in project root:

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

**Key properties:**
- `appLocation` - Directory containing frontend source code (relative to project root)
- `apiLocation` - Directory containing Azure Functions API code
- `outputLocation` - Build output directory (relative to appLocation)
- `appBuildCommand` - Command to build frontend
- `apiBuildCommand` - Command to build API
- `run` - Command to start dev server
- `appDevserverUrl` - Dev server URL for SWA CLI to proxy
- `appName` - Azure Static Web App resource name (for deployment)
- `resourceGroup` - Azure resource group name (for deployment)

For complete schema reference: https://aka.ms/azure/static-web-apps-cli/schema

### staticwebapp.config.json (Runtime Configuration)

Place in your build output directory or repository root:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/images/*", "/api/*", "*.{css,js,png,jpg,svg,ico}"]
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
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block"
  },
  "mimeTypes": {
    ".json": "application/json",
    ".wasm": "application/wasm"
  },
  "platform": {
    "apiRuntime": "node:22"
  }
}
```

**Key sections:**
- `navigationFallback` - SPA routing support (redirect to index.html for client-side routes)
- `routes` - Role-based access control for routes
- `responseOverrides` - Custom error pages and redirects
- `globalHeaders` - Security and CORS headers
- `mimeTypes` - Custom MIME type mappings
- `platform.apiRuntime` - Azure Functions runtime version

---

## SWA CLI Commands

### swa start (Local Development)

Start the local emulator at `http://localhost:4280`:

```bash
# Serve from build output (uses swa-cli.config.json)
npx swa start

# Serve specific folder
npx swa start ./dist

# Proxy to development server (recommended for frameworks)
npx swa start http://localhost:3000

# With API folder
npx swa start ./dist --api-location ./api

# Proxy to dev server with API
npx swa start http://localhost:3000 --api-location ./api

# Auto-start dev server and proxy
npx swa start http://localhost:3000 --run "npm start" --api-location ./api

# Custom emulator port
npx swa start --port 4280

# Enable HTTPS
npx swa start --ssl
```

**Common framework development server ports:**
| Framework | Default Port | Start Command |
|-----------|--------------|---------------|
| React (Vite) | 5173 | `npm run dev` |
| React (CRA) | 3000 | `npm start` |
| Vue (Vite) | 5173 | `npm run dev` |
| Angular | 4200 | `ng serve` |
| Next.js | 3000 | `npm run dev` |
| Svelte | 5173 | `npm run dev` |

**Key flags:**
- `--port, -p` - SWA emulator port (default: 4280)
- `--api-location, -i` - API folder path
- `--api-port, -j` - Functions API port (default: 7071)
- `--run, -r` - Command to auto-start dev server
- `--open, -o` - Open browser automatically
- `--ssl, -s` - Enable HTTPS with self-signed certificate
- `--verbose` - Enable verbose logging

### swa build

Build frontend and API:

```bash
# Build using config
npx swa build

# Auto-detect and build
npx swa build --auto

# Build specific configuration
npx swa build myApp
```

**Key flags:**
- `--app-location, -a` - Frontend source path
- `--api-location, -i` - API source path
- `--output-location, -O` - Build output path
- `--app-build-command, -A` - Frontend build command
- `--api-build-command, -I` - API build command

### swa deploy

Deploy to Azure Static Web App:

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

> 💡 **Always use `--verbose silly` when troubleshooting deployments** to see all error details and diagnostic information.

**Get deployment token:**
1. **Azure Portal**: Static Web App → Overview → Manage deployment token
2. **CLI**: `npx swa deploy --print-token`
3. **Environment variable**: Set `SWA_CLI_DEPLOYMENT_TOKEN`

**Key flags:**
- `--env` - Target environment (`preview` or `production`)
- `--deployment-token, -d` - Deployment token
- `--app-name, -n` - Azure SWA resource name
- `--resource-group, -g` - Azure resource group
- `--verbose` - Logging level (`log`, `silly`)
- `--dry-run` - Preview deployment without uploading

### swa login

Authenticate with Azure:

```bash
# Interactive login
npx swa login

# Specific subscription
npx swa login --subscription-id <id>

# Clear cached credentials
npx swa login --clear-credentials
```

### swa db

Initialize database connections:

```bash
npx swa db init --database-type mssql
npx swa db init --database-type postgresql
npx swa db init --database-type cosmosdb_nosql
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
npx swa deploy ./dist --deployment-token "$TOKEN" --env production

# Clean up temp folder (optional)
rm -rf dist
```

**Note:** SWA CLI does not support deploying directly from the root directory for plain HTML sites. Always use an output folder.

### React (Vite)

```bash
# Build
npm run build

# Deploy (Vite outputs to dist/)
npx swa deploy ./dist --deployment-token "$TOKEN" --env production
```

**swa-cli.config.json example:**
```json
{
  "configurations": {
    "app": {
      "appLocation": ".",
      "outputLocation": "dist",
      "appBuildCommand": "npm run build",
      "appDevserverUrl": "http://localhost:5173"
    }
  }
}
```

### React (Create React App)

```bash
# Build
npm run build

# Deploy (CRA outputs to build/)
npx swa deploy ./build --deployment-token "$TOKEN" --env production
```

### Vue (Vite)

```bash
# Build
npm run build

# Deploy
npx swa deploy ./dist --deployment-token "$TOKEN" --env production
```

### Angular

```bash
# Build
npm run build

# Deploy (output is in dist/<project-name>/browser or dist/<project-name>)
npx swa deploy ./dist/<project-name>/browser --deployment-token "$TOKEN" --env production
```

**swa-cli.config.json example:**
```json
{
  "configurations": {
    "app": {
      "appLocation": ".",
      "outputLocation": "dist/my-angular-app/browser",
      "appBuildCommand": "npm run build",
      "appDevserverUrl": "http://localhost:4200"
    }
  }
}
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
# Build
npm run build

# Deploy (Next.js exports to out/)
npx swa deploy ./out --deployment-token "$TOKEN" --env production
```

**Important:** Only static export is supported. Server-side rendering (SSR) is not compatible with Static Web Apps.

### Svelte (Vite)

```bash
# Build
npm run build

# Deploy
npx swa deploy ./dist --deployment-token "$TOKEN" --env production
```

### Astro

```bash
# Build
npm run build

# Deploy
npx swa deploy ./dist --deployment-token "$TOKEN" --env production
```

### Gatsby

```bash
# Build
npm run build

# Deploy (Gatsby outputs to public/)
npx swa deploy ./public --deployment-token "$TOKEN" --env production
```

---

## API Integration (Azure Functions)

### Managed Functions (Built-in)

Static Web Apps includes managed Azure Functions support. Create an `api/` folder in your project:

**Project structure:**
```
project/
├── src/                    # Frontend source
├── dist/                   # Build output
├── api/                    # Managed Functions
│   ├── host.json
│   ├── package.json
│   └── message/
│       ├── function.json
│       └── index.js
└── staticwebapp.config.json
```

#### Create API (Node.js v4 Programming Model)

```bash
# Initialize Functions project
mkdir api && cd api
npm init -y
npm install @azure/functions

# Create function using v4 model
func init --worker-runtime node --model V4
func new --name message --template "HTTP trigger"
```

**api/src/functions/message.js:**
```javascript
const { app } = require('@azure/functions');

app.http('message', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request) => {
        const name = request.query.get('name') || 'World';
        return { 
            jsonBody: { 
                message: `Hello, ${name}!`,
                timestamp: new Date().toISOString()
            } 
        };
    }
});
```

**api/package.json:**
```json
{
  "name": "api",
  "version": "1.0.0",
  "main": "src/functions/*.js",
  "dependencies": {
    "@azure/functions": "^4.0.0"
  }
}
```

#### Set API Runtime

In `staticwebapp.config.json`:
```json
{
  "platform": {
    "apiRuntime": "node:22"
  }
}
```

**Supported runtimes:**
- Node.js: `node:18`, `node:20`, `node:22`
- .NET: `dotnet:8.0`, `dotnet-isolated:8.0`
- Python: `python:3.10`, `python:3.11`

#### Deploy with API

```bash
# Local testing
npx swa start ./dist --api-location ./api

# Deploy to Azure
npx swa deploy ./dist --api-location ./api --deployment-token "$TOKEN" --env production
```

Access API at: `https://<app-name>.azurestaticapps.net/api/message`

### Linked Backend (Bring Your Own Functions)

Link an existing Azure Functions app, App Service, or Container App:

```bash
az staticwebapp backends link \
  --name <swa-name> \
  --resource-group <rg> \
  --backend-resource-id "/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.Web/sites/<function-app-name>" \
  --backend-region <region>
```

---

## Authentication

### Built-in Providers

Static Web Apps provides built-in authentication with:
- **GitHub**
- **Microsoft Entra ID (Azure AD)**
- **Twitter**

#### Login Routes

```json
{
  "routes": [
    { "route": "/login", "redirect": "/.auth/login/github" },
    { "route": "/login/aad", "redirect": "/.auth/login/aad" },
    { "route": "/logout", "redirect": "/.auth/logout" }
  ]
}
```

Available login endpoints:
- `/.auth/login/github`
- `/.auth/login/aad` (Microsoft Entra ID)
- `/.auth/login/twitter`

Logout endpoint:
- `/.auth/logout`

#### Access User Information

**In frontend JavaScript:**
```javascript
async function getUserInfo() {
  const response = await fetch('/.auth/me');
  const { clientPrincipal } = await response.json();
  
  if (clientPrincipal) {
    console.log('User ID:', clientPrincipal.userId);
    console.log('Roles:', clientPrincipal.userRoles);
    console.log('Provider:', clientPrincipal.identityProvider);
    console.log('User details:', clientPrincipal.userDetails);
  } else {
    console.log('Not authenticated');
  }
}
```

**In API function (Node.js):**
```javascript
module.exports = async function (context, req) {
  const header = req.headers['x-ms-client-principal'];
  const user = header ? JSON.parse(Buffer.from(header, 'base64').toString()) : null;
  
  if (user) {
    context.res = {
      body: { 
        message: `Hello, ${user.userDetails}!`,
        roles: user.userRoles 
      }
    };
  } else {
    context.res = { status: 401, body: 'Not authenticated' };
  }
};
```

#### Role-Based Access Control

```json
{
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
      "redirect": "/.auth/login/github"
    }
  }
}
```

**Built-in roles:**
- `anonymous` - All users (default)
- `authenticated` - Logged-in users

**Custom roles:** Configure via invitation links or custom authentication

### Custom Authentication (OpenID Connect)

Configure custom authentication providers in Azure Portal:
- **Settings → Authentication → Add identity provider**
- Supports any OpenID Connect-compatible provider

---

## Routing and Navigation

### SPA Routing (Client-Side Routes)

Enable client-side routing for single-page applications:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/images/*", "/api/*", "*.{css,js,png,jpg,svg,ico,json}"]
  }
}
```

This ensures all routes (except excluded patterns) serve `index.html`, allowing your SPA router to handle navigation.

### Custom Routes

```json
{
  "routes": [
    {
      "route": "/profile",
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/images/*",
      "headers": {
        "cache-control": "public, max-age=31536000, immutable"
      }
    },
    {
      "route": "/api/*"
    },
    {
      "route": "/old-page",
      "redirect": "/new-page",
      "statusCode": 301
    }
  ]
}
```

### Custom Error Pages

```json
{
  "responseOverrides": {
    "400": {
      "rewrite": "/errors/400.html"
    },
    "404": {
      "rewrite": "/404.html"
    },
    "500": {
      "rewrite": "/errors/500.html"
    }
  }
}
```

---

## Custom Domains and SSL

### Add Custom Domain

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

# Delete domain
az staticwebapp hostname delete \
  --name <app> \
  --resource-group <rg> \
  --hostname www.example.com
```

### DNS Configuration

**For subdomain (www.example.com):**
- Create CNAME record: `www` → `<app-name>.azurestaticapps.net`

**For apex domain (example.com):**
- Use Azure DNS with ALIAS record, or
- Use your DNS provider's ALIAS/ANAME record pointing to `<app-name>.azurestaticapps.net`

**SSL certificates:**
- Automatically provisioned and renewed
- Free with Let's Encrypt
- No configuration required

---

## Environment Variables and App Settings

```bash
# Set environment variable for production
az staticwebapp appsettings set \
  --name <app> \
  --resource-group <rg> \
  --setting-names \
    API_URL=https://api.example.com \
    FEATURE_FLAG=true

# List all settings
az staticwebapp appsettings list \
  --name <app> \
  --resource-group <rg>

# Delete setting
az staticwebapp appsettings delete \
  --name <app> \
  --resource-group <rg> \
  --setting-names API_URL
```

**Access in API functions:**
```javascript
const apiUrl = process.env.API_URL;
```

**Access in frontend:**
Environment variables are NOT exposed to the frontend. Use your build tool's environment variable support instead (e.g., `VITE_`, `REACT_APP_`, `NEXT_PUBLIC_`).

---

## Preview Environments

Automatically created for pull requests when using GitHub Actions.

```bash
# List all environments
az staticwebapp environment list \
  --name <app> \
  --resource-group <rg>

# Delete preview environment
az staticwebapp environment delete \
  --name <app> \
  --resource-group <rg> \
  --environment-name <env-name>
```

**Preview environment URLs:**
- Format: `https://<unique-url>.azurestaticapps.net`
- Created automatically when PR is opened
- Deleted automatically when PR is closed

---

## GitHub Actions CI/CD

### Auto-Generated Workflow

When linking a GitHub repository, Static Web Apps automatically creates a workflow file:

**.github/workflows/azure-static-web-apps-<app-name>.yml:**
```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true
      
      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }} # Used for Github integrations (i.e. PR comments)
          action: "upload"
          app_location: "/" # App source code path
          api_location: "api" # Api source code path - optional
          output_location: "dist" # Built app content directory - optional

  close_pull_request_job:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request Job
    steps:
      - name: Close Pull Request
        id: closepullrequest
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "close"
```

### Workflow Configuration

Key settings:
- `app_location` - Frontend source path (relative to repo root)
- `api_location` - API source path (omit if no API)
- `output_location` - Build output directory (relative to app_location)
- `skip_app_build: true` - Skip build if already built
- `app_build_command` - Custom build command
- `api_build_command` - Custom API build command

### Add Deployment Token Secret

1. Get deployment token:
   ```bash
   az staticwebapp secrets list \
     --name <app> \
     --resource-group <rg> \
     --query "properties.apiKey" -o tsv
   ```

2. Add to GitHub repository secrets:
   - Go to repository **Settings → Secrets and variables → Actions**
   - Click **New repository secret**
   - Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - Value: Paste the deployment token

---

## Monitoring and Diagnostics

### View Logs

```bash
# Stream logs (requires Azure CLI with SWA extension)
az staticwebapp log tail \
  --name <app> \
  --resource-group <rg>
```

### Application Insights Integration

Static Web Apps automatically integrates with Application Insights for:
- Request telemetry
- Dependency tracking
- Exception logging
- Custom metrics

**Enable in Azure Portal:**
- Static Web App → Settings → Application Insights → Enable

**Access logs:**
- Azure Portal → Application Insights → Logs

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `swa` command not found | Use `npx swa` instead, or install globally: `npm install -g @azure/static-web-apps-cli` |
| 404 on client routes | Add `navigationFallback` with `rewrite: "/index.html"` to `staticwebapp.config.json` |
| API returns 404 | Verify `api/` folder structure, ensure `platform.apiRuntime` is set in config, check function exports |
| Build output not found | Verify `output_location` matches actual build output directory (e.g., `dist/`, `build/`, `out/`) |
| Auth not working locally | Use `/.auth/login/<provider>` to access auth emulator UI in local dev |
| CORS errors | APIs under `/api/*` are same-origin by default; external APIs need CORS headers |
| Deployment token expired | Regenerate in Azure Portal → Static Web App → Manage deployment token |
| Config not applied | Ensure `staticwebapp.config.json` is in `app_location` or `output_location` |
| Local API timeout | Default timeout is 45 seconds; optimize function code or check for blocking operations |
| Preview environment not created | Verify GitHub Actions workflow has PR trigger and correct permissions |

### Debug Commands

```bash
# Verbose local emulator output
npx swa start --verbose log

# Preview deployment without uploading
npx swa deploy --dry-run

# Show all deployment issues and diagnostics
npx swa deploy --verbose silly

# Show resolved configuration
npx swa --print-config
```

### Validate Configuration

```bash
# Test local emulator
npx swa start ./dist --api-location ./api

# Access emulator
open http://localhost:4280

# Test API endpoint
curl http://localhost:4280/api/message

# Test authentication
open http://localhost:4280/.auth/login/github
```

---

## Cleanup

```bash
# Delete Static Web App
az staticwebapp delete \
  --name <app> \
  --resource-group <rg> \
  --yes

# Delete resource group (deletes all resources)
az group delete --name <rg> --yes
```

---

## Best Practices

1. **Always use `npx swa` instead of `swa`** to avoid installation issues
2. **Create `swa-cli.config.json` manually** instead of using `swa init` for better control
3. **Use `--verbose silly` when deploying** to catch deployment issues early
4. **Test locally first** with `npx swa start` before deploying to Azure
5. **Use `navigationFallback`** for SPAs to support client-side routing
6. **Set `platform.apiRuntime`** explicitly in `staticwebapp.config.json`
7. **Exclude static assets** from navigationFallback to serve them directly
8. **Use role-based access control** to secure API routes and admin pages
9. **Enable Application Insights** for production apps to monitor performance
10. **Use preview environments** for testing changes before merging to main

---

## Additional Resources

- [Static Web Apps Documentation](https://learn.microsoft.com/azure/static-web-apps/)
- [SWA CLI GitHub](https://github.com/Azure/static-web-apps-cli)
- [Configuration Reference](https://learn.microsoft.com/azure/static-web-apps/configuration)
- [Authentication and Authorization](https://learn.microsoft.com/azure/static-web-apps/authentication-authorization)
- [API Routes with Functions](https://learn.microsoft.com/azure/static-web-apps/apis)
