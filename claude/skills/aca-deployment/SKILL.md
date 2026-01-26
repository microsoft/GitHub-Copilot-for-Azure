---
name: azure-aca-deployment
description: Automated deployment workflow for containerized applications to Azure Container Apps using Azure MCP tools. Use this skill when deploying full-stack web applications, containerized microservices, APIs with auto-scaling, or multi-container applications to Azure.
---

# Azure Container Apps Deployment

Automated deployment workflow for containerized applications to Azure Container Apps using Azure MCP tools.

## Skill Activation Triggers

**Use this skill immediately when the user asks to:**
- "Create a [todo/blog/app] and deploy to Azure"
- "Deploy my web application to Azure"
- "Build a [full-stack app/website] with frontend and backend"
- "Deploy containerized application to Azure"
- "Create and deploy a [Node.js/Python/Java] app with UI"
- Any request involving both a **service/API** AND a **UI/frontend** being deployed to Azure

**Key Indicators:**
- Project has multiple components (web + api, frontend + backend, ui + service)
- User mentions containerization or Docker
- User wants to deploy to Azure (without specifying a specific service)
- User needs auto-scaling, microservices, or serverless containers

## Overview

This skill enables end-to-end deployment of containerized applications to Azure Container Apps (ACA), leveraging Azure MCP tools for infrastructure planning, generation, validation, and monitoring. Azure Container Apps is a fully managed serverless container platform ideal for:
- **Full-stack web applications** with separate frontend (UI) and backend (API) services
- **Microservices architectures** with multiple interconnected services
- **RESTful APIs** with auto-scaling capabilities
- **Event-driven applications** that respond to messages or events

```
Plan → Generate IaC → Validate → Deploy → Monitor
  ↑                                        │
  └────────────────────────────────────────┘
```

## When to Use

• **Full-stack web applications**: Deploy complete web apps with frontend (HTML/React/Vue/Angular) and backend (Node.js/Python/Java) as separate container apps
• **Todo apps, blogs, e-commerce sites**: Any web application with a UI and API service layer
• **Single-page applications (SPA) with APIs**: Frontend serving static files + backend API container
• **Microservices deployment**: Deploy multiple containerized services with inter-service communication
• **API hosting**: Host RESTful APIs with auto-scaling and ingress configuration
• **Background workers**: Run asynchronous job processors without ingress
• **Event-driven apps**: Build applications that scale based on queue depth or custom metrics

## Pattern 0: Prerequisites Validation

Validate all prerequisites before starting deployment to avoid common failures.

```javascript
async function validatePrerequisites() {
  const checks = [];
  
  // Check Docker is installed and running
  try {
    await exec('docker ps');
    checks.push({ name: 'Docker', status: 'running' });
  } catch (error) {
    if (error.message.includes('daemon is not running')) {
      throw new Error('Docker Desktop is not running. Please start Docker Desktop and try again.');
    }
    throw new Error('Docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop');
  }
  
  // Check Azure CLI authentication
  try {
    await exec('az account show');
    checks.push({ name: 'Azure CLI', status: 'authenticated' });
  } catch (error) {
    throw new Error('Not authenticated with Azure CLI. Run: az login');
  }
  
  // Check Azure Developer CLI authentication
  try {
    await exec('azd auth login --check-status');
    checks.push({ name: 'Azure Developer CLI', status: 'authenticated' });
  } catch (error) {
    throw new Error('Not authenticated with Azure Developer CLI. Run: azd auth login');
  }
  
  // Check Azure location is set
  try {
    const location = process.env.AZURE_LOCATION;
    if (!location) {
      throw new Error('AZURE_LOCATION not set. Run: azd env set AZURE_LOCATION eastus');
    }
    checks.push({ name: 'Azure Location', status: location });
  } catch (error) {
    throw error;
  }
  
  return checks;
}
```

**Key insight**: Always validate Docker is running before deployment. The most common failure is attempting to build container images when Docker daemon is not started.

## Pattern 1: Deployment Planning

Generate a deployment plan by analyzing your workspace and recommending Azure resources.

```javascript
async function planDeployment(workspaceFolder: string, projectName: string) {
  // Generate deployment plan
  const plan = await mcp_azure_mcp_deploy({
    intent: "Generate deployment plan for container app",
    command: "deploy_plan_get",
    parameters: {
      "workspace-folder": workspaceFolder,
      "project-name": projectName,
      "target-app-service": "ContainerApp",
      "provisioning-tool": "AZD",
      "azd-iac-options": "bicep"
    }
  });
  
  // Plan saved to: .azure/plan.copilotmd
  return plan;
}
```

**Key insight**: The deployment plan detects services, dependencies, and recommends Azure resources before any infrastructure is created.

## Pattern 2: Infrastructure as Code Generation

Retrieve IaC best practices and generate Bicep files for Container Apps deployment.

```javascript
async function generateInfrastructure(projectName: string) {
  // Get IaC rules
  const rules = await mcp_azure_mcp_deploy({
    intent: "Get IaC rules",
    command: "deploy_iac_rules_get",
    parameters: {
      "deployment-tool": "AZD",
      "iac-type": "bicep",
      "resource-types": "containerapp"
    }
  });
  
  // Get Bicep schema
  const schema = await mcp_bicep_get_az_resource_type_schema({
    resourceType: "Microsoft.App/containerApps",
    apiVersion: "2024-03-01"
  });
  
  // Generate main.bicep based on schema and rules
  // Files created: infra/main.bicep, infra/main.parameters.json, azure.yaml
}
```

**Key insight**: Always validate infrastructure before deploying using preview commands to catch configuration issues early.

## Pattern 2.5: Multi-Service Deployment (UI + Backend)

Deploy full-stack applications with both frontend and backend services in the same Container Apps environment.

```javascript
async function deployFullStackApp(projectName: string) {
  // Project structure:
  // /web       - Frontend (HTML/CSS/JS or React/Vue)
  // /api       - Backend (Node.js/Python/Java)
  // /Dockerfile - Multi-stage build or separate Dockerfiles
  
  const services = [
    {
      name: `${projectName}-web`,
      path: './web',
      language: 'JavaScript',
      type: 'frontend',
      ingress: {
        external: true,
        targetPort: 80,
        allowInsecure: false
      }
    },
    {
      name: `${projectName}-api`,
      path: './api',
      language: 'JavaScript',
      type: 'backend',
      ingress: {
        external: true,  // or false if only internal access
        targetPort: 3000,
        allowInsecure: false
      },
      env: [
        { name: 'NODE_ENV', value: 'production' }
      ]
    }
  ];
  
  // Generate deployment plan for multi-service app
  const plan = await mcp_azure_mcp_deploy({
    intent: "Generate deployment plan for full-stack app",
    command: "deploy_plan_get",
    parameters: {
      "workspace-folder": process.cwd(),
      "project-name": projectName,
      "target-app-service": "ContainerApp",
      "provisioning-tool": "AZD",
      "azd-iac-options": "bicep"
    }
  });
  
  // For single Dockerfile serving both UI and API:
  // - Frontend files served as static from /web
  // - Backend API exposed on /api/* routes
  // - Single container app with one ingress
  
  return { plan, services };
}
```

**Key insight**: For simple full-stack apps (like todo apps), you can use a single container where the backend serves both the API routes and the static frontend files. For more complex apps, deploy separate container apps for frontend and backend.

**Architecture Options**:
1. **Single Container**: Backend serves static frontend files + API (simpler, good for small apps)
2. **Two Containers**: Separate UI and API containers (better for larger apps, independent scaling)
3. **Microservices**: Multiple backend services + frontend (enterprise applications)

## Pattern 3: Deployment Validation

Monitor and validate deployments using application logs and health checks.

```javascript
async function validateDeployment(workspaceFolder: string, envName: string) {
  // Get application logs
  const logs = await mcp_azure_mcp_deploy({
    intent: "Get deployment logs",
    command: "deploy_app_logs_get",
    parameters: {
      "workspace-folder": workspaceFolder,
      "azd-env-name": envName,
      "limit": 200
    }
  });
  
  // Check for errors in logs
  const hasErrors = logs.some(log => log.includes("error") || log.includes("exception"));
  
  if (hasErrors) {
    throw new Error("Deployment validation failed - errors found in logs");
  }
  
  return { status: "success", logs };
}
```

## Deployment Strategies

### Regional Validation

Check quota and availability before deploying to avoid failures.

```javascript
async function checkRegionalCapacity(subscription: string, location: string) {
  const availability = await mcp_azure_mcp_quota({
    intent: "Check availability",
    command: "quota_region_availability_list",
    parameters: {
      subscription,
      "resource-type": "Microsoft.App/containerApps"
    }
  });
  
  return availability.regions.includes(location);
}
```

### Architecture Visualization

Generate diagrams to understand service dependencies before deployment.

```javascript
async function visualizeArchitecture(workspaceFolder: string, services: Array) {
  return await mcp_azure_mcp_deploy({
    intent: "Generate architecture diagram",
    command: "deploy_architecture_diagram_generate",
    parameters: {
      workspaceFolder,
      projectName: "myapp",
      services
    }
  });
}
```

### CI/CD Automation

Get pipeline configuration guidance for automated deployments.

```javascript
async function setupCICD(subscription: string) {
  return await mcp_azure_mcp_deploy({
    intent: "Get CI/CD guidance",
    command: "deploy_pipeline_guidance_get",
    parameters: {
      "use-azd-pipeline-config": true,
      subscription
    }
  });
}
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Validate Docker first** | Always verify Docker is running with `docker ps` before starting deployment to avoid build failures |
| **Use managed identity** | Always prefer managed identity over key-based authentication for secure resource access |
| **Preview first** | Run `azd provision --preview` to validate infrastructure changes before deploying |
| **Test locally** | Build and test Docker images locally before pushing to Azure Container Registry |
| **Port matching** | Ensure target-port in configuration matches the port your application listens on |
| **Structured logging** | Enable Application Insights and Log Analytics for centralized monitoring |
| **Health probes** | Configure liveness and readiness probes for reliability |
| **Auto-scaling** | Set min/max replica counts based on expected workload patterns |

## Quick Start Checklist

### Setup
- [ ] Azure subscription created
- [ ] Azure CLI installed (`az --version`)
- [ ] Azure CLI authenticated (`az login`)
- [ ] Docker Desktop installed and **running** (`docker ps`)
- [ ] Azure Developer CLI (azd) installed (`azd version`)
- [ ] Azure Developer CLI authenticated (`azd auth login`)
- [ ] Azure location configured (`azd env set AZURE_LOCATION eastus`)
- [ ] Application containerized with Dockerfile
- [ ] **For full-stack apps**: Verify both frontend and backend can be containerized together or separately

### Planning
- [ ] Generate deployment plan with `deploy_plan_get`
- [ ] Get IaC rules with `deploy_iac_rules_get`
- [ ] Check regional availability with `quota_region_availability_list`
- [ ] Generate architecture diagram

### Implementation
- [ ] Create Bicep files (main.bicep, main.parameters.json)
- [ ] Configure azure.yaml for azd
- [ ] Build and test Docker image locally
- [ ] Preview deployment with `azd provision --preview`

### Deployment
- [ ] Deploy with `azd up`
- [ ] Validate with `deploy_app_logs_get`
- [ ] Test application endpoints
- [ ] Configure monitoring and alerts

### Automation
- [ ] Get CI/CD guidance with `deploy_pipeline_guidance_get`
- [ ] Set up GitHub Actions or Azure Pipelines
- [ ] Configure automated testing and deployment

## Azure Resources

### Core Resources for Container Apps

| Resource Type | Purpose | API Version |
|--------------|---------|-------------|
| `Microsoft.App/containerApps` | Container App instance | 2024-03-01 |
| `Microsoft.App/managedEnvironments` | Container Apps Environment | 2024-03-01 |
| `Microsoft.ContainerRegistry/registries` | Container Registry (ACR) | 2023-11-01-preview |
| `Microsoft.OperationalInsights/workspaces` | Log Analytics | 2023-09-01 |

### Example Bicep Template

```bicep
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: projectName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: projectName
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
      }
    }
  }
}
```

## Troubleshooting

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Docker not running** | Error: "Docker daemon is not running" | Start Docker Desktop. Windows: Search for Docker Desktop in Start menu. Verify with `docker ps` |
| **Docker not installed** | Error: "docker: command not found" | Install Docker Desktop from https://www.docker.com/products/docker-desktop |
| **Not authenticated** | Error: "authentication required" | Run `az login` and `azd auth login` to authenticate |
| **Location not set** | Error: "location property must be specified" | Set location: `azd env set AZURE_LOCATION eastus` |
| **Bicep validation errors** | Error during `azd provision` | Run `get_errors` tool on Bicep files to identify syntax issues |
| **User/group already exists** | Dockerfile build fails with "group in use" | Base images may have users pre-configured. Check if user exists before creating |
| **Port mismatch** | App not accessible after deployment | Verify target-port matches application listening port in Dockerfile |
| **Image pull errors** | Container fails to start | Check ACR credentials and managed identity has AcrPull role |
| **Out of memory** | Container crashes or restarts | Increase memory limits in Bicep configuration |
| **Missing env vars** | Application errors on startup | Configure environment variables in container app settings |
| **Health probe failures** | Container marked unhealthy | Implement /health endpoint and adjust probe timings |

## Additional Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/azure/container-apps/)
- [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/)
- [Container Apps Bicep Samples](https://learn.microsoft.com/azure/container-apps/samples)
- [Azure Verified Modules](https://azure.github.io/Azure-Verified-Modules/)
