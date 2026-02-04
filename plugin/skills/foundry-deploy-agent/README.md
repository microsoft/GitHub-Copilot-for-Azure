# Deploy Agent to Azure AI Foundry Skill

## Overview

This skill helps you deploy **Python-based agent-framework agents** to Azure AI Foundry as hosted, managed services. It automates the entire deployment process using the Azure Developer CLI (azd), from infrastructure provisioning to container deployment.

**Important:** This skill deploys agents to Azure AI Foundry's hosted agent service. It does NOT deploy Claude Code agents - it deploys the Python agents created by the `/create-agent-framework-agent` skill.

## What You'll Accomplish

When you use this skill, you'll:
1. Verify prerequisites (Azure CLI, azd, ai agent extension)
2. Configure deployment settings
3. Provision Azure infrastructure (if needed)
4. Build and push container images
5. Deploy agent as a managed service
6. Get testing instructions and endpoint URLs

## Quick Start

**Prerequisites:**
- An agent directory with: `main.py`, `requirements.txt`, `agent.yaml`, `Dockerfile`
- Azure subscription
- Azure Developer CLI installed (or skill will guide installation)

**Invoke the skill:**
```
/deploy-agent-to-foundry
```

The skill will:
1. Check your environment setup
2. Ask questions about your deployment
3. Guide you through the deployment process
4. Provide testing instructions

## When to Use This Skill

✅ **Use this skill when you need to:**
- Deploy an agent-framework agent to Azure AI Foundry
- Set up a new Foundry project with all required infrastructure
- Deploy an agent to an existing Foundry project
- Update an existing deployed agent
- Troubleshoot deployment issues

❌ **Don't use this skill for:**
- Creating agents (use `/create-agent-framework-agent` instead)
- Deploying to non-Azure platforms
- Deploying Claude Code agents
- Local testing only (just run `python main.py`)

## What Are Hosted Agents?

Hosted agents are containerized AI applications that run on Azure AI Foundry's managed infrastructure. The platform provides:

- **Automatic scaling** - Handles traffic spikes automatically
- **Built-in security** - Managed identities, RBAC, and compliance
- **Observability** - Application Insights integration for logs and metrics
- **State management** - Conversation context and memory persistence
- **Integration** - Seamless connection to Azure OpenAI models and tools

## Deployment Scenarios

### Scenario 1: First-Time Deployment (No Existing Infrastructure)

**What you have:**
- Agent code in a directory
- Azure subscription
- No existing Foundry project

**What the skill does:**
- Installs/verifies azd CLI
- Provisions Foundry account, project, and all resources
- Configures Container Registry and Application Insights
- Sets up managed identity and RBAC
- Builds and deploys agent container
- Provides endpoint and testing instructions

**Time:** ~10-15 minutes

### Scenario 2: Deployment to Existing Foundry Project

**What you have:**
- Agent code in a directory
- Existing Azure AI Foundry project
- Project resource ID

**What the skill does:**
- Verifies azd CLI and extensions
- Connects to existing Foundry project
- Provisions only missing resources (e.g., Container Registry)
- Builds and deploys agent container
- Provides endpoint and testing instructions

**Time:** ~5-10 minutes

### Scenario 3: Updating an Existing Agent

**What you have:**
- Previously deployed agent
- Updated agent code

**What the skill does:**
- Verifies environment
- Rebuilds container with updated code
- Deploys new version
- Preserves existing infrastructure

**Time:** ~3-5 minutes

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Your Development Environment                             │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │ Agent Directory                                  │   │
│  │ ├── main.py                                      │   │
│  │ ├── requirements.txt                             │   │
│  │ ├── agent.yaml                                   │   │
│  │ └── Dockerfile                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                       │                                  │
│                       ▼ azd up                           │
└───────────────────────┼──────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Azure Container Registry                                 │
├─────────────────────────────────────────────────────────┤
│  - Stores container images                               │
│  - Versioned and tagged                                  │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Azure AI Foundry - Agent Service                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │ Hosted Agent (Managed Container)                 │   │
│  │ - Auto-scaling                                   │   │
│  │ - Managed Identity                               │   │
│  │ - Health monitoring                              │   │
│  │ - Conversation management                        │   │
│  └─────────────────────────────────────────────────┘   │
│                       │                                  │
│                       ▼ REST API                         │
└───────────────────────┼──────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Azure OpenAI Service                                     │
├─────────────────────────────────────────────────────────┤
│  - GPT-4, GPT-4o, etc.                                   │
│  - Bing Grounding                                        │
│  - Tools and functions                                   │
└─────────────────────────────────────────────────────────┘
```

## Required Permissions (RBAC)

### For Existing Foundry Project (All Resources Configured):
- **Reader** on Foundry account
- **Azure AI User** on project

### For Existing Project (Creating Resources):
- **Azure AI Owner** on Foundry
- **Contributor** on Azure subscription

### For New Foundry Project:
- **Azure AI Owner** role
- **Contributor** on Azure subscription

**Note:** The skill will detect permission issues and guide you on requesting the correct roles.

## Prerequisites

Before using this skill, ensure you have:

### Required Software
- **Azure CLI** - For Azure authentication
- **Azure Developer CLI (azd)** - For deployment (skill can guide installation)
- **Docker** - For local testing (optional but recommended)
- **Python 3.10+** - For local testing (optional)

### Required Azure Resources
- **Azure subscription** - With appropriate permissions
- **Azure AI Foundry project** - Or permissions to create one

### Required Files
Your agent directory must contain:
- `main.py` - Agent implementation
- `requirements.txt` - Python dependencies
- `agent.yaml` - Deployment configuration
- `Dockerfile` - Container definition
- `.env` (for local testing only, not deployed)

**Tip:** Use `/create-agent-framework-agent` to generate these files automatically.

## Usage Example

```bash
# 1. Navigate to your agent directory (or parent directory)
cd customer-support-agent  # Or stay in parent directory

# 2. Invoke the skill
/deploy-agent-to-foundry

# 3. Skill automatically:
# - Finds agent files in current directory or subdirectories
# - Checks azd installation
# - Logs in to Azure

# 4. Answer deployment questions (example responses):
# - Existing Foundry project: No
# - New project name: customer-support-prod

# 5. Skill informs you about non-interactive deployment:
# The azd commands will use --no-prompt to use sensible defaults:
# - Azure subscription: First available
# - Azure location: North Central US
# - Model: gpt-4o-mini
# - Container: 2Gi memory, 1 CPU, 1-3 replicas

# 6. Skill will execute:
# - Extract agent name from agent.yaml
# - Create empty deployment directory (customer-support-agent-deployment)
# - Navigate to deployment directory
# - Run: azd init -e customer-support-prod --no-prompt (for new projects)
# - Run: azd ai agent init -m ../customer-support-agent/agent.yaml --no-prompt
#   (This automatically copies agent files to src/ subdirectory)
# - Run: azd up --no-prompt
#   (Provisions infrastructure and deploys)
# All commands run non-interactively using defaults!

# 7. Result:
# ✅ Agent deployed successfully
# 📁 Deployment directory: ./customer-support-agent-deployment
# 📍 Endpoint: https://your-project.cognitiveservices.azure.com/agents/customer-support-agent
# 📊 Monitoring: Application Insights resource created
# 🧪 Test with provided curl commands
```

**Important Notes:**
- The skill automatically finds your agent files - no need to specify the path!
- The skill uses `--no-prompt` flags to deploy non-interactively with sensible defaults
- The skill creates a separate `-deployment` directory because `azd init` requires an empty folder
- Your original agent directory remains unchanged
- To customize defaults, modify `azure.yaml` after `azd init` but before `azd up`

## What Gets Deployed

When you use this skill to deploy a new project, Azure provisions:

### Core Resources
- **Azure AI Foundry Account** - Parent resource for projects
- **Azure AI Foundry Project** - Contains agents and models
- **Azure Container Registry** - Stores agent container images
- **Managed Identity** - For secure authentication
- **Application Insights** - For logging and monitoring

### Agent Resources
- **Hosted Agent Deployment** - Your running agent container
- **Model Deployments** - GPT-4, GPT-4o, or other models (if specified)
- **Tool Connections** - Bing Grounding, MCP tools (if specified)

### Resource Naming
Resources are typically named:
- Resource Group: `rg-<environment-name>`
- Foundry Account: `ai-<environment-name>`
- Project: `<environment-name>`
- Container Registry: `cr<environment-name>`

## Directory Structure After Deployment

The skill creates a separate deployment directory to keep your original agent code clean:

```
your-workspace/
├── customer-support-agent/          # Original agent code (unchanged)
│   ├── main.py
│   ├── requirements.txt
│   ├── agent.yaml
│   ├── Dockerfile
│   ├── .env (local testing only)
│   └── README.md
│
└── customer-support-agent-deployment/  # Created by skill
    ├── src/                            # Agent code (auto-copied by azd)
    │   ├── main.py                     # Copied by azd ai agent init
    │   ├── requirements.txt            # Copied by azd ai agent init
    │   ├── agent.yaml                  # Copied by azd ai agent init
    │   └── Dockerfile                  # Copied by azd ai agent init
    ├── azure.yaml                      # Generated by azd
    ├── .azure/                         # azd configuration
    └── infra/                          # Infrastructure as code (Bicep)
```

**How it works:**
1. Skill creates empty `customer-support-agent-deployment/` directory
2. Runs `azd init` (for new projects) in the empty directory
3. Runs `azd ai agent init -m ../customer-support-agent/agent.yaml`
4. The `azd ai agent init` command automatically copies all agent files to `src/` subdirectory

**Why separate directories?**
- `azd init` requires an empty directory (when creating new projects)
- Keeps original agent code clean and version-controlled
- Allows testing locally from original directory while deploying from deployment directory
- Deployment artifacts (`azure.yaml`, `.azure/`, `infra/`) don't clutter agent code

**For updates:** Modify files in the original directory, then run `azd deploy` from deployment directory (azd will rebuild from `src/`).

## Testing After Deployment

The skill provides multiple testing options:

### Option 1: REST API Test
```bash
curl -X POST https://<endpoint>/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv)" \
  -d '{"input": {"messages": [{"role": "user", "content": "Hello"}]}}'
```

### Option 2: Azure AI Foundry Portal
1. Go to https://ai.azure.com
2. Select your project
3. Navigate to "Agents"
4. Test interactively in the chat interface

### Option 3: Python SDK
```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

client = AIProjectClient(
    project_endpoint="<your-endpoint>",
    credential=DefaultAzureCredential()
)

response = client.agents.invoke(
    agent_name="<your-agent>",
    messages=[{"role": "user", "content": "Hello"}]
)
```

## Common Issues and Solutions

### "azd not found"
**Solution:** Skill will guide you through installing Azure Developer CLI.

### "Authentication failed"
**Solution:** Skill will run `azd auth login` to authenticate.

### "Insufficient permissions"
**Solution:** Skill will identify required roles and provide guidance.

### "Region not supported"
**Solution:** Hosted agents (preview) only available in North Central US. Skill will configure correctly.

### "Agent won't start"
**Solution:** Skill will check Application Insights logs and provide debugging steps.

## Preview Limitations

During preview, hosted agents have these limitations:
- **Region:** North Central US only
- **Networking:** Private networking not supported in standard setup
- **Limits:** See Azure AI Foundry preview limits documentation

## Security Considerations

The skill enforces these security best practices:
- ✅ Uses managed identities (no hardcoded credentials)
- ✅ Stores secrets in Azure Key Vault
- ✅ Applies least-privilege RBAC
- ✅ Validates agent.yaml doesn't contain secrets
- ✅ Uses secure container registries
- ⚠️ Warns about non-Microsoft tool integrations

## Cost Considerations

Deploying an agent incurs costs for:
- **Azure AI Foundry** - Pay-as-you-go for hosted agents
- **Azure OpenAI** - Token usage charges
- **Container Registry** - Storage and data transfer
- **Application Insights** - Log storage and queries
- **Bing Grounding** - Search API calls (if used)

**Tip:** Start with small deployments and monitor costs in Azure portal.

## Updating Deployed Agents

To update an already-deployed agent:

1. Modify your agent code (main.py, etc.)
2. Run: `/deploy-agent-to-foundry`
3. Select "Update existing deployment"
4. Skill runs: `azd deploy` (faster than full `azd up`)

**Result:** New container built and deployed with updated code.

## CI/CD Integration

After successful manual deployment, consider setting up CI/CD:

**GitHub Actions Example:**
```yaml
name: Deploy Agent
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - name: Deploy
        run: |
          cd agent-directory
          azd deploy
```

## Troubleshooting

If deployment fails:
1. Skill captures error messages
2. Provides specific troubleshooting steps
3. Checks common issues (permissions, regions, etc.)
4. Suggests Azure portal logs to review
5. Offers retry commands

## Related Skills

- **`/create-agent-framework-agent`** - Create a new agent before deploying
- **`/commit`** - Commit agent code before deployment
- **`/review-pr`** - Review agent code changes

## Support and Resources

- **Azure AI Foundry Portal:** https://ai.azure.com
- **Foundry Documentation:** https://learn.microsoft.com/azure/ai-foundry/
- **Azure Developer CLI:** https://aka.ms/azure-dev/install
- **Foundry Samples:** https://github.com/microsoft-foundry/foundry-samples

## Learn More

- See `SKILL.md` for detailed step-by-step workflow
- Check Azure AI Foundry docs for advanced configurations
- Review foundry-samples repository for example deployments
- Join Azure AI community for support and discussions
