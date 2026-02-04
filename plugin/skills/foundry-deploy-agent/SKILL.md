---
name: foundry-deploy-agent
description: Deploy a Python agent-framework agent to Azure AI Foundry using Azure Developer CLI
allowed-tools: Read, Write, Bash, AskUserQuestion
---

# Deploy Agent to Azure AI Foundry

This skill guides you through deploying a **Python-based agent-framework agent** to Azure AI Foundry as a hosted, managed service using the Azure Developer CLI (azd).

## Overview

### What This Skill Does

This skill automates the deployment of agent-framework agents to Azure AI Foundry by:
- Verifying prerequisites (azd and ai agent extension)
- Initializing the agent deployment configuration
- Provisioning Azure infrastructure (if needed)
- Building and deploying the agent container
- Providing post-deployment testing instructions

### What Are Hosted Agents?

Hosted agents are containerized agentic AI applications that run on Azure AI Foundry's Agent Service as managed, scalable services. The platform handles:
- Container orchestration and autoscaling
- Identity management and security
- Integration with Azure OpenAI models
- Built-in observability and monitoring
- Conversation state management

## Prerequisites

Before using this skill, ensure you have:
- An agent created with `/create-agent-framework-agent` skill (or manually created)
- Azure subscription with appropriate permissions
- Azure AI Foundry project (or permissions to create one)
- Agent files: `main.py`, `requirements.txt`, `agent.yaml`, `Dockerfile`, `README.md`

## Step-by-Step Workflow

### Step 1: Find Agent Files

**Automatically search for agent files in the current directory:**

```bash
# Check current directory for agent files
pwd
ls -la
```

**Look for these required files in the current directory:**
- `main.py` - Agent implementation
- `requirements.txt` - Python dependencies
- `agent.yaml` - Azure deployment configuration
- `Dockerfile` - Container configuration

**Decision logic:**

1. **If ALL required files are found in current directory:**
   - Set `agent_directory` to current directory (`.` or `pwd` result)
   - Inform user: "Found agent files in current directory"
   - Proceed to Step 2

2. **If files are NOT found in current directory:**
   - Check common subdirectories for agent files:
   ```bash
   # Look for agent.yaml in subdirectories (good indicator of agent directory)
   find . -maxdepth 2 -name "agent.yaml" -type f 2>/dev/null
   ```

   - **If found in a subdirectory:**
     - Extract the directory path
     - Verify all required files exist in that directory:
     ```bash
     # Verify files in discovered directory
     ls -la <discovered-directory>/main.py <discovered-directory>/requirements.txt <discovered-directory>/agent.yaml <discovered-directory>/Dockerfile 2>/dev/null
     ```
     - If all files present, set `agent_directory` to that path
     - Inform user: "Found agent files in <discovered-directory>"
     - Proceed to Step 2

   - **If NOT found anywhere:**
     - Use AskUserQuestion to ask: **"Where is your agent directory?"** (path to agent files)
     - Verify files exist at provided path
     - If files missing, STOP and inform user they need to create the agent first

**Required files check:**
After determining the agent directory, verify all required files:
```bash
cd <agent_directory>
test -f main.py && test -f requirements.txt && test -f agent.yaml && test -f Dockerfile && echo "All files present" || echo "Missing files"
```

**If any required files are missing:**
- List which files are missing
- STOP and inform the user: "Missing required files: [list]. Please use /create-agent-framework-agent to create a complete agent."

### Step 2: Ask User for Deployment Details

**Ask ONLY these essential questions using AskUserQuestion:**

1. **Do you have an existing Azure AI Foundry project?** (Yes/No)
2. **If YES:** What is your Foundry project resource ID? (Format: `/subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/projects/{project}`)
3. **If NO:** What name should we use for the new project environment? (Used as environment name for azd, e.g., "customer-support-prod")
   - **IMPORTANT:** Name must contain only alphanumeric characters and hyphens
   - No spaces, underscores, or special characters
   - Examples: "my-agent", "customer-support-prod", "agent123"

**That's it! We'll use `--no-prompt` flags with azd commands to use sensible defaults for everything else:**
- Azure subscription: First available subscription
- Azure location: North Central US (required for preview)
- Model deployment: gpt-4o-mini
- Container resources: 2Gi memory, 1 CPU
- Replicas: Min 1, Max 3

**Do NOT ask:**
- ❌ Agent directory path (already found in Step 1)
- ❌ Azure subscription, location, model name, container resources (using defaults via --no-prompt)
- ❌ Whether they've tested locally (assume they have or are willing to deploy anyway)

**Do NOT proceed without clear answers to the above questions.**

### Step 3: Check Azure Developer CLI Installation

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

### Step 4: Check Azure Developer CLI ai agent Extension

**Check if the ai agent extension is installed:**

```bash
azd ext list
```

**Expected output:** Should include `ai agent` extension in the list

**If NOT installed:**
1. The extension is typically installed automatically when using the Foundry starter template
2. Inform the user that the extension may be automatically installed during `azd ai agent init`
3. If issues arise, direct them to run: `azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic`

### Step 5: Verify Azure Login

**Check Azure login status:**

```bash
azd auth login --check-status
```

**If NOT logged in:**

```bash
azd auth login
```

This will open a browser for authentication. Inform the user to complete the authentication flow.

### Step 6: Create Deployment Directory

**IMPORTANT:** `azd init` requires an EMPTY directory. Create a new deployment directory.

**Extract agent name from agent.yaml:**

```bash
# Read agent name from agent.yaml (found in Step 1)
cd <agent_directory>
AGENT_NAME=$(grep "^name:" agent.yaml | head -1 | sed 's/name: *//' | tr -d ' ')
echo "Agent name: $AGENT_NAME"

# Get absolute path to agent.yaml for use in azd ai agent init
AGENT_YAML_PATH=$(pwd)/agent.yaml
echo "Agent YAML path: $AGENT_YAML_PATH"
```

**Create empty deployment directory:**

```bash
# Navigate to parent directory of agent directory
cd ..

# Create empty deployment directory
DEPLOYMENT_DIR="${AGENT_NAME}-deployment"
mkdir "$DEPLOYMENT_DIR"
echo "Created empty deployment directory: $DEPLOYMENT_DIR"
```

**Important:** Do NOT copy files manually. The `azd ai agent init` command will automatically copy files from the agent directory to a `src/` subdirectory in the deployment folder.

**Store paths for later steps:**
```bash
DEPLOYMENT_DIRECTORY="$DEPLOYMENT_DIR"
AGENT_YAML_PATH="<absolute-path-to-agent.yaml>"
```

### Step 7: Navigate to Deployment Directory

**Change to the empty deployment directory:**

```bash
cd "$DEPLOYMENT_DIRECTORY"
pwd
```

**Verify directory is empty (ready for azd init):**

```bash
ls -la
# Should show empty directory (only . and ..)
```

### Step 8: Inform User About Non-Interactive Deployment

**Inform the user that the deployment will run non-interactively:**

```
The azd commands will be run with --no-prompt flags to use sensible defaults:
- Azure subscription: First available subscription (or you'll need to set with `azd config set defaults.subscription`)
- Azure location: North Central US (required for preview)
- Model deployment: gpt-4o-mini
- Container resources: 2Gi memory, 1 CPU, min 1 replica, max 3 replicas

The deployment will proceed automatically without asking questions.
```

**If the user wants different values:**
- They can modify the generated `azure.yaml` file after initialization and before running `azd up`
- Or they can set defaults: `azd config set defaults.location northcentralus`

### Step 9: Initialize the Agent Deployment

**Two scenarios:**

#### Scenario A: Existing Foundry Project

If the user has an existing Foundry project, run:

```bash
azd ai agent init --project-id "<project-resource-id>" -m <path-to-agent-yaml> --no-prompt
```

Replace:
- `<project-resource-id>` with the user's Foundry project resource ID (from Step 2)
- `<path-to-agent-yaml>` with the absolute path stored in Step 6 (e.g., `../customer-support-agent/agent.yaml`)

**Example:**
```bash
azd ai agent init --project-id "/subscriptions/abc123.../projects/my-project" -m ../customer-support-agent/agent.yaml --no-prompt
```

**What the `--no-prompt` flag does:**
- Uses default values for all configuration (no interactive prompts)
- Model: gpt-4o-mini
- Container resources: 2Gi memory, 1 CPU
- Replicas: min 1, max 3

**What this does:**
- Reads the agent.yaml from the original agent directory
- Copies agent files (main.py, requirements.txt, Dockerfile, etc.) to `src/` subdirectory in deployment folder
- Registers the agent in the existing Foundry project
- Creates `azure.yaml` configuration in the deployment directory
- Provisions only additional resources needed (e.g., Container Registry if missing)

**Note:** This command can work in an empty directory - it will populate it with the agent files and configuration.

#### Scenario B: New Foundry Project

If the user needs a new Foundry project, first initialize the deployment template:

```bash
azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic -e <environment-name> --no-prompt
```

Replace `<environment-name>` with the user's answer from Step 2, question 3 (e.g., "customer-support-prod")

**Example:**
```bash
azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic -e customer-support-prod --no-prompt
```

**IMPORTANT:** This command REQUIRES the current directory to be empty.

**What the flags do:**
- `-e <environment-name>`: Provides the environment name upfront
  - Environment name is used for resource group naming: `rg-<environment-name>`
  - Must contain only alphanumeric characters and hyphens
- `--no-prompt`: Uses default values for all other configuration
  - Azure subscription: First available or default subscription
  - Azure location: Default location (can set with `azd config set defaults.location northcentralus`)

After initialization completes, run:

```bash
azd ai agent init -m <path-to-agent-yaml> --no-prompt
```

Replace `<path-to-agent-yaml>` with the absolute path stored in Step 6 (e.g., `../customer-support-agent/agent.yaml`)

**Example:**
```bash
azd ai agent init -m ../customer-support-agent/agent.yaml --no-prompt
```

**What the `--no-prompt` flag does:**
- Uses default values for all configuration (no interactive prompts)
- Model: gpt-4o-mini
- Container resources: 2Gi memory, 1 CPU
- Replicas: min 1, max 3

**What this does:**
- Reads the agent.yaml from the original agent directory
- Copies agent files (main.py, requirements.txt, Dockerfile, etc.) to `src/` subdirectory in deployment folder
- Registers the agent in azure.yaml under services
- Provisions all required Azure infrastructure on next `azd up`:
  - Foundry account and project
  - Container Registry
  - Application Insights
  - Managed identity
  - RBAC permissions

### Step 10: Review Configuration and Verify File Structure

**After initialization, verify the deployment directory structure:**

```bash
ls -la
# Should show: azure.yaml, .azure/, infra/, src/

ls -la src/
# Should show: main.py, requirements.txt, agent.yaml, Dockerfile
```

**The `azd ai agent init` command has:**
- Copied agent files from original directory to `src/` subdirectory
- Created `azure.yaml` configuration
- Set up `.azure/` directory for azd state
- Generated `infra/` directory with Bicep templates (if using starter template)

**Review the generated configuration:**

```bash
cat azure.yaml
```

**Verify:**
- Agent is registered under `services`
- Service path points to `src/` directory (where agent files are)
- Environment variables are correctly configured
- Resource locations are appropriate

**Example azure.yaml structure:**
```yaml
services:
  customer-support-agent:
    project: src
    host: containerapp
    language: python
```

**If the user needs to make changes:**
- Open azure.yaml in editor: `code azure.yaml` or `nano azure.yaml`
- Make necessary adjustments
- Save and continue

### Step 11: Deploy the Agent

**Run the deployment command:**

```bash
azd up --no-prompt
```

**What the `--no-prompt` flag does:**
- Proceeds with deployment without asking for confirmation
- Uses values from azure.yaml and environment configuration

**What this command does:**
1. `azd infra generate` - Generates infrastructure-as-code (Bicep)
2. `azd provision` - Provisions Azure resources
3. `azd deploy` - Builds container, pushes to ACR, deploys to Agent Service
4. Creates a hosted agent version and deployment

**This process may take 5-15 minutes.**

**Monitor the output for:**
- ✅ Infrastructure provisioning status
- ✅ Container build progress
- ✅ Deployment success
- ⚠️ Any errors or warnings

**If errors occur, capture the full error message and provide troubleshooting guidance (see Step 11).**

### Step 12: Retrieve Deployment Information

**After successful deployment, get the agent endpoint:**

```bash
azd env get-values
```

**Look for:**
- Agent endpoint URL
- Agent name
- Deployment status

**Alternative: Check via Azure portal**
1. Navigate to Azure AI Foundry portal: https://ai.azure.com
2. Go to your project
3. Navigate to "Agents" section
4. Find your deployed agent
5. Note the endpoint URL and deployment status

### Step 13: Test the Deployed Agent

**Provide the user with testing instructions:**

**Option A: Test via REST API**

```bash
curl -X POST https://<agent-endpoint>/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv)" \
  -d '{
    "input": {
      "messages": [
        {
          "role": "user",
          "content": "Test message"
        }
      ]
    }
  }'
```

**Option B: Test via Azure AI Foundry portal**
1. Go to https://ai.azure.com
2. Navigate to your project
3. Open the "Agents" section
4. Select your agent
5. Use the built-in chat interface to test

**Option C: Test via Foundry SDK**
Provide sample Python code:

```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

client = AIProjectClient(
    project_endpoint="<your-project-endpoint>",
    credential=DefaultAzureCredential()
)

response = client.agents.invoke(
    agent_name="<your-agent-name>",
    messages=[
        {"role": "user", "content": "Test message"}
    ]
)

print(response)
```

### Step 14: Monitor and Manage the Deployment

**Provide management commands:**

**View deployment status:**
```bash
azd env get-values
```

**View logs (via Azure portal):**
1. Go to Azure portal
2. Navigate to Application Insights resource
3. View logs and traces

**Update the agent (after code changes):**
```bash
azd deploy
```

**Create a new version:**
```bash
azd up
```

**Stop the agent:**
- Use Azure portal or Foundry SDK to stop the deployment

**Delete the agent:**
```bash
azd down
```

**Note:** `azd down` removes ALL provisioned resources including the Foundry project if it was created by azd.

## Required RBAC Permissions

### For Existing Foundry Project with Configured Resources:
- **Reader** on the Foundry account
- **Azure AI User** on the project

### For Existing Project (Creating Model Deployments and Container Registry):
- **Azure AI Owner** on Foundry
- **Contributor** on the Azure subscription

### For Creating New Foundry Project:
- **Azure AI Owner** role
- **Contributor** on the Azure subscription

**If deployment fails due to permissions:**
1. Check user's current roles: `az role assignment list --assignee <user-email>`
2. Direct user to Azure portal to request appropriate roles
3. Documentation: https://learn.microsoft.com/azure/ai-services/openai/how-to/role-based-access-control

## Troubleshooting

### azd command not found
**Problem:** `azd: command not found`
- **Solution:** Install Azure Developer CLI (see Step 3)
- **Verify:** Run `azd version` after installation

### Authentication failures
**Problem:** `ERROR: Failed to authenticate`
- **Solution:** Run `azd auth login` and complete browser authentication
- **Solution:** Verify Azure subscription access: `az account list`
- **Solution:** Ensure you have appropriate RBAC permissions

### Invalid environment name
**Problem:** `environment name '' is invalid (it should contain only alphanumeric characters and hyphens)`
- **Solution:** When `azd init` prompts for environment name, enter a valid name
- **Valid format:** Only letters, numbers, and hyphens (no spaces, underscores, or special characters)
- **Examples:** "my-agent", "customer-support-prod", "agent123"
- **Solution:** If you entered an invalid name, the prompt will repeat - enter a valid name
- **Note:** This is the first question `azd init` asks - see Step 8 for the prepared answer

### Extension not found
**Problem:** `ai agent extension not found`
- **Solution:** Initialize with template: `azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic`
- **Solution:** Check extensions: `azd ext list`

### Deployment region errors
**Problem:** `Region not supported`
- **Solution:** Hosted agents (preview) only available in North Central US
- **Solution:** Use `--location northcentralus` flag or select region during initialization

### Container build failures
**Problem:** Docker build fails during deployment
- **Solution:** Test Docker build locally first: `docker build -t agent-test .`
- **Solution:** Verify Dockerfile syntax and base image availability
- **Solution:** Check requirements.txt for invalid packages

### Permission denied errors
**Problem:** `ERROR: Insufficient permissions`
- **Solution:** Verify RBAC roles (see Required RBAC Permissions section)
- **Solution:** Request Azure AI Owner or Contributor role from admin
- **Solution:** Check subscription access: `az account show`

### Agent won't start
**Problem:** Agent deployment succeeds but agent doesn't start
- **Solution:** Check Application Insights logs for Python errors
- **Solution:** Verify environment variables in agent.yaml are correct
- **Solution:** Test agent locally first: `python main.py` (should run on port 8088)
- **Solution:** Check that main.py calls `from_agent_framework().run()`

### Port 8088 errors
**Problem:** `Port 8088 already in use`
- **Solution:** This is only relevant for local testing
- **Solution:** Stop any local agent processes
- **Solution:** Deployed agents don't have port conflicts (managed by Azure)

### Timeout during deployment
**Problem:** Deployment times out
- **Solution:** Check Azure region availability
- **Solution:** Verify Container Registry is accessible
- **Solution:** Check network connectivity to Azure services
- **Solution:** Retry: `azd up` (safe to re-run)

## Important Notes

### Preview Limitations
- **Region:** North Central US only during preview
- **Networking:** Private networking not supported in standard setup
- **Pricing:** Check Foundry pricing page for preview pricing details

### Security Best Practices
- **Never put secrets in container images or environment variables**
- Use managed identities and Azure Key Vault for secrets
- Grant least privilege RBAC permissions
- Use Key Vault connections for sensitive data
- Review data handling policies for non-Microsoft tools/services

### Agent Lifecycle
Hosted agents follow this lifecycle:
1. **Create** - Initialize with `azd ai agent init`
2. **Start** - Deploy with `azd up` or `azd deploy`
3. **Update** - Modify code and redeploy with `azd deploy`
4. **Stop** - Stop deployment via portal or SDK
5. **Delete** - Remove with `azd down`

### Local Testing Before Deployment
**Always recommend testing locally before deployment:**

1. Run agent locally:
   ```bash
   cd <agent-directory>
   python main.py
   ```

2. Test with curl in separate terminal:
   ```bash
   curl -X POST http://localhost:8088/responses \
     -H "Content-Type: application/json" \
     -d '{
       "input": {
         "messages": [
           {"role": "user", "content": "Test message"}
         ]
       }
     }'
   ```

3. Verify response and fix any issues before deploying

## Summary of Commands

**Prerequisites:**
```bash
azd version              # Check azd installation
azd ext list             # Check extensions
azd auth login           # Login to Azure
```

**Deployment (existing project):**
```bash
cd <agent-directory>
azd ai agent init --project-id "<project-id>" -m agent.yaml
azd up
```

**Deployment (new project):**
```bash
cd <agent-directory>
azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic
azd ai agent init -m agent.yaml
azd up
```

**Management:**
```bash
azd env get-values       # View deployment info
azd deploy               # Update existing deployment
azd down                 # Delete all resources
```

## Best Practices

1. **Test locally first** - Always test with `python main.py` before deploying
2. **Use version control** - Commit code before deployment
3. **Review configuration** - Check `azure.yaml` after initialization
4. **Monitor logs** - Use Application Insights for debugging
5. **Use managed identities** - Avoid hardcoded credentials
6. **Document environment variables** - Keep README.md updated
7. **Test incrementally** - Deploy small changes frequently
8. **Set up CI/CD** - Consider GitHub Actions for automated deployments

## Related Resources

- **Azure Developer CLI:** https://aka.ms/azure-dev/install
- **Foundry Samples:** https://github.com/microsoft-foundry/foundry-samples
- **Azure AI Foundry Portal:** https://ai.azure.com
- **Foundry Documentation:** https://learn.microsoft.com/azure/ai-foundry/
- **RBAC Documentation:** https://learn.microsoft.com/azure/ai-services/openai/how-to/role-based-access-control

## Success Indicators

The deployment is successful when:
- ✅ `azd up` completes without errors
- ✅ Agent appears in Azure AI Foundry portal
- ✅ Agent endpoint returns 200 status on health check
- ✅ Test messages receive appropriate responses
- ✅ Logs appear in Application Insights
- ✅ No error messages in deployment logs

## Next Steps After Deployment

1. **Test thoroughly** - Send various queries to validate behavior
2. **Set up monitoring** - Configure alerts in Application Insights
3. **Document endpoint** - Save endpoint URL and share with team
4. **Plan updates** - Document process for future code changes
5. **Set up CI/CD** - Automate deployments with GitHub Actions
6. **Monitor costs** - Review Azure costs in portal
7. **Collect feedback** - Gather user feedback for improvements
