---
name: foundry-create-project
description: |
  Create a new Azure AI Foundry project using Azure Developer CLI (azd) to provision infrastructure for hosting AI agents and models.
  USE FOR: create Foundry project, new AI Foundry project, set up Foundry, azd init Foundry, provision Foundry infrastructure, onboard to Foundry, create Azure AI project, set up AI project.
  DO NOT USE FOR: deploying agents to existing projects (use agent/deploy), creating agent code (use agent/create), deploying AI models from catalog (use microsoft-foundry main skill), Azure Functions (use azure-functions).
allowed-tools: Read, Write, Bash, AskUserQuestion
---

# Create Azure AI Foundry Project

This skill guides you through creating a new Azure AI Foundry project using the Azure Developer CLI (azd). The project provides the infrastructure needed to host AI agents, deploy models, and manage AI resources.

## Overview

### What This Skill Does

This skill automates the creation of a new Azure AI Foundry project by:
- Verifying prerequisites (Azure CLI, azd)
- Creating a new azd environment
- Provisioning Foundry infrastructure (account, project, Container Registry, Application Insights)
- Configuring managed identity and RBAC permissions
- Providing project details for subsequent agent deployments

### What Gets Created

When you create a new Foundry project, Azure provisions:

| Resource | Purpose |
|----------|---------|
| Azure AI Foundry Account | Parent resource for projects |
| Azure AI Foundry Project | Contains agents, models, and connections |
| Azure Container Registry | Stores agent container images |
| Application Insights | Logging and monitoring |
| Managed Identity | Secure authentication |
| RBAC Permissions | Access control |

## Prerequisites

Before creating a Foundry project, verify the following prerequisites. Run CLI checks automatically to confirm readiness.

### Step 0: Verify Prerequisites

Run these checks in order. If any fail, resolve before proceeding.

#### 0.1 Check Azure CLI Installation

```bash
az version
```

**Expected:** Version output (e.g., `"azure-cli": "2.x.x"`)

**If NOT installed:**
- Windows: `winget install Microsoft.AzureCLI`
- macOS: `brew install azure-cli`
- Linux: `curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash`
- Direct download: https://aka.ms/installazurecli

STOP and ask user to install Azure CLI before continuing.

#### 0.2 Check Azure Login and Subscription

```bash
az account show --query "{Name:name, SubscriptionId:id, State:state}" -o table
```

**Expected:** Shows active subscription with `State: Enabled`

**If NOT logged in or no subscription:**

```bash
az login
```

Complete browser authentication, then verify subscription:

```bash
az account list --query "[?state=='Enabled'].{Name:name, SubscriptionId:id, IsDefault:isDefault}" -o table
```

**If no active subscription appears:**
- User needs an Azure account with active subscription
- Create free account at: https://azure.microsoft.com/free/
- STOP and inform user to create/activate subscription

#### 0.3 Set Default Subscription

**If user has multiple subscriptions, ask which to use, then set:**

```bash
az account set --subscription "<subscription-name-or-id>"
```

**Verify the default:**

```bash
az account show --query name -o tsv
```

#### 0.4 Check Role Permissions

```bash
az role assignment list --assignee "$(az ad signed-in-user show --query id -o tsv)" --query "[?contains(roleDefinitionName, 'Owner') || contains(roleDefinitionName, 'Contributor') || contains(roleDefinitionName, 'Azure AI')].{Role:roleDefinitionName, Scope:scope}" -o table
```

**Expected:** At least one of:
- `Owner` or `Contributor` at subscription or resource group scope
- `Azure AI Owner` for creating Foundry resources

**If insufficient permissions:**
- Request subscription administrator to:
  1. Assign `Contributor` role, OR
  2. Create a Foundry resource and grant `Azure AI Owner` on that resource
- Alternative: Use an existing Foundry resource (skip to project creation on existing account)
- STOP and inform user to request appropriate permissions

### Prerequisites Summary

| Requirement | Check Command | Resolution |
|-------------|---------------|------------|
| Azure CLI | `az version` | Install from https://aka.ms/installazurecli |
| Azure Account | `az account show` | Create at https://azure.microsoft.com/free/ |
| Active Subscription | `az account list` | Activate or create subscription |
| Default Subscription | `az account set` | Set to desired subscription |
| Sufficient Role | `az role assignment list` | Request Owner/Contributor from admin |
| Azure Developer CLI (azd) | `azd version` | Install from https://aka.ms/azure-dev/install |

### Required Permissions Detail

| Role | Permission Level | Can Create Foundry Resources |
|------|------------------|------------------------------|
| Owner | Full control | ✅ Yes |
| Contributor | Read/Write resources | ✅ Yes |
| Azure AI Owner | AI-specific admin | ✅ Yes |
| Reader | Read-only | ❌ No - request elevated access |

## Step-by-Step Workflow

### Step 1: Check Azure Developer CLI Installation

**Check if azd is installed:**

```bash
azd version
```

**Expected output:** Version number (e.g., `azd version 1.x.x`)

**If NOT installed:**
1. Inform the user they need to install azd
2. Provide installation instructions based on platform:
   - Windows: `winget install microsoft.azd` or `choco install azd`
   - macOS: `brew install azure-developer-cli`
   - Linux: `curl -fsSL https://aka.ms/install-azd.sh | bash`
3. Direct them to: https://aka.ms/azure-dev/install
4. STOP and ask them to run the skill again after installation

### Step 2: Verify Azure Login

**Check Azure login status:**

```bash
azd auth login --check-status
```

**If NOT logged in:**

```bash
azd auth login
```

This will open a browser for authentication. Inform the user to complete the authentication flow.

### Step 3: Ask User for Project Details

**Ask these questions using AskUserQuestion:**

1. **What name should we use for the new Foundry project?**
   - Used as the azd environment name
   - Used for resource group naming: `rg-<project-name>`
   - **IMPORTANT:** Name must contain only alphanumeric characters and hyphens
   - No spaces, underscores, or special characters
   - Examples: "my-ai-project", "customer-support-prod", "dev-agents"

2. **What Azure location should be used?** (Optional - defaults to North Central US)
   - North Central US is recommended (required for hosted agents preview)
   - Other locations available for non-agent Foundry resources

### Step 4: Create Project Directory

**Create an empty directory for the azd project:**

```bash
PROJECT_NAME="<user-provided-name>"
mkdir "$PROJECT_NAME"
cd "$PROJECT_NAME"
pwd
```

**Verify directory is empty:**

```bash
ls -la
# Should show empty directory (only . and ..)
```

**IMPORTANT:** `azd init` requires an empty directory.

### Step 5: Initialize the Foundry Project

**Initialize with the AI starter template:**

```bash
azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic -e <project-name> --no-prompt
```

Replace `<project-name>` with the user's answer from Step 3.

**Example:**
```bash
azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic -e my-ai-project --no-prompt
```

**What the flags do:**
- `-t`: Use the Azure AI starter template (includes Foundry infrastructure)
- `-e <project-name>`: Set the environment name
- `--no-prompt`: Use defaults without interactive prompts

**What this creates:**
- `azure.yaml` - Deployment configuration
- `.azure/` - azd state directory
- `infra/` - Bicep infrastructure templates

### Step 6: Configure Location (If Not Default)

**If user specified a location other than North Central US:**

```bash
azd config set defaults.location <location>
```

**Example:**
```bash
azd config set defaults.location eastus2
```

**Note:** For hosted agents (preview), North Central US is required.

### Step 7: Provision Infrastructure

**Run the provisioning command:**

```bash
azd provision --no-prompt
```

**What the `--no-prompt` flag does:**
- Proceeds with provisioning without asking for confirmation
- Uses values from azure.yaml and environment configuration

**What this command does:**
1. Creates resource group: `rg-<project-name>`
2. Provisions Azure AI Foundry account
3. Creates Foundry project
4. Sets up Container Registry
5. Configures Application Insights
6. Creates managed identity
7. Assigns RBAC permissions

**This process may take 5-10 minutes.**

**Monitor the output for:**
- ✅ Resource group creation
- ✅ Foundry account provisioning
- ✅ Project creation
- ✅ Supporting resources
- ⚠️ Any errors or warnings

### Step 8: Retrieve Project Information

**After successful provisioning, get the project details:**

```bash
azd env get-values
```

**Look for and capture:**
- `AZURE_AI_PROJECT_ID` - The project resource ID
- `AZURE_AI_PROJECT_ENDPOINT` - The project endpoint URL
- `AZURE_RESOURCE_GROUP` - The resource group name

**Store the project resource ID for agent deployments:**

The project ID format is:
```
/subscriptions/{subscription-id}/resourceGroups/{resource-group}/providers/Microsoft.CognitiveServices/accounts/{account}/projects/{project}
```

### Step 9: Verify Project in Azure Portal

**Direct the user to verify the project:**

1. Go to Azure AI Foundry portal: https://ai.azure.com
2. Sign in with the same Azure account
3. Navigate to "Projects"
4. Verify the new project appears
5. Note the project endpoint for future use

### Step 10: Provide Next Steps

**Inform the user of the completed setup:**

```
✅ Azure AI Foundry project created successfully!

Project Details:
- Project Name: <project-name>
- Resource Group: rg-<project-name>
- Project ID: <full-resource-id>
- Endpoint: <project-endpoint>

Next Steps:
1. To deploy an agent, use the `agent/deploy` skill with your project ID
2. To browse models, use `foundry_models_list` MCP tool
3. To manage the project, visit https://ai.azure.com

Save the Project ID for agent deployments:
<project-resource-id>
```

## Troubleshooting

### azd command not found
**Problem:** `azd: command not found`
- **Solution:** Install Azure Developer CLI (see Step 1)
- **Verify:** Run `azd version` after installation

### Authentication failures
**Problem:** `ERROR: Failed to authenticate`
- **Solution:** Run `azd auth login` and complete browser authentication
- **Solution:** Verify Azure subscription access: `az account list`
- **Solution:** Ensure you have Contributor permissions

### Invalid project name
**Problem:** `environment name '' is invalid`
- **Solution:** Name must contain only alphanumeric characters and hyphens
- **Valid format:** "my-project", "agent-prod", "dev123"
- **Invalid format:** "my project", "my_project", "project@123"

### Permission denied
**Problem:** `ERROR: Insufficient permissions`
- **Solution:** Verify you have Contributor role on subscription
- **Solution:** Request Azure AI Owner role from admin
- **Check:** `az role assignment list --assignee <your-email>`

### Region not supported
**Problem:** `Region not supported for hosted agents`
- **Solution:** Use North Central US for hosted agents (preview)
- **Solution:** Set location: `azd config set defaults.location northcentralus`

### Provisioning timeout
**Problem:** Provisioning takes too long or times out
- **Solution:** Check Azure region availability
- **Solution:** Verify network connectivity
- **Solution:** Retry: `azd provision` (safe to re-run)

## Resource Naming Convention

Resources are named based on your project name:

| Resource Type | Naming Pattern | Example |
|---------------|----------------|---------|
| Resource Group | `rg-<project-name>` | `rg-my-ai-project` |
| Foundry Account | `ai-<project-name>` | `ai-my-ai-project` |
| Project | `<project-name>` | `my-ai-project` |
| Container Registry | `cr<project-name>` | `crmyaiproject` |

## Cost Considerations

Creating a Foundry project incurs costs for:
- **Azure AI Foundry** - Base platform costs
- **Container Registry** - Storage for container images
- **Application Insights** - Log storage and queries

**Tip:** Delete unused projects with `azd down` to avoid ongoing costs.

## Deleting the Project

To remove all created resources:

```bash
cd <project-directory>
azd down
```

**Warning:** This deletes ALL resources including:
- Foundry account and project
- All deployed agents and models
- Container Registry and images
- Application Insights data

## Related Skills

- **agent/deploy** - Deploy agents to the created project
- **agent/create** - Create a new agent for deployment

## Additional Resources

- **Azure Developer CLI:** https://aka.ms/azure-dev/install
- **Azure AI Foundry Portal:** https://ai.azure.com
- **Foundry Documentation:** https://learn.microsoft.com/azure/ai-foundry/
- **azd-ai-starter-basic template:** https://github.com/Azure-Samples/azd-ai-starter-basic

## Success Indicators

The project creation is successful when:
- ✅ `azd provision` completes without errors
- ✅ Project appears in Azure AI Foundry portal
- ✅ `azd env get-values` shows project ID and endpoint
- ✅ Resource group contains expected resources
