---
name: agent-framework-deploy
description: |
  Deploy AI agents and workflows built with Microsoft Agent Framework SDK to Microsoft Foundry. Handles Dockerfile generation, ACR container build, hosted agent version creation, and container startup.
  USE FOR: deploy agent to Foundry, publish agent to production, host agent on Azure, deploy workflow to Foundry, go live with agent, production deployment agent, deploy agent framework app, push agent to Azure AI Foundry, containerize agent, deploy multi-agent workflow.
  DO NOT USE FOR: creating agents (use agent-framework), deploying models (use models/deploy-model), deploying web apps or functions (use azure-deploy), managing quotas (use quota).
---

### Deployment

#### Prerequisites

- Azure CLI installed and authenticated
- Azure AI Foundry Resource and Project created
- Agent must be wrapped as HTTP server using Agent-as-Server pattern. See [agent-as-server.md](references/agent-as-server.md).


#### Deployment Workflow

**Step 1: Verify locally**

Verify agent runs locally as HTTP server.

**Step 2: Gather Context**

Use az CLI to check the logged-in context first; ask user only for values that cannot be retrieved:
- `SUB_ID` - Azure Subscription ID
- `RG_NAME` - Resource Group name
- `FOUNDRY_RESOURCE` - Azure AI Foundry resource name
- `PROJECT_NAME` - Foundry project name
- `AGENT_NAME` - name for the hosted agent
- `ENTRYPOINT` - main file to run, e.g., `app.py` (if Dockerfile needs to be generated)


**Step 3: Prepare Dockerfile**

If no Dockerfile exists, generate one. Below is a Python example:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY ./ user_agent/

WORKDIR /app/user_agent

RUN if [ -f requirements.txt ]; then \
        pip install -r requirements.txt; \
    else \
        echo "No requirements.txt found"; \
    fi

EXPOSE 8088

CMD ["python", "<ENTRYPOINT_FILE>"]
```

Replace `<ENTRYPOINT_FILE>` with user's specified entry point.

> **Important:** If you decide to add `.env` to `.dockerignore`, confirm with the user which environment variables need to be included in the Docker container.

**Step 4: Configure ACR**

**If ACR exists**: Use existing ACR directly, skip role assignment.

**If no ACR exists**: Create new ACR with ABAC repository permissions mode, then assign:
- **Container Registry Repository Reader** to Foundry project managed identity
- **Container Registry Repository Writer** to current user

**Step 5: Build and Push Container Image**

Use ACR remote build (no local Docker required):

1. Generate a random alphanumeric image tag (12 characters)
2. Build and push the image:
```bash
IMAGE_NAME="$ACR_NAME.azurecr.io/$AGENT_NAME:$IMAGE_TAG"
az acr build --registry $ACR_NAME --image $IMAGE_NAME --subscription $SUB_ID --source-acr-auth-id "[caller]" <SOURCE_DIR>
```

**Important**: `--source-acr-auth-id "[caller]"` is required.

**Note**: `az acr build` streams logs from the remote build. If the CLI crashes while displaying logs (e.g., `UnicodeEncodeError` on Windows), the remote build continues running independently. Do
  not assume failure. Check actual build status with:
  ```bash
  az acr task show-run -r $ACR_NAME --run-id <run-id> --query status
  ```

**Step 6: Deploy Agent Version**

Ask the user for resource allocation preferences:
- `CPU` - CPU cores for the agent container (default: `0.5`)
- `MEMORY` - Memory allocation (default: `1Gi`)

Get access token and create agent version:

```bash
az account get-access-token --resource https://ai.azure.com --query accessToken --output tsv
```

```
POST https://$FOUNDRY_RESOURCE.services.ai.azure.com/api/projects/$PROJECT_NAME/agents/$AGENT_NAME/versions?api-version=2025-05-15-preview
```

**Body**:
```json
{
    "definition": {
        "kind": "hosted",
        "container_protocol_versions": [
            { "protocol": "RESPONSES", "version": "v1" }
        ],
        "cpu": "$CPU",
        "memory": "$MEMORY",
        "image": "$IMAGE_NAME",
        "environment_variables": { "LOG_LEVEL": "debug" }
    }
}
```

Record `$AGENT_VERSION` from response.

**Step 7: Start Agent Container**

```
POST https://$FOUNDRY_RESOURCE.services.ai.azure.com/api/projects/$PROJECT_NAME/agents/$AGENT_NAME/versions/$AGENT_VERSION/containers/default:start?api-version=2025-05-15-preview
```

**Body**:
```json
{
    "min_replicas": 1,
    "max_replicas": 1
}
```

**Step 8: Validate Deployment**

Test the agent:

```
POST https://$FOUNDRY_RESOURCE.services.ai.azure.com/api/projects/$PROJECT_NAME/openai/responses?api-version=2025-05-15-preview
```

**Body**:
```json
{
    "agent": {
        "type": "agent_reference",
        "name": "$AGENT_NAME",
        "version": "$AGENT_VERSION"
    },
    "input": [
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": "Hi, what can you do"
                }
            ]
        }
    ],
    "stream": false
}
```

**Step 9: Post-Deployment**

- Create reusable deployment script in project root
- Save deployment summary to `.azure/foundry-deployment-summary.md`
