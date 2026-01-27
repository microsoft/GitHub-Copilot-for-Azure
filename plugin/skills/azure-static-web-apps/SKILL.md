---
name: azure-static-web-apps
description: Helps create, configure, and deploy Azure Static Web Apps using the SWA CLI. Use when deploying static sites to Azure, setting up SWA local development, configuring staticwebapp.config.json, adding Azure Functions APIs to SWA, or setting up GitHub Actions CI/CD for Static Web Apps.
---

## Overview

Azure Static Web Apps (SWA) hosts static frontends with optional serverless API backends. The SWA CLI (`swa`) provides local development emulation and deployment capabilities.

**Key features:**
- Local emulator with API proxy and auth simulation
- Framework auto-detection and configuration
- Direct deployment to Azure
- Database connections support

**Config files:**
- `swa-cli.config.json` - CLI settings
   - While this can be created by `swa init` you should _always_ create it manually
- `staticwebapp.config.json` - Runtime config (routes, auth, headers, API runtime) - can be created manually

## General Instructions

### Installation

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

### Quick Start Workflow

**IMPORTANT: Do not use `swa init` in this workflow. Create and maintain `swa-cli.config.json` manually using the provided example and schema.**

1. **Required first step** - If requested by the user, create the frontend and backend.
2. Create `swa-cli.config.json` if it does not exist. Use [example-swa-cli.config.json](references/example-swa-cli.config.json) as an example, and also consider the complete [schema](references/swa-cli.config.schema.json). Look through the workspace to identify the location of the frontend and backend and to fill in the other parts of the config file.
3. `npx swa start` - Run local emulator at `http://localhost:4280`
4. `az login` - Authenticate with Azure
5. `az staticwebapp create --name <app-name> --resource-group <resource-group> --location <location> --source <app-source-path>` - Create the static web app resource in Azure if it does not already exist
6. `npx swa deploy --verbose silly` - Deploy to Azure

### Configuration Files

**swa-cli.config.json** - Contains parameters used by the various `swa` commands. If it does not exist it should be created after the frontend and backend have been created, and before any `swa` commands.

Use [example-swa-cli.config.json](references/example-swa-cli.config.json) as an example, and also consider the complete [schema](references/swa-cli.config.schema.json).

**staticwebapp.config.json** (in app source or output folder) - This file provides the runtime configuration for the static web app:
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/images/*", "/css/*"]
  },
  "routes": [
    { "route": "/api/*", "allowedRoles": ["authenticated"] }
  ],
  "platform": {
    "apiRuntime": "node:20"
  }
}
```

## Command-line Reference

### swa login

Authenticate with Azure for deployment.

```bash
npx swa login                              # Interactive login
npx swa login --subscription-id <id>       # Specific subscription
npx swa login --clear-credentials          # Clear cached credentials
```

**Flags:** `--subscription-id, -S` | `--resource-group, -R` | `--tenant-id, -T` | `--client-id, -C` | `--client-secret, -CS` | `--app-name, -n`

### swa init

Do not use this command. Instead, create the swa-cli.config.json manually.

### swa build

Build frontend and/or API.

```bash
npx swa build                   # Build using config
npx swa build --auto            # Auto-detect and build
npx swa build myApp             # Build specific configuration
```

**Flags:** `--app-location, -a` | `--api-location, -i` | `--output-location, -O` | `--app-build-command, -A` | `--api-build-command, -I`

### swa start

Start local development emulator.

```bash
npx swa start                                    # Serve from outputLocation
npx swa start ./dist                             # Serve specific folder
npx swa start http://localhost:3000              # Proxy to dev server
npx swa start ./dist --api-location ./api        # With API folder
npx swa start http://localhost:3000 --run "npm start"  # Auto-start dev server
```

> 💡 **Tip**: If you have SWA CLI installed globally, you can use `swa` instead of `npx swa`.

**Common framework ports:**
| Framework | Port |
|-----------|------|
| React/Vue/Next.js | 3000 |
| Angular | 4200 |
| Vite | 5173 |

**Key flags:**
- `--port, -p` - Emulator port (default: 4280)
- `--api-location, -i` - API folder path
- `--api-port, -j` - API port (default: 7071)
- `--run, -r` - Command to start dev server
- `--open, -o` - Open browser automatically
- `--ssl, -s` - Enable HTTPS

### swa deploy

Deploys to an existing Azure Static Web App resource. If the resource hasn't been created yet, create it with `az staticwebapp` and fill in the `appName` and `resourceGroup` properties in the swa-cli.config.json file.

```bash
npx swa deploy                              # Deploy using config
npx swa deploy ./dist                       # Deploy specific folder
npx swa deploy --env production             # Deploy to production
npx swa deploy --deployment-token <TOKEN>   # Use deployment token
npx swa deploy --dry-run                    # Preview without deploying
```

While the examples do not include it for brevity, you should always pass `--verbose silly` to `swa deploy` to ensure you get all the deployment details and error messages.

> 💡 **Tip**: If you have SWA CLI installed globally, you can use `swa` instead of `npx swa`.

**Get deployment token:**
- Azure Portal: Static Web App → Overview → Manage deployment token
- CLI: `swa deploy --print-token`
- Environment variable: `SWA_CLI_DEPLOYMENT_TOKEN`

**Key flags:**
- `--env` - Target environment (`preview` or `production`)
- `--deployment-token, -d` - Deployment token
- `--app-name, -n` - Azure SWA resource name

### swa db

Initialize database connections.

```bash
npx swa db init --database-type mssql
npx swa db init --database-type postgresql
npx swa db init --database-type cosmosdb_nosql
```

## Scenarios

### Create a New SWA

- Unless told otherwise, put the frontend in a folder called "app".
- Unless told otherwise, put the backend in a folder called "api".
- Create the frontend and/or backend per the user's instructions.
- Install any dependencies.
- Then proceed to initialize the static web app as described in the following section, "Create SWA from Existing Frontend and Backend".

### Create SWA from Existing Frontend and Backend

**Always create the `swa-cli.config.json` before `swa start` or `swa deploy`.**

```bash
# 1. Install CLI
npm install -D @azure/static-web-apps-cli

# 2. Creates swa-cli.config.json with correct values

# 3. Build application (if needed)
npm run build

# 4. Test locally (uses settings from swa-cli.config.json)
npx swa start

# 5. Deploy
az login
npx swa deploy --env production --verbose silly
```

### Add Azure Functions Backend

1. **Create API folder:**
```bash
mkdir api && cd api
func init --worker-runtime node --model V4
func new --name message --template "HTTP trigger"
```

2. **Example function** (`api/src/functions/message.js`):
```javascript
const { app } = require('@azure/functions');

app.http('message', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request) => {
        const name = request.query.get('name') || 'World';
        return { jsonBody: { message: `Hello, ${name}!` } };
    }
});
```

3. **Set API runtime** in `staticwebapp.config.json`:
```json
{
  "platform": { "apiRuntime": "node:20" }
}
```

4. **Update CLI config** in `swa-cli.config.json`:
```json
{
  "configurations": {
    "app": { "apiLocation": "api" }
  }
}
```

5. **Test locally:**
```bash
npx swa start ./dist --api-location ./api
# Access API at http://localhost:4280/api/message
```

**Supported API runtimes:** `node:18`, `node:20`, `node:22`, `dotnet:8.0`, `dotnet-isolated:8.0`, `python:3.10`, `python:3.11`

### Set Up GitHub Actions Deployment

1. **Create SWA resource** in Azure Portal or via Azure CLI
2. **Link GitHub repository** - workflow auto-generated, or create manually:

`.github/workflows/azure-static-web-apps.yml`:
```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]

jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: /
          api_location: api
          output_location: dist

  close_pr:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: close
```

3. **Add secret:** Copy deployment token to repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN`

**Workflow settings:**
- `app_location` - Frontend source path
- `api_location` - API source path
- `output_location` - Built output folder
- `skip_app_build: true` - Skip if pre-built
- `app_build_command` - Custom build command

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `swa` command not found | Use `npx swa` instead of `swa` directly, or install globally with `npm install -g @azure/static-web-apps-cli` |
| 404 on client routes | Add `navigationFallback` with `rewrite: "/index.html"` to `staticwebapp.config.json` |
| API returns 404 | Verify `api` folder structure, ensure `platform.apiRuntime` is set, check function exports |
| Build output not found | Verify `output_location` matches actual build output directory |
| Auth not working locally | Use `/.auth/login/<provider>` to access auth emulator UI |
| CORS errors | APIs under `/api/*` are same-origin; external APIs need CORS headers |
| Deployment token expired | Regenerate in Azure Portal → Static Web App → Manage deployment token |
| Config not applied | Ensure `staticwebapp.config.json` is in `app_location` or `output_location` |
| Local API timeout | Default is 45 seconds; optimize function or check for blocking calls |

**Debug commands:**
```bash
npx swa start --verbose log        # Verbose output
npx swa deploy --dry-run           # Preview deployment
npx swa deploy --verbose silly     # Shows _all_ deployment issues
npx swa --print-config             # Show resolved configuration
```
