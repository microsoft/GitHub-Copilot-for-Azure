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

Call the `azure__azd` MCP tool with the `discovery_analysis` command:
```javascript
await azure__azd({
  command: "discovery_analysis",
  parameters: {}
});
```

This tool returns instructions to:
- Scan the file system recursively
- Identify programming languages and frameworks
- Classify components (web apps, APIs, databases, etc.)
- Map dependencies between components
- Create `azd-arch-plan.md` with findings

Execute the returned instructions before proceeding.

### Step 3: Architecture Planning

Call the `azure__azd` MCP tool with the `architecture_planning` command:
```javascript
await azure__azd({
  command: "architecture_planning",
  parameters: {}
});
```

This tool returns instructions to:
- Select appropriate Azure services for each component
- Plan hosting strategy
- Design containerization approach if needed
- Update `azd-arch-plan.md` with service selections

Execute the returned instructions before proceeding.

### Step 4: File Generation

Call these MCP tools in sequence using `azure__azd`:

**4a. Get IaC rules:**
```javascript
await azure__azd({
  command: "iac_generation_rules",
  parameters: {}
});
```

**4b. Generate Dockerfiles (if containerizing):**
```javascript
await azure__azd({
  command: "docker_generation",
  parameters: {}
});
```

**4c. Generate Bicep templates:**
```javascript
await azure__azd({
  command: "infrastructure_generation",
  parameters: {}
});
```

**4d. Generate azure.yaml:**
```javascript
await azure__azd({
  command: "azure_yaml_generation",
  parameters: {}
});
```

Each tool returns instructions. Execute them before calling the next tool.

**Required output files:**
- `azure.yaml` - Always required
- `infra/main.bicep` - Always required
- `infra/main.parameters.json` - Always required
- `Dockerfile` - Required for Container Apps or AKS hosts

### Step 5: Validation (REQUIRED)

**This step is mandatory. Do not proceed to Step 6 until validation completes without errors.**

Call the `azure__azd` MCP tool with the `project_validation` command:
```javascript
await azure__azd({
  command: "project_validation",
  parameters: {}
});
```

This tool returns instructions to validate:
- azure.yaml against schema
- Bicep template compilation
- AZD environment configuration
- Package building
- Provision preview

**For quick azure.yaml-only validation:**
```javascript
await azure__azd({
  command: "validate_azure_yaml",
  parameters: { path: "./azure.yaml" }
});
```

Resolve ALL validation errors before proceeding. Repeat validation until zero errors are returned.

### Step 6: Complete

Configuration is complete. Inform the user:
- `azure.yaml` and infrastructure files are ready
- To deploy, use the azure-deploy skill

---

## Reference Guides

Load these guides as needed:

**Discovery & Planning:**

- [Application Type Detection](./reference/app-type-detection.md) - Patterns for identifying application types
- [Service Selection Rules](./reference/service-selection.md) - Mapping components to Azure services

**Configuration:**

- [azure.yaml Configuration](./reference/azure-yaml-config.md) - Configuration file reference
- [Error Handling](./reference/error-handling.md) - Troubleshooting and common errors

**Service-Specific Details:**

- [Static Web Apps Guide](../azure-deploy/reference/static-web-apps.md)
- [Container Apps Guide](../azure-deploy/reference/container-apps.md)
- [Azure Functions Guide](../azure-deploy/reference/functions.md)
- [App Service Guide](../azure-deploy/reference/app-service.md)
- [AKS Guide](../azure-deploy/reference/aks.md)
