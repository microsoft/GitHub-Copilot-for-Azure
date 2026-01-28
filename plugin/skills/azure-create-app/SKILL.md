---
name: azure-create-app
description: Create Azure-ready application configurations. USE THIS SKILL when users want to prepare their application for Azure deployment, create azure.yaml, generate infrastructure files, set up azd projects, or build an application for Azure. Trigger phrases include "prepare for Azure", "create azure.yaml", "set up azd", "generate infrastructure", "configure for Azure", "make this Azure-ready", "build an app that", "create an application that", "build me an app", "make an app", etc.
---

# Azure Create App Skill

Create Azure-ready application configurations using Azure Developer CLI (azd). This skill generates the required configuration files for Azure deployment.

---

## Execution Flow

Execute these steps in order.

### Step 1: Check Existing State

Check for existing configuration files:

**If `azure.yaml` exists:**
- Project is already configured for Azure
- User may need to update configuration or deploy (use azure-deploy skill)
- Ask user if they want to regenerate configuration

**If `azd-arch-plan.md` exists but no `azure.yaml`:**
- Read `azd-arch-plan.md` to determine last completed phase
- Resume from the incomplete phase

**If neither file exists:**
- Proceed to Step 2 (Discovery)

### Step 2: Discovery Analysis

Call the `azure-azd` MCP tool:
```json
{
  "command": "discovery_analysis",
  "parameters": {}
}
```

This tool returns instructions to:
- Scan the file system recursively
- Identify programming languages and frameworks
- Classify components (web apps, APIs, databases, etc.)
- Map dependencies between components
- Create `azd-arch-plan.md` with findings

Execute the returned instructions before proceeding.

### Step 3: Architecture Planning

Call the `azure-azd` MCP tool:
```json
{
  "command": "architecture_planning",
  "parameters": {}
}
```

This tool returns instructions to:
- Select appropriate Azure services for each component
- Plan hosting strategy
- Design containerization approach if needed
- Update `azd-arch-plan.md` with service selections

Execute the returned instructions before proceeding.

### Step 4: File Generation

Call these MCP tools in sequence using `azure-azd`:

**4a. Get IaC rules:**
```json
{
  "command": "iac_generation_rules",
  "parameters": {}
}
```

**4b. Generate Dockerfiles (if containerizing):**
```json
{
  "command": "docker_generation",
  "parameters": {}
}
```

**4c. Generate Bicep templates:**
```json
{
  "command": "infrastructure_generation",
  "parameters": {}
}
```

**4d. Generate azure.yaml:**
```json
{
  "command": "azure_yaml_generation",
  "parameters": {}
}
```

Each tool returns instructions. Execute them before calling the next tool.

**Required output files:**
- `azure.yaml` - Always required
- `infra/main.bicep` - Always required
- `infra/main.parameters.json` - Always required
- `Dockerfile` - Required for Container Apps or AKS hosts

### Step 5: Validation (REQUIRED)

**This step is mandatory. Do not proceed to Step 6 until validation completes without errors.**

Call the `azure-azd` tool:
```json
{
  "command": "project_validation",
  "parameters": {}
}
```

This tool returns instructions to validate:
- azure.yaml against schema
- Bicep template compilation
- AZD environment configuration
- Package building
- Provision preview

**For quick azure.yaml-only validation:**
```json
{
  "command": "validate_azure_yaml",
  "parameters": {
    "path": "./azure.yaml"
  }
}
```

Resolve ALL validation errors before proceeding. Repeat validation until zero errors are returned.

### Step 6: Complete

Configuration is complete. Inform the user:
- `azure.yaml` and infrastructure files are ready
- To deploy, use the azure-deploy skill

---

## Application Type Detection

When running discovery, use these patterns to identify application types:

**Node.js applications** (package.json exists):
- `next.config.js/mjs/ts` with `output: 'export'` → Static Web Apps
- `next.config.js/mjs/ts` without export config → Container Apps (SSR)
- `angular.json` → Static Web Apps
- `vite.config.*` → Static Web Apps
- `gatsby-config.js` → Static Web Apps
- `astro.config.mjs` → Static Web Apps
- `nest-cli.json` → Container Apps
- express/fastify/koa/hapi dependency → Container Apps

**Python applications** (requirements.txt or pyproject.toml exists):
- `function_app.py` exists → Azure Functions
- `azure-functions` dependency → Azure Functions
- flask/django/fastapi dependency → Container Apps

**.NET applications** (*.csproj or *.sln exists):
- `<AzureFunctionsVersion>` in csproj → Azure Functions
- Blazor WebAssembly → Static Web Apps
- ASP.NET Core → Container Apps

**Java applications** (pom.xml or build.gradle exists):
- `azure-functions-*` dependency → Azure Functions
- spring-boot dependency → Container Apps

**Static sites** (index.html without package.json/requirements.txt):
- → Static Web Apps

**Containerized applications** (Dockerfile exists):
- → Container Apps (or AKS if complex K8s needs)

**Multi-service indicators:**
- Monorepo structure (frontend/, backend/, api/)
- docker-compose.yml with multiple services
- Multiple package.json files in subdirectories
- Database connection strings in config files

---

## Service Selection Rules

Use these rules when mapping components to Azure services:

**Use Static Web Apps when:**
- Application is a static frontend (React, Vue, Angular, Svelte)
- Application is a Jamstack site (Gatsby, Hugo, Astro)
- Application needs global CDN distribution
- Application has optional serverless API

**Static Web Apps requirement:** Built files must be in a `dist` folder. Reference this in `azure.yaml` using the `dist` property. For plain HTML sites, create a `dist/` folder and copy deployable files there.

**Use Container Apps when:**
- Application is a microservice or API
- Application is a full-stack web application
- Application needs background workers or queue processors
- Application needs scheduled jobs (use Container Apps Jobs)
- Application is already containerized with Docker

**Use Azure Functions when:**
- Application is event-driven serverless
- Application needs HTTP APIs with per-request billing
- Application needs timer-triggered jobs
- Application uses queue/blob/event triggers

**Use App Service when:**
- Application is a traditional web application
- Container Apps features are not needed
- Migrating existing App Service application

**Use AKS when:**
- Application has complex Kubernetes requirements
- Application needs custom operators or CRDs
- Team has existing Kubernetes expertise

---

## azure.yaml Configuration

The `host` property determines the Azure service:
- `containerapp` - Azure Container Apps
- `appservice` - Azure App Service  
- `staticwebapp` - Azure Static Web Apps
- `function` - Azure Functions
- `aks` - Azure Kubernetes Service

**Language property rules:**
- For `staticwebapp`: Do NOT specify language for plain HTML sites
- For `containerapp`: Optional, used for build detection
- For `appservice`: Required for runtime selection
- For `function`: Required for runtime

**Valid language values:** `js`, `ts`, `python`, `csharp`, `java`, `go`

**Example azure.yaml:**
```yaml
name: my-application
services:
  web:
    project: ./src/web
    host: staticwebapp
    dist: ./dist
  api:
    project: ./src/api
    host: containerapp
    language: python
```

---

## Error Handling

If any MCP tool call fails, call `azure-azd` MCP tool:
```json
{
  "intent": "troubleshoot azd error",
  "command": "error_troubleshooting",
  "parameters": {}
}
```

Common error resolutions:
- "azure.yaml invalid" → Call `validate_azure_yaml` and fix errors
- "Bicep compilation error" → Check module paths and parameters

---

## Reference Guides

Load these guides for service-specific details:
- [Static Web Apps Guide](./reference/static-web-apps.md)
- [Container Apps Guide](./reference/container-apps.md)
- [Azure Functions Guide](./reference/functions.md)
- [App Service Guide](./reference/app-service.md)
- [AKS Guide](./reference/aks.md)
