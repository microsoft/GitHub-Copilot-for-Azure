# Deploy Agent to Foundry - Examples and Scenarios

This file provides **real-world deployment scenarios, examples, and troubleshooting guidance** for deploying agent-framework agents to Azure AI Foundry.

## Table of Contents

1. [Deployment Scenarios](#deployment-scenarios)
2. [Command Examples](#command-examples)
3. [Troubleshooting Scenarios](#troubleshooting-scenarios)
4. [Testing Examples](#testing-examples)
5. [CI/CD Examples](#cicd-examples)

---

## Deployment Scenarios

### Scenario 1: First-Time Deployment with No Infrastructure

**Context:**
- Developer has created an agent using `/create-agent-framework-agent`
- No existing Azure AI Foundry resources
- Has Azure subscription with Contributor role

**Steps:**

1. **Navigate to workspace (agent can be in current directory or subdirectory):**
   ```bash
   cd /workspace
   # Agent is in ./customer-support-agent subdirectory
   ```

2. **Invoke the skill:**
   ```
   /deploy-agent-to-foundry
   ```

3. **Skill automatically finds agent files:**
   ```bash
   # Skill searches for agent.yaml
   find . -maxdepth 2 -name "agent.yaml"
   # -> ./customer-support-agent/agent.yaml

   # Verifies all required files
   cd ./customer-support-agent
   ls -la
   # -> ✅ main.py, requirements.txt, agent.yaml, Dockerfile present
   ```

4. **Answer deployment questions:**
   - Existing Foundry project: **No**
   - New project name: `customer-support-prod`

5. **Skill informs about non-interactive deployment:**
   ```
   The azd commands will use --no-prompt to use sensible defaults:
   - Azure subscription: First available
   - Azure location: North Central US
   - Model: gpt-4o-mini
   - Container: 2Gi memory, 1 CPU, 1-3 replicas
   ```

6. **Skill execution:**
   ```bash
   # Check azd installation
   azd version
   # -> azd version 1.5.0

   # Login to Azure
   azd auth login
   # -> Opens browser for authentication

   # Extract agent name and get path to agent.yaml
   AGENT_NAME=$(grep "^name:" customer-support-agent/agent.yaml | head -1 | sed 's/name: *//')
   # -> customer-support-agent
   AGENT_YAML_PATH=$(pwd)/customer-support-agent/agent.yaml
   # -> /workspace/customer-support-agent/agent.yaml

   # Create empty deployment directory (azd init requires empty directory)
   mkdir customer-support-agent-deployment

   # Navigate to empty deployment directory
   cd customer-support-agent-deployment
   ls -la
   # -> Empty directory (only . and ..)

   # Initialize with template (non-interactive with --no-prompt)
   azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic -e customer-support-prod --no-prompt
   # -> No prompts (uses defaults)
   # -> Creates azure.yaml, .azure/, infra/

   # Initialize agent (copies files from original directory to src/, non-interactive)
   azd ai agent init -m ../customer-support-agent/agent.yaml --no-prompt
   # -> No prompts (uses defaults):
   #    - Model: gpt-4o-mini
   #    - Container: 2Gi memory, 1 CPU
   #    - Replicas: min 1, max 3
   # -> Reads agent.yaml from original directory
   # -> Copies main.py, requirements.txt, agent.yaml, Dockerfile to src/
   # -> Registers agent in azure.yaml

   # Verify files were copied
   ls -la src/
   # -> main.py, requirements.txt, agent.yaml, Dockerfile

   # Deploy everything (non-interactive)
   azd up --no-prompt
   # -> Provisions: Resource Group, Foundry Account, Project, Container Registry, App Insights
   # -> Builds container from src/
   # -> Pushes to ACR
   # -> Deploys to Agent Service
   ```

7. **Result:**
   ```
   ✅ Deployment successful!

   Agent Endpoint: https://customer-support-prod.cognitiveservices.azure.com/agents/customer-support-agent
   Resource Group: rg-customer-support-prod
   Monitoring: Application Insights created

   Test with:
   curl -X POST https://customer-support-prod.cognitiveservices.azure.com/agents/customer-support-agent/responses ...
   ```

**Time:** 10-15 minutes

---

### Scenario 2: Deployment to Existing Foundry Project

**Context:**
- Developer works in an organization with existing Foundry project
- Has project resource ID
- Has Azure AI User role on project

**Steps:**

1. **Navigate to workspace and invoke the skill:**
   ```bash
   cd /workspace  # research-agent is in ./research-agent subdirectory
   /deploy-agent-to-foundry
   ```

2. **Skill automatically finds agent files:**
   ```bash
   # Skill searches and finds agent
   find . -maxdepth 2 -name "agent.yaml"
   # -> ./research-agent/agent.yaml
   # -> ✅ All files present
   ```

3. **Answer deployment questions:**
   - Existing Foundry project: **Yes**
   - Project resource ID: `/subscriptions/abc123.../resourceGroups/rg-foundry/providers/Microsoft.CognitiveServices/accounts/ai-company/projects/research-agents`

4. **Skill informs about non-interactive deployment:**
   ```
   The azd commands will use --no-prompt to use sensible defaults:
   - Model: gpt-4o-mini
   - Container: 2Gi memory, 1 CPU, 1-3 replicas
   ```

5. **Skill execution:**
   ```bash
   # Check azd
   azd version

   # Login
   azd auth login

   # Extract agent name and get path to agent.yaml
   AGENT_NAME=$(grep "^name:" research-agent/agent.yaml | head -1 | sed 's/name: *//')
   # -> research-agent
   AGENT_YAML_PATH=$(pwd)/research-agent/agent.yaml
   # -> /workspace/research-agent/agent.yaml

   # Create empty deployment directory
   mkdir research-agent-deployment

   # Navigate to empty deployment directory
   cd research-agent-deployment
   ls -la
   # -> Empty directory

   # Initialize with existing project (non-interactive)
   azd ai agent init --project-id "/subscriptions/abc123.../projects/research-agents" -m ../research-agent/agent.yaml --no-prompt
   # -> No prompts (uses defaults):
   #    - Model: gpt-4o-mini
   #    - Container: 2Gi memory, 1 CPU
   #    - Replicas: min 1, max 3
   # -> Connects to existing project
   # -> Copies main.py, requirements.txt, agent.yaml, Dockerfile to src/
   # -> Creates azure.yaml
   # -> Provisions only missing resources (e.g., ACR if needed)

   # Verify files were copied
   ls -la src/
   # -> main.py, requirements.txt, agent.yaml, Dockerfile

   # Deploy (non-interactive)
   azd up --no-prompt
   # -> Builds container from src/
   # -> Deploys to existing project
   ```

6. **Result:**
   ```
   ✅ Deployment successful!

   Agent: research-agent
   Project: research-agents (existing)

   Test via Azure AI Foundry portal: https://ai.azure.com
   ```

**Time:** 5-10 minutes

---

### Scenario 3: Update Existing Deployed Agent

**Context:**
- Agent already deployed
- Developer made code changes to main.py
- Wants to deploy updated version

**Steps:**

1. **Make code changes in original directory:**
   ```bash
   cd ./customer-support-agent
   # Edit main.py - Updated system prompt
   # agent = ChatAgent(
   #     chat_client=chat_client,
   #     name="CustomerSupportAgent",
   #     instructions="You are an expert customer support agent. [NEW INSTRUCTIONS]",
   #     tools=web_search_tool,
   # )
   ```

2. **Test locally:**
   ```bash
   python main.py
   # Test on localhost:8088
   ```

3. **Copy changes to deployment src/ directory:**
   ```bash
   # Copy updated file to deployment src/
   cp ./customer-support-agent/main.py ./customer-support-agent-deployment/src/
   ```

   **Alternative:** Re-run `azd ai agent init` to sync all files:
   ```bash
   cd ./customer-support-agent-deployment
   azd ai agent init -m ../customer-support-agent/agent.yaml
   # -> Updates src/ with all files from original directory
   ```

4. **Deploy updated code:**
   ```bash
   cd ./customer-support-agent-deployment

   # Deploy updated code (doesn't re-provision infrastructure)
   azd deploy
   # -> Builds new container from src/ with updated code
   # -> Pushes to ACR
   # -> Updates deployment
   ```

5. **Result:**
   ```
   ✅ Update deployed!

   New version: v1.1.0
   Endpoint: [same as before]
   Changes: Updated system instructions
   ```

**Time:** 3-5 minutes

**Note:** For updates, you can either manually copy changed files to `src/` or re-run `azd ai agent init -m <path>` to sync all files.

---

### Scenario 4: Multi-Agent Deployment

**Context:**
- Organization wants to deploy multiple agents
- Share same Foundry project
- Different capabilities (support, research, data analysis)

**Steps:**

1. **Deploy first agent:**
   ```bash
   cd ./customer-support-agent
   azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic
   azd ai agent init -m agent.yaml
   azd up
   # -> Creates project: multi-agent-project
   ```

2. **Deploy second agent to same project:**
   ```bash
   cd ../research-agent
   azd ai agent init --project-id "/subscriptions/.../projects/multi-agent-project" -m agent.yaml
   azd up
   # -> Uses existing project
   # -> Adds second agent
   ```

3. **Deploy third agent:**
   ```bash
   cd ../data-analysis-agent
   azd ai agent init --project-id "/subscriptions/.../projects/multi-agent-project" -m agent.yaml
   azd up
   ```

4. **Result:**
   ```
   Project: multi-agent-project
   Agents:
   - customer-support-agent
   - research-agent
   - data-analysis-agent

   All accessible via same Foundry project
   ```

---

## Command Examples

### Check Prerequisites

**Check azd installation:**
```bash
azd version
# Expected: azd version 1.5.0 (or later)
```

**Check extensions:**
```bash
azd ext list
# Expected: ai agent extension in list
```

**Check Azure login:**
```bash
azd auth login --check-status
# Expected: Logged in as user@example.com
```

**List subscriptions:**
```bash
az account list --output table
# Shows available subscriptions
```

---

### Deployment Commands

**Initialize new project:**
```bash
cd agent-directory
azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic
# Prompts:
# - Environment name: my-agent-prod
# - Subscription: [select from list]
# - Location: North Central US
```

**Initialize agent with existing project:**
```bash
azd ai agent init --project-id "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/projects/{project}" -m agent.yaml
```

**Deploy everything (provision + deploy):**
```bash
azd up
```

**Deploy code only (no provisioning):**
```bash
azd deploy
```

**View deployment info:**
```bash
azd env get-values
# Shows endpoint, resources, etc.
```

**Delete everything:**
```bash
azd down
# WARNING: Deletes ALL resources including Foundry project!
```

---

### Management Commands

**View environment variables:**
```bash
azd env list
azd env get-values
```

**View logs (via Azure CLI):**
```bash
az monitor app-insights query \
  --resource-group rg-my-agent \
  --app my-agent-insights \
  --analytics-query "traces | where message contains 'error' | take 10"
```

**Check agent status (via portal):**
```bash
# Open browser to:
https://ai.azure.com
# Navigate to project -> Agents -> [your-agent]
```

---

## Troubleshooting Scenarios

### Problem: azd not found

**Symptoms:**
```bash
$ azd version
bash: azd: command not found
```

**Solution:**

**Windows:**
```powershell
winget install microsoft.azd
# or
choco install azd
```

**macOS:**
```bash
brew install azure-developer-cli
```

**Linux:**
```bash
curl -fsSL https://aka.ms/install-azd.sh | bash
```

**Verify:**
```bash
azd version
# -> azd version 1.5.0
```

---

### Problem: Authentication Failed

**Symptoms:**
```bash
$ azd up
ERROR: Failed to authenticate to Azure
```

**Solution:**
```bash
# Login to Azure
azd auth login
# -> Opens browser for authentication

# Verify login
azd auth login --check-status
# -> Logged in as: user@example.com

# If still failing, try Azure CLI
az login
az account show
```

---

### Problem: Insufficient Permissions

**Symptoms:**
```bash
$ azd up
ERROR: Insufficient permissions to create resource group
ERROR: Missing role: Contributor
```

**Solution:**

1. **Check current roles:**
   ```bash
   az role assignment list --assignee user@example.com --output table
   ```

2. **Request required roles:**
   - **For new project:** Azure AI Owner + Contributor
   - **For existing project:** Azure AI User + Reader

3. **Contact Azure admin to grant roles:**
   ```bash
   # Admin runs:
   az role assignment create \
     --assignee user@example.com \
     --role "Azure AI Developer" \
     --scope "/subscriptions/{sub-id}"
   ```

4. **Retry deployment:**
   ```bash
   azd up
   ```

---

### Problem: Region Not Supported

**Symptoms:**
```bash
$ azd up
ERROR: Hosted agents not available in region 'eastus'
```

**Solution:**

Hosted agents (preview) only available in **North Central US**:

```bash
# Re-initialize with correct region
azd init -t https://github.com/Azure-Samples/azd-ai-starter-basic
# When prompted, select: North Central US

# Or set environment variable
azd env set AZURE_LOCATION northcentralus

# Retry
azd up
```

---

### Problem: Container Build Fails

**Symptoms:**
```bash
$ azd up
...
ERROR: Docker build failed
ERROR: Could not install azure-ai-agentserver-agentframework
```

**Solution:**

1. **Test Docker build locally:**
   ```bash
   cd agent-directory
   docker build -t agent-test .
   # Check for errors
   ```

2. **Check Dockerfile:**
   ```dockerfile
   FROM python:3.12-slim  # ✅ Correct base image

   WORKDIR /app

   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt

   COPY main.py .

   EXPOSE 8088

   CMD ["python", "main.py"]
   ```

3. **Verify requirements.txt:**
   ```
   azure-ai-agentserver-agentframework>=1.0.0b9
   python-dotenv>=1.0.0
   # No typos or invalid versions
   ```

4. **Rebuild and retry:**
   ```bash
   azd deploy
   ```

---

### Problem: Agent Won't Start

**Symptoms:**
```bash
$ azd up
✅ Deployment successful

# But agent shows "Unhealthy" in portal
```

**Solution:**

1. **Check Application Insights logs:**
   ```bash
   # Go to Azure portal
   # Navigate to Application Insights resource
   # View "Failures" or "Logs"
   # Look for Python exceptions
   ```

2. **Common issues:**

   **Missing environment variable:**
   ```python
   # Error in logs:
   KeyError: 'AZURE_AI_PROJECT_ENDPOINT'

   # Fix: Check agent.yaml has:
   environment_variables:
     - name: AZURE_AI_PROJECT_ENDPOINT
       value: ${AZURE_AI_PROJECT_ENDPOINT}
   ```

   **Import error:**
   ```python
   # Error in logs:
   ModuleNotFoundError: No module named 'agent_framework'

   # Fix: Add to requirements.txt:
   azure-ai-agentserver-agentframework>=1.0.0b9
   ```

   **Port error:**
   ```python
   # Error in logs:
   Port 8088 must be exposed

   # Fix: Dockerfile must have:
   EXPOSE 8088
   ```

3. **Test locally first:**
   ```bash
   cd agent-directory
   python main.py
   # Should start on localhost:8088
   # Test with curl
   curl http://localhost:8088/health
   ```

4. **Redeploy with fix:**
   ```bash
   azd deploy
   ```

---

### Problem: Timeout During Deployment

**Symptoms:**
```bash
$ azd up
...
Deploying agent... (waiting)
ERROR: Deployment timeout after 30 minutes
```

**Solution:**

1. **Check Azure status:**
   - Visit: https://status.azure.com
   - Check for outages in North Central US

2. **Retry deployment:**
   ```bash
   azd up
   # Safe to re-run, idempotent
   ```

3. **Check container registry:**
   ```bash
   az acr list --output table
   # Verify ACR is accessible

   az acr repository list --name <registry-name>
   # Check images pushed successfully
   ```

4. **Deploy in stages:**
   ```bash
   # Provision infrastructure first
   azd provision

   # Then deploy code
   azd deploy
   ```

---

## Testing Examples

### Test via curl (Linux/macOS/Windows Git Bash)

```bash
# Get access token
TOKEN=$(az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv)

# Send test request
curl -X POST "https://your-project.cognitiveservices.azure.com/agents/your-agent/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "input": {
      "messages": [
        {
          "role": "user",
          "content": "What is Azure AI Foundry?"
        }
      ]
    }
  }'
```

### Test via PowerShell (Windows)

```powershell
# Get access token
$token = az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv

# Create request body
$body = @{
    input = @{
        messages = @(
            @{
                role = "user"
                content = "What is Azure AI Foundry?"
            }
        )
    }
} | ConvertTo-Json -Depth 10

# Send request
Invoke-RestMethod `
    -Uri "https://your-project.cognitiveservices.azure.com/agents/your-agent/responses" `
    -Method Post `
    -Headers @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $token"
    } `
    -Body $body
```

### Test via Python SDK

```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

# Initialize client
client = AIProjectClient(
    project_endpoint="https://your-project.cognitiveservices.azure.com",
    credential=DefaultAzureCredential()
)

# Send message
response = client.agents.invoke(
    agent_name="your-agent",
    messages=[
        {"role": "user", "content": "What is Azure AI Foundry?"}
    ]
)

print(response)
```

### Test with Streaming

```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

client = AIProjectClient(
    project_endpoint="https://your-project.cognitiveservices.azure.com",
    credential=DefaultAzureCredential()
)

# Stream response
stream = client.agents.invoke_stream(
    agent_name="your-agent",
    messages=[
        {"role": "user", "content": "Tell me a story"}
    ]
)

for chunk in stream:
    if chunk.content:
        print(chunk.content, end="", flush=True)
```

---

## CI/CD Examples

### GitHub Actions

```yaml
name: Deploy Agent to Foundry
on:
  push:
    branches: [main]
    paths:
      - 'agent/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install Azure Developer CLI
        run: |
          curl -fsSL https://aka.ms/install-azd.sh | bash

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Deploy Agent
        run: |
          cd agent
          azd auth login --client-id ${{ secrets.AZURE_CLIENT_ID }} \
                         --client-secret ${{ secrets.AZURE_CLIENT_SECRET }} \
                         --tenant-id ${{ secrets.AZURE_TENANT_ID }}
          azd deploy
        env:
          AZURE_ENV_NAME: ${{ secrets.AZURE_ENV_NAME }}
```

### Azure DevOps Pipeline

```yaml
trigger:
  branches:
    include:
      - main
  paths:
    include:
      - agent/*

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: AzureCLI@2
  displayName: 'Install Azure Developer CLI'
  inputs:
    azureSubscription: 'AzureServiceConnection'
    scriptType: 'bash'
    scriptLocation: 'inlineScript'
    inlineScript: |
      curl -fsSL https://aka.ms/install-azd.sh | bash

- task: AzureCLI@2
  displayName: 'Deploy Agent'
  inputs:
    azureSubscription: 'AzureServiceConnection'
    scriptType: 'bash'
    scriptLocation: 'inlineScript'
    inlineScript: |
      cd agent
      azd deploy
  env:
    AZURE_ENV_NAME: $(AZURE_ENV_NAME)
```

---

## Monitoring and Observability

### View Logs in Application Insights

```bash
# Query recent errors
az monitor app-insights query \
  --resource-group rg-my-agent \
  --app my-agent-insights \
  --analytics-query "
    traces
    | where severityLevel >= 3
    | where timestamp > ago(1h)
    | project timestamp, message, severityLevel
    | order by timestamp desc
    | take 50
  "
```

### Set Up Alerts

```bash
# Create alert for agent failures
az monitor metrics alert create \
  --name agent-failure-alert \
  --resource-group rg-my-agent \
  --scopes "/subscriptions/{sub}/resourceGroups/rg-my-agent/providers/..." \
  --condition "avg exceptions/count > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action email user@example.com
```

---

## Best Practices Summary

1. **Always test locally first** - Run `python main.py` before deploying
2. **Use version control** - Commit code before deployment
3. **Deploy incrementally** - Start with basic functionality, add features gradually
4. **Monitor from day one** - Set up Application Insights alerts immediately
5. **Document endpoints** - Share agent URLs and authentication with team
6. **Plan for updates** - Have a deployment strategy for code changes
7. **Test in dev first** - Deploy to dev environment before production
8. **Review costs regularly** - Monitor Azure costs in portal
9. **Use managed identities** - Never hardcode credentials
10. **Keep dependencies updated** - Regularly update requirements.txt

---

**Remember:** These examples are meant to guide you through real-world scenarios. Always adapt to your specific requirements and organizational policies.
