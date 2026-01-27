---
name: azure-deploy
description: Deploy applications to Azure App Service, Azure Functions, and Static Web Apps. USE THIS SKILL when users want to deploy, publish, host, or run their application on Azure. This skill detects application type (React, Vue, Angular, Next.js, Python, .NET, Java, etc.), recommends the optimal Azure service, provides local preview capabilities, and guides deployment. Trigger phrases include "deploy to Azure", "host on Azure", "publish to Azure", "run on Azure", "get this running in the cloud", "deploy my app", "Azure deployment", "set up Azure hosting", "deploy to App Service", "deploy to Functions", "deploy to Static Web Apps", "preview locally", "test before deploying", "what Azure service should I use", "help me deploy", etc. Also handles multi-service deployments with Azure Developer CLI (azd) and Infrastructure as Code when complexity is detected.
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

| File Found | Recommendation | Action |
|------------|----------------|--------|
| `azure.yaml` | Already configured for azd | Use `azd up` to deploy |
| `function.json` or `host.json` | Azure Functions project | **Route to `azure-function-app-deployment` skill** |
| `staticwebapp.config.json` or `swa-cli.config.json` | Static Web Apps project | **Route to `azure-static-web-apps` skill** |

If found, route to the appropriate specialized skill.

> 💡 **When to use azure-static-web-apps skill:**
> - Project has `staticwebapp.config.json` or `swa-cli.config.json`
> - User wants to deploy static frontends (React, Vue, Angular, etc.) to Azure
> - User needs local development emulation with SWA CLI
> - User wants to add Azure Functions APIs to their static site
> - User mentions Static Web Apps or SWA CLI
> 
> The `azure-static-web-apps` skill provides specialized guidance for SWA CLI configuration, local emulation, GitHub Actions workflows, and database connections.

**Check for containerization signals:**

| File/Indicator Found | Recommendation | Action |
|---------------------|----------------|--------|
| `Dockerfile` | Containerized application | **Consider using the `azure-aca-deployment` skill** for Container Apps |
| `docker-compose.yml` | Multi-container application | **Consider using the `azure-aca-deployment` skill** for Container Apps |
| User mentions "container", "Docker", "scheduled task", "cron job", "batch processing" | Container-based deployment | **Route to `azure-aca-deployment` skill** |

> 💡 **When to use azure-aca-deployment skill:**
> - Application is already containerized (has Dockerfile)
> - User wants to deploy multiple containers together
> - User needs scheduled tasks, cron jobs, or event-driven batch processing
> - User mentions Container Apps or wants serverless containers
> 
> The `azure-aca-deployment` skill provides specialized guidance for Docker validation, ACR integration, Container Apps Jobs, and multi-container orchestration.

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
│   └── **Route to `azure-static-web-apps` skill for SWA CLI setup**
├── vite.config.* → Vite-based (React/Vue/Svelte) → Static Web Apps
│   └── **Route to `azure-static-web-apps` skill for SWA CLI setup**
├── gatsby-config.js → Gatsby → Static Web Apps
│   └── **Route to `azure-static-web-apps` skill for SWA CLI setup**
├── astro.config.mjs → Astro → Static Web Apps
│   └── **Route to `azure-static-web-apps` skill for SWA CLI setup**
├── nest-cli.json → NestJS → App Service
├── Has express/fastify/koa/hapi dependency → App Service
└── No framework, just static build → Static Web Apps
```

**Python:**
```
requirements.txt or pyproject.toml exists →
├── function_app.py exists → Azure Functions (v2 programming model)
│   └── **Route to `azure-function-app-deployment` skill for specialized guidance**
├── Has flask dependency → App Service
├── Has django dependency → App Service
├── Has fastapi dependency → App Service
└── Has azure-functions dependency → Azure Functions
    └── **Route to `azure-function-app-deployment` skill for specialized guidance**
```

> 💡 **When to use azure-function-app-deployment skill:**
> - Project has `host.json`, `local.settings.json`, or `function_app.py`
> - User wants serverless APIs, event-driven functions, or timer-triggered jobs
> - User mentions Azure Functions, triggers, bindings, or webhooks
> 
> The `azure-function-app-deployment` skill provides specialized guidance for function initialization, trigger configuration, deployment slots, and function-specific troubleshooting.

**.NET:**
```
*.csproj or *.sln exists →
├── <AzureFunctionsVersion> in csproj → Azure Functions
│   └── **Route to `azure-function-app-deployment` skill for specialized guidance**
├── Blazor WebAssembly project → Static Web Apps
├── ASP.NET Core web app → App Service
└── .NET API project → App Service
```

**Java:**
```
pom.xml or build.gradle exists →
├── Has azure-functions-* dependency → Azure Functions
│   └── **Route to `azure-function-app-deployment` skill for specialized guidance**
├── Has spring-boot dependency → App Service
└── Standard web app → App Service
```

**Static Only:**
```
index.html exists + no package.json/requirements.txt →
└── Pure static site → Static Web Apps
    └── **Route to `azure-static-web-apps` skill for SWA CLI setup**
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

## Specialized Deployment Skills

This skill provides general deployment guidance. For specialized scenarios, consider using these dedicated skills:

### 🌐 azure-static-web-apps (Static Web Apps)
**Use when:**
- Deploying static frontends (React, Vue, Angular, Gatsby, Astro, etc.)
- User has `staticwebapp.config.json` or `swa-cli.config.json`
- Need local development emulation with SWA CLI
- Want to add Azure Functions APIs to static site
- Setting up GitHub Actions CI/CD for Static Web Apps

**Specialized features:**
- SWA CLI installation and configuration
- Local emulator with API proxy and auth simulation
- Framework auto-detection and configuration
- Database connections support
- Detailed GitHub Actions workflow setup
- Complete `staticwebapp.config.json` configuration guide

### 🐳 azure-aca-deployment (Container Apps)
**Use when:**
- Application has a `Dockerfile` or `docker-compose.yml`
- User mentions containers, Docker, or Container Apps
- Need to deploy scheduled tasks, cron jobs, or batch processing
- Deploying full-stack apps (frontend + backend) as separate containers
- Want serverless containers with auto-scaling

**Specialized features:**
- Docker Desktop validation and troubleshooting
- Azure Container Registry (ACR) integration with managed identity
- Container Apps Jobs (scheduled, manual, event-driven)
- Multi-container orchestration in same environment
- MCP tool integration for infrastructure planning

### ⚡ azure-function-app-deployment (Azure Functions)
**Use when:**
- Project has `host.json`, `local.settings.json`, or `function_app.py`
- User mentions serverless, Functions, triggers, or bindings
- Need HTTP-triggered APIs, timer jobs, or event handlers
- Want pay-per-execution pricing model

**Specialized features:**
- Function project initialization with `func` CLI
- Trigger and binding configuration (HTTP, Timer, Queue, Blob, etc.)
- Deployment slots for zero-downtime updates
- Function-specific monitoring and troubleshooting
- Extension management for custom bindings

**Routing decision:**
```
Dockerfile found? → Use azure-aca-deployment skill
host.json found? → Use azure-function-app-deployment skill
staticwebapp.config.json or swa-cli.config.json found? → Use azure-static-web-apps skill
Static framework detected (React, Vue, Angular)? → Use azure-static-web-apps skill
None of the above? → Continue with this skill (azure-deploy)
```

---

## Phase 2: Local Preview (No Azure Auth Required)

Before deploying, help users test locally.

### Static Web Apps - Local Preview
```bash
# Install SWA CLI (one-time)
npm install -g @azure/static-web-apps-cli

# Start local emulator
swa start

# Or with specific paths
swa start ./dist --api-location ./api

# With a dev server proxy
swa start http://localhost:3000 --api-location ./api
```

### Azure Functions - Local Preview
```bash
# Install Azure Functions Core Tools (one-time)
npm install -g azure-functions-core-tools@4

# Start local Functions runtime
func start

# With specific port
func start --port 7071
```

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
# npm (all platforms)
npm install -g azure-functions-core-tools@4

# macOS
brew tap azure/functions && brew install azure-functions-core-tools@4

# Windows
winget install Microsoft.AzureFunctionsCoreTools
```

**Static Web Apps CLI** (for SWA projects):
```bash
npm install -g @azure/static-web-apps-cli
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

## Phase 4: Single-Service Deployment (Azure CLI)

### 4.1 Static Web Apps Deployment

> 💡 **For advanced Static Web Apps scenarios**, consider using the specialized `azure-static-web-apps` skill which provides:
> - SWA CLI configuration and local emulation
> - Framework-specific setup guidance
> - Azure Functions API integration
> - GitHub Actions workflow automation
> - Database connections setup
> - Advanced routing and authentication configuration

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
az staticwebapp secrets list \
  --name <app-name> \
  --resource-group <resource-group> \
  --query "properties.apiKey" -o tsv

# Deploy with SWA CLI
swa deploy ./dist \
  --deployment-token <token> \
  --env production
```

**Plain HTML Site (Single File or No Build Step):**

For plain HTML sites without a build process, SWA CLI requires content in a dedicated folder:
```bash
# Create output directory and copy files
mkdir -p dist && cp -r *.html *.css *.js *.png *.jpg *.svg dist/ 2>/dev/null || true

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

**Smart defaults:**
- SKU: `Free` for dev/test, `Standard` for production
- Location: SWA has limited regions - use `centralus`, `eastus2`, `westus2`, `westeurope`, or `eastasia`

See [Static Web Apps Guide](./reference/static-web-apps.md) for detailed configuration.

### 4.2 Azure Functions Deployment

> 💡 **For advanced Functions deployment scenarios**, consider using the specialized `azure-function-app-deployment` skill which provides:
> - Function project initialization and templating
> - Detailed trigger/binding configuration
> - Deployment slots and CI/CD patterns
> - Function-specific troubleshooting

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

See [Azure Functions Guide](./reference/functions.md) for advanced scenarios.

### 4.3 App Service Deployment

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

**SWA deployment fails:**
- Check build output directory is correct
- Verify deployment token is valid
- Ensure `staticwebapp.config.json` is properly formatted

**Functions deployment fails:**
- Verify `host.json` exists
- Check runtime version matches function app configuration
- Ensure storage account is accessible

**App Service deployment fails:**
- Verify runtime matches application
- Check startup command if using custom entry point
- Review deployment logs: `az webapp log tail --name <app> --resource-group <rg>`

See [Troubleshooting Guide](./reference/troubleshooting.md) for detailed solutions.

---

## Specialized Skills

For advanced scenarios, use these specialized deployment skills:

- **🌐 azure-static-web-apps** - Static Web Apps deployment with SWA CLI, local emulation, GitHub Actions, API integration, and database connections
- **🐳 azure-aca-deployment** - Container Apps deployment with Docker validation, ACR integration, Container Apps Jobs, and multi-container orchestration
- **⚡ azure-function-app-deployment** - Azure Functions deployment with func CLI, triggers/bindings, deployment slots, and function-specific troubleshooting

---

## Reference Files

Load these guides as needed for detailed information:

- [📦 App Service Guide](./reference/app-service.md) - Full App Service deployment reference
- [⚡ Azure Functions Guide](./reference/functions.md) - Functions deployment and configuration
- [🌐 Static Web Apps Guide](./reference/static-web-apps.md) - SWA deployment and configuration
- [🖥️ Local Preview Guide](./reference/local-preview.md) - Local development setup
- [🏗️ Multi-Service Guide](./reference/multi-service.md) - azd and IaC patterns
- [📚 Azure Verified Modules](./reference/azure-verified-modules.md) - Bicep module reference
- [🔧 Troubleshooting Guide](./reference/troubleshooting.md) - Common issues and fixes
- [📋 Common Patterns](./reference/common-patterns.md) - Shared commands (DRY reference)