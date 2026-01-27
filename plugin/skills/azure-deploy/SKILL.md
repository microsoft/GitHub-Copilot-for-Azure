---
name: azure-deploy
description: Deploy applications to Azure App Service, Azure Functions, Azure Static Web Apps, and Azure Container Apps. USE THIS SKILL when users want to deploy, publish, host, or run their application on Azure. This skill detects application type (React, Vue, Angular, Next.js, Python, .NET, Java, containerized apps, etc.), recommends the optimal Azure service, provides local preview capabilities, and guides deployment. Trigger phrases include "deploy to Azure", "host on Azure", "publish to Azure", "run on Azure", "get this running in the cloud", "deploy my app", "Azure deployment", "set up Azure hosting", "deploy serverless functions", "deploy static site", "deploy containers", "deploy to Container Apps", "deploy to App Service", "deploy to Functions", "deploy to Static Web Apps", "preview locally", "test before deploying", "what Azure service should I use", "help me deploy", "deploy todo app", "create and deploy web app", etc. Also handles multi-service deployments with Azure Developer CLI (azd) and Infrastructure as Code when complexity is detected.
---

# Azure Deploy Skill

Deploy applications to Azure with intelligent service selection, local preview, and guided deployment workflows.

---

## Quick Start Decision Tree

```
User wants to deploy → Run detection workflow below
```

---

## Phase 1: Application Detection

**ALWAYS start by scanning the user's project to detect the application type.**

### Step 1.1: Check for Existing Azure Configuration

Look for these files first (HIGH confidence signals):

| File Found | Service Type | Action |
|------------|--------------|--------|
| `azure.yaml` | azd-configured project | Use `azd up` to deploy (multi-service) |
| `function.json` or `host.json` | Azure Functions | Deploy as serverless functions |
| `staticwebapp.config.json` or `swa-cli.config.json` | Static Web Apps | Deploy as static site with SWA CLI |
| `Dockerfile` or `docker-compose.yml` | Containerized app | Deploy to Azure Container Apps |

**If configuration files found, proceed with that service type.**

### Step 1.2: Detect Application Framework

Scan for configuration files and dependencies:

**Node.js / JavaScript / TypeScript:**
```
package.json exists →
├── next.config.js/mjs/ts → Next.js
│   ├── Has `output: 'export'` → Static Web Apps (SSG)
│   └── Has API routes or no export config → App Service (SSR)
├── nuxt.config.ts/js → Nuxt
│   ├── Has `ssr: false` or `target: 'static'` → Static Web Apps
│   └── Otherwise → App Service (SSR)
├── angular.json → Angular → Static Web Apps
├── vite.config.* → Vite-based (React/Vue/Svelte) → Static Web Apps
├── gatsby-config.js → Gatsby → Static Web Apps
├── astro.config.mjs → Astro → Static Web Apps
├── nest-cli.json → NestJS → App Service
├── Has express/fastify/koa/hapi dependency → App Service
└── No framework, just static build → Static Web Apps
```

**Python:**
```
requirements.txt or pyproject.toml exists →
├── function_app.py exists → Azure Functions (v2 programming model)
├── Has flask dependency → App Service
├── Has django dependency → App Service
├── Has fastapi dependency → App Service
└── Has azure-functions dependency → Azure Functions
```

**.NET:**
```
*.csproj or *.sln exists →
├── <AzureFunctionsVersion> in csproj → Azure Functions
├── Blazor WebAssembly project → Static Web Apps
├── ASP.NET Core web app → App Service
└── .NET API project → App Service
```

**Java:**
```
pom.xml or build.gradle exists →
├── Has azure-functions-* dependency → Azure Functions
├── Has spring-boot dependency → App Service
└── Standard web app → App Service
```

**Static Only:**
```
index.html exists + no package.json/requirements.txt →
└── Pure static site → Static Web Apps
```

**Containerized:**
```
Dockerfile or docker-compose.yml exists →
└── Containerized application → Azure Container Apps
```

### Step 1.3: Detect Multi-Service Architecture

Check for complexity indicators that suggest azd + IaC:

```
Multi-service triggers:
├── Monorepo structure (frontend/, backend/, api/, packages/, apps/)
├── docker-compose.yml with multiple services
├── Multiple package.json in different subdirectories
├── Database references in config (connection strings, .env files)
├── References to Redis, Service Bus, Event Hubs, Storage queues
├── User mentions "multiple environments", "staging", "production"
└── More than one deployable component detected
```

**If multi-service detected → Recommend azd + Infrastructure as Code**
See [Multi-Service Deployment Guide](./reference/multi-service.md)

### Step 1.4: Confidence Assessment

After detection, assess confidence:

| Confidence | Criteria | Action |
|------------|----------|--------|
| **HIGH** | Azure config file found (azure.yaml, function.json, staticwebapp.config.json) | Proceed with detected service |
| **MEDIUM** | Framework detected from dependencies | Explain recommendation, ask for confirmation |
| **LOW** | Ambiguous or no clear signals | Ask clarifying questions |

**Clarifying questions for LOW confidence:**
1. "What type of application is this? (static website, API, full-stack, serverless functions, containerized app)"
2. "Is your application already containerized with Docker?"
3. "Does your app need server-side rendering or is it purely client-side?"
4. "Do you need scheduled tasks, cron jobs, or event-driven processing?"
5. "Will you need a database, caching, or other Azure services?"

---

## Service Selection Summary

| App Type | Azure Service | Use When |
|----------|---------------|----------|
| **Static sites** (React, Vue, Angular, HTML) | Static Web Apps | Client-side only, no SSR, optional API |
| **Serverless functions** (HTTP APIs, timers, events) | Azure Functions | Event-driven, pay-per-execution, triggers/bindings |
| **Full-stack apps** (frontend + backend, containerized) | Container Apps | Dockerized apps, microservices, scheduled jobs |
| **Server-side rendered** (Next.js SSR, ASP.NET, Django) | App Service | Full web frameworks, SSR, WebSockets |
| **Multi-service** (frontend + API + database + infra) | azd + IaC | Complex architectures, multiple components |

---

## Phase 2: Local Preview (No Azure Auth Required)

Before deploying, help users test locally.

### Static Web Apps - Local Preview

**Install SWA CLI (choose one option):**
```bash
# Option 1: Local to project (recommended)
npm install -D @azure/static-web-apps-cli

# Option 2: Global installation
npm install -g @azure/static-web-apps-cli

# Option 3: Use npx (no installation needed)
npx @azure/static-web-apps-cli --version
```

**Start local emulator:**
```bash
# Start with auto-detection (uses swa-cli.config.json if present)
npx swa start

# Or with specific paths
npx swa start ./dist --api-location ./api

# With a dev server proxy
npx swa start http://localhost:3000 --api-location ./api
```

**💡 Best Practice:** Always use `npx swa` to avoid "command not found" errors.

See [Static Web Apps Guide](./reference/static-web-apps.md) for complete SWA CLI reference.

### Azure Functions - Local Preview

**Install Azure Functions Core Tools (auto-install if missing):**
```bash
# Check if installed
func --version

# Install via npm if missing
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

**Start local Functions runtime:**
```bash
# Start local Functions runtime
func start

# With specific port
func start --port 7071
```

See [Azure Functions Guide](./reference/functions.md) for complete Functions reference.

### App Service Apps - Local Preview
Use the framework's built-in dev server:

```bash
# Node.js
npm run dev
# or
npm start

# Python Flask
flask run

# Python FastAPI
uvicorn main:app --reload

# .NET
dotnet run

# Java Spring Boot
./mvnw spring-boot:run
```

### Container Apps - Local Preview
Test containerized apps locally:

```bash
# Build image
docker build -t myapp:local .

# Run container
docker run -p 3000:3000 myapp:local

# With docker-compose
docker-compose up
```

See [Container Apps Guide](./reference/container-apps.md) for complete Container Apps reference.

See [Local Preview Guide](./reference/local-preview.md) for detailed setup instructions.

---

## Phase 3: Prerequisites & Dependency Management

**ALWAYS check and install missing dependencies before proceeding.**

### 3.1 Azure Authentication (Auto-Login)

**Check login status and automatically login if needed:**
```bash
# Check if logged in, auto-login if not
if ! az account show &>/dev/null; then
    echo "Not logged in to Azure. Starting login..."
    az login
fi

# Verify and show current subscription
az account show --query "{name:name, id:id}" -o table
```

If the user has multiple subscriptions, help them select the correct one:
```bash
# List all subscriptions
az account list --query "[].{Name:name, ID:id, Default:isDefault}" -o table

# Set subscription
az account set --subscription "<name-or-id>"
```

### 3.2 Dependency Detection & Auto-Install

Run this check first and install any missing tools:

```bash
# Check all dependencies at once
check_deps() {
  local missing=()
  command -v az &>/dev/null || missing+=("azure-cli")
  command -v func &>/dev/null || missing+=("azure-functions-core-tools")
  command -v swa &>/dev/null || missing+=("@azure/static-web-apps-cli")
  command -v azd &>/dev/null || missing+=("azd")
  echo "${missing[@]}"
}
```

### 3.3 Install Missing Tools

**Azure CLI** (required for all deployments):
```bash
# macOS
brew install azure-cli

# Windows (PowerShell)
winget install Microsoft.AzureCLI

# Linux (Ubuntu/Debian)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

**Azure Functions Core Tools** (for Functions projects):
```bash
# npm (all platforms) - auto-install if missing
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# macOS
brew tap azure/functions && brew install azure-functions-core-tools@4

# Windows
winget install Microsoft.AzureFunctionsCoreTools
```

**Static Web Apps CLI** (for SWA projects):
```bash
# Local to project (recommended)
npm install -D @azure/static-web-apps-cli

# Global installation
npm install -g @azure/static-web-apps-cli

# Or use npx (no installation needed)
npx @azure/static-web-apps-cli --version
```

**Azure Developer CLI** (for multi-service/IaC):
```bash
# macOS
brew install azd

# Windows
winget install Microsoft.Azd

# Linux
curl -fsSL https://aka.ms/install-azd.sh | bash
```

### 3.4 Project Dependencies

Detect and install project-level dependencies:

```bash
# Node.js - install if node_modules missing
[ -f "package.json" ] && [ ! -d "node_modules" ] && npm install

# Python - create venv and install if missing  
[ -f "requirements.txt" ] && [ ! -d ".venv" ] && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# .NET - restore packages
[ -f "*.csproj" ] && dotnet restore

# Java - install dependencies
[ -f "pom.xml" ] && mvn dependency:resolve
```

---

## Phase 4: Single-Service Deployment

Choose deployment path based on detected application type:

### 4.1 Static Web Apps Deployment

**For static frontends (React, Vue, Angular, plain HTML, etc.)**

**Create resource and deploy:**
```bash
# Create resource group (if needed)
az group create --name <resource-group> --location <location>

# Create Static Web App
az staticwebapp create \
  --name <app-name> \
  --resource-group <resource-group> \
  --location <location> \
  --sku Free

# Get deployment token
TOKEN=$(az staticwebapp secrets list \
  --name <app-name> \
  --resource-group <resource-group> \
  --query "properties.apiKey" -o tsv)

# Deploy with SWA CLI
npx swa deploy ./dist \
  --deployment-token $TOKEN \
  --env production \
  --verbose silly
```

**Plain HTML Site (Single File or No Build Step):**

For plain HTML sites without a build process, create an output folder:
```bash
# Create output directory and copy files
mkdir -p dist && cp -r *.html *.css *.js *.png *.jpg *.svg dist/ 2>/dev/null || true

# Get deployment token
TOKEN=$(az staticwebapp secrets list \
  --name <app-name> \
  --resource-group <resource-group> \
  --query "properties.apiKey" -o tsv)

# Deploy from dist folder
npx swa deploy ./dist --deployment-token "$TOKEN" --env production --verbose silly

# Clean up temp folder (optional)
rm -rf dist
```

**Smart defaults:**
- SKU: `Free` for dev/test, `Standard` for production
- Location: SWA has limited regions - use `centralus`, `eastus2`, `westus2`, `westeurope`, or `eastasia`

See [Static Web Apps Guide](./reference/static-web-apps.md) for detailed configuration including:
- SWA CLI installation and configuration
- Local emulator with API proxy
- Framework-specific setup
- API integration with Azure Functions
- GitHub Actions CI/CD workflows
- Authentication configuration

### 4.2 Azure Functions Deployment

**For serverless functions, event-driven APIs, and timer jobs**

**Create and deploy:**
```bash
# Create resource group
az group create --name <resource-group> --location <location>

# Create storage account (required for Functions)
az storage account create \
  --name <storage-name> \
  --resource-group <resource-group> \
  --location <location> \
  --sku Standard_LRS

# Create Function App
az functionapp create \
  --name <app-name> \
  --resource-group <resource-group> \
  --storage-account <storage-name> \
  --consumption-plan-location <location> \
  --runtime <node|python|dotnet|java> \
  --runtime-version <version> \
  --functions-version 4

# Deploy with func CLI
func azure functionapp publish <app-name>
```

**Smart defaults:**
- Plan: Consumption (pay-per-execution) for most cases
- Runtime version: Latest LTS for the detected language

See [Azure Functions Guide](./reference/functions.md) for advanced scenarios including:
- Function project initialization with `func init`
- Programming models (Node.js v4, Python v2, .NET isolated)
- Trigger types (HTTP, Timer, Queue, Blob, Service Bus)
- Binding configuration
- Deployment slots for zero-downtime
- Application Insights integration

### 4.3 Azure Container Apps Deployment

**For containerized applications, microservices, and scheduled jobs**

**Prerequisites validation:**
```bash
# CRITICAL: Verify Docker is running
docker ps

# If Docker not running, start Docker Desktop before proceeding
```

**Create and deploy containerized app:**
```bash
# Create resource group
az group create --name <resource-group> --location <location>

# Create Container Apps environment
az containerapp env create \
  --name <environment-name> \
  --resource-group <resource-group> \
  --location <location>

# Create Azure Container Registry
az acr create \
  --name <registry-name> \
  --resource-group <resource-group> \
  --sku Basic \
  --admin-enabled true

# Build and push image
az acr build \
  --registry <registry-name> \
  --image <app-name>:latest \
  --file Dockerfile \
  .

# Create container app with managed identity for ACR
az containerapp create \
  --name <app-name> \
  --resource-group <resource-group> \
  --environment <environment-name> \
  --image <registry-name>.azurecr.io/<app-name>:latest \
  --target-port 3000 \
  --ingress external \
  --registry-server <registry-name>.azurecr.io \
  --registry-identity system \
  --min-replicas 1 \
  --max-replicas 10 \
  --cpu 0.5 \
  --memory 1Gi

# Assign AcrPull role to managed identity
IDENTITY_ID=$(az containerapp show \
  --name <app-name> \
  --resource-group <resource-group> \
  --query identity.principalId -o tsv)

ACR_ID=$(az acr show \
  --name <registry-name> \
  --resource-group <resource-group> \
  --query id -o tsv)

az role assignment create \
  --assignee $IDENTITY_ID \
  --role AcrPull \
  --scope $ACR_ID
```

**Smart defaults:**
- CPU: 0.5 cores for most apps, 0.25 for jobs
- Memory: 1Gi for apps, 0.5Gi for lightweight services
- Min replicas: 1 for production, 0 for dev/test (scale-to-zero)

See [Container Apps Guide](./reference/container-apps.md) for comprehensive coverage including:
- Multi-service deployment (frontend + backend)
- Container Apps Jobs (scheduled, manual, event-driven)
- Dockerfile examples and best practices
- Auto-scaling configuration
- Infrastructure as Code with Bicep
- Troubleshooting and monitoring

### 4.4 App Service Deployment

**For server-side rendered apps and traditional web frameworks**

**Create and deploy:**
```bash
# Create resource group
az group create --name <resource-group> --location <location>

# Create App Service plan
az appservice plan create \
  --name <plan-name> \
  --resource-group <resource-group> \
  --location <location> \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --name <app-name> \
  --resource-group <resource-group> \
  --plan <plan-name> \
  --runtime "<runtime>"

# Deploy code (zip deploy)
az webapp deploy \
  --name <app-name> \
  --resource-group <resource-group> \
  --src-path <path-to-zip> \
  --type zip
```

**Runtime values by language:**
- Node.js: `"NODE:18-lts"`, `"NODE:20-lts"`
- Python: `"PYTHON:3.11"`, `"PYTHON:3.12"`
- .NET: `"DOTNETCORE:8.0"`
- Java: `"JAVA:17-java17"`

**Smart defaults:**
- Plan SKU: `B1` for dev/test, `P1v3` for production
- Always use Linux (`--is-linux`) unless .NET Framework required

See [App Service Guide](./reference/app-service.md) for configuration options.

---

## Phase 5: Multi-Service Deployment (azd + IaC)

When multiple services or infrastructure dependencies are detected, recommend Azure Developer CLI with Infrastructure as Code.

### When to Use azd
- Multiple deployable components (frontend + API + functions)
- Needs database, cache, storage, or messaging services
- Requires consistent environments (dev, staging, production)
- Team collaboration with reproducible infrastructure

### Initialize azd Project
```bash
# Initialize from scratch
azd init

# Or use a template
azd init --template <template-name>
```

### Project Structure
```
project/
├── azure.yaml              # azd configuration
├── infra/
│   ├── main.bicep          # Main infrastructure
│   ├── main.parameters.json
│   └── modules/            # Reusable modules
├── src/
│   ├── web/                # Frontend
│   └── api/                # Backend
```

### Deploy with azd
```bash
# Provision infrastructure + deploy code
azd up

# Or separately:
azd provision  # Create infrastructure
azd deploy     # Deploy application code

# Manage environments
azd env new staging
azd env select staging
azd up
```

See [Multi-Service Guide](./reference/multi-service.md) for azure.yaml configuration.
See [Azure Verified Modules](./reference/azure-verified-modules.md) for Bicep module reference.

---

## Troubleshooting Quick Reference

### Common Issues

**"Not logged in" errors:**
```bash
az login
az account set --subscription "<name>"
```

**"Resource group not found":**
```bash
az group create --name <name> --location <location>
```

**Docker not running (Container Apps):**
- Start Docker Desktop (Windows: Search in Start menu, macOS: Open from Applications)
- Verify with `docker ps` before deployment

**SWA deployment fails:**
- Check build output directory is correct
- Verify deployment token is valid
- Use `--verbose silly` flag for detailed error messages
- Ensure `staticwebapp.config.json` is properly formatted

**Functions deployment fails:**
- Verify `host.json` exists
- Check runtime version matches function app configuration
- Ensure storage account is accessible
- Run `func --version` to confirm Core Tools installed

**Container Apps deployment fails:**
- Verify Docker is running with `docker ps`
- Check ACR credentials and managed identity has AcrPull role
- Verify target-port matches application listening port
- Check logs: `az containerapp logs show --name <app> --resource-group <rg>`

**App Service deployment fails:**
- Verify runtime matches application
- Check startup command if using custom entry point
- Review deployment logs: `az webapp log tail --name <app> --resource-group <rg>`

See [Troubleshooting Guide](./reference/troubleshooting.md) for detailed solutions.

---

## Reference Files

Load these guides as needed for detailed information:

- [📦 App Service Guide](./reference/app-service.md) - Full App Service deployment reference
- [⚡ Azure Functions Guide](./reference/functions.md) - Functions deployment, triggers, and bindings
- [🌐 Static Web Apps Guide](./reference/static-web-apps.md) - SWA CLI, configuration, and deployment
- [🐳 Container Apps Guide](./reference/container-apps.md) - Container Apps and Jobs deployment
- [🖥️ Local Preview Guide](./reference/local-preview.md) - Local development setup
- [🏗️ Multi-Service Guide](./reference/multi-service.md) - azd and IaC patterns
- [📚 Azure Verified Modules](./reference/azure-verified-modules.md) - Bicep module reference
- [🔧 Troubleshooting Guide](./reference/troubleshooting.md) - Common issues and fixes
- [📋 Common Patterns](./reference/common-patterns.md) - Shared commands (DRY reference)
