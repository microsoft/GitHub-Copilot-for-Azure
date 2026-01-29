# Azure AI Gateway Configuration Patterns

This document contains patterns for configuring Azure API Management as an AI Gateway for AI models, MCP tools, and agents.

> **For deploying a new APIM instance**, see the [azure-deploy skill](../../azure-deploy/reference/apim.md).

---

## Pattern 1: Add AI Model Backend

Configure a backend for your Azure OpenAI or AI Foundry model.

### Step 1: Discover AI Resources

```bash
# List Azure OpenAI resources
az cognitiveservices account list \
  --query "[?kind=='OpenAI'].{name:name, resourceGroup:resourceGroup, location:location}" -o table

# List AI Foundry resources  
az cognitiveservices account list \
  --query "[?kind=='AIServices'].{name:name, resourceGroup:resourceGroup, location:location}" -o table

# List model deployments
az cognitiveservices account deployment list \
  --name <account-name> \
  --resource-group <rg> -o table
```

### Step 2: Ask User Which Model

Use `ask_user` tool to present discovered models and let user select which to add.

### Step 3: Create Backend

```bash
# Get the endpoint
ENDPOINT=$(az cognitiveservices account show \
  --name <account-name> \
  --resource-group <rg> \
  --query "properties.endpoint" -o tsv)

# Create backend
az apim backend create \
  --service-name <apim-name> \
  --resource-group <apim-rg> \
  --backend-id openai-backend \
  --protocol http \
  --url "${ENDPOINT}openai"
```

### Step 4: Grant Access (Managed Identity)

```bash
# Get APIM principal ID
APIM_PRINCIPAL=$(az apim show \
  --name <apim-name> \
  --resource-group <apim-rg> \
  --query "identity.principalId" -o tsv)

# Get AI resource ID
AI_RESOURCE_ID=$(az cognitiveservices account show \
  --name <account-name> \
  --resource-group <rg> \
  --query "id" -o tsv)

# Assign Cognitive Services User role
az role assignment create \
  --assignee $APIM_PRINCIPAL \
  --role "Cognitive Services User" \
  --scope $AI_RESOURCE_ID
```

### Step 5: Apply Governance Policies

Apply AI governance policies from [policies.md](policies.md):
- Token limits for cost control
- Semantic caching for cost reduction
- Content safety for protection
- Load balancing for high availability

---

## Pattern 2: Add Backend Pool (Load Balancing)

Distribute load across multiple AI model deployments.

### Step 1: Create Multiple Backends

```bash
# Backend 1 - East US
az apim backend create \
  --service-name <apim-name> \
  --resource-group <rg> \
  --backend-id openai-eastus \
  --protocol http \
  --url "https://aoai-eastus.openai.azure.com/openai"

# Backend 2 - West US
az apim backend create \
  --service-name <apim-name> \
  --resource-group <rg> \
  --backend-id openai-westus \
  --protocol http \
  --url "https://aoai-westus.openai.azure.com/openai"
```

### Step 2: Create Backend Pool (Bicep)

```bicep
resource backendPool 'Microsoft.ApiManagement/service/backends@2024-06-01-preview' = {
  parent: apimService
  name: 'openai-backend-pool'
  properties: {
    type: 'Pool'
    pool: {
      services: [
        { id: '/backends/openai-eastus', weight: 50, priority: 1 }
        { id: '/backends/openai-westus', weight: 50, priority: 1 }
      ]
    }
  }
}
```

### Step 3: Apply Retry Policy

```xml
<backend>
    <retry count="2" interval="0" first-fast-retry="true" 
        condition="@(context.Response.StatusCode == 429 || context.Response.StatusCode == 503)">
        <set-backend-service backend-id="openai-backend-pool" />
        <forward-request buffer-request-body="true" />
    </retry>
</backend>
```

---

## Pattern 3: Configure Semantic Caching

Cache similar prompts to reduce costs (60-80% savings possible).

### Prerequisites

- An embeddings model deployment (e.g., text-embedding-ada-002)
- Azure Cache for Redis (for production) or internal cache

### Step 1: Create Embeddings Backend

```bash
az apim backend create \
  --service-name <apim-name> \
  --resource-group <rg> \
  --backend-id embeddings-backend \
  --protocol http \
  --url "https://aoai.openai.azure.com/openai"
```

### Step 2: Apply Policy

```xml
<inbound>
    <azure-openai-semantic-cache-lookup 
        score-threshold="0.8" 
        embeddings-backend-id="embeddings-backend"
        embeddings-backend-auth="system-assigned" />
</inbound>
<outbound>
    <azure-openai-semantic-cache-store duration="120" />
</outbound>
```

### Tuning

| Threshold | Cache Hits | Accuracy |
|-----------|------------|----------|
| 0.7 | High | Lower (broader matching) |
| 0.8 | Medium | Balanced (recommended) |
| 0.9 | Low | High (strict matching) |

---

## Pattern 4: Configure Content Safety

Protect AI endpoints with content filtering and jailbreak detection.

### Prerequisites

- Azure AI Content Safety resource

### Step 1: Create Content Safety Backend

```bash
# Get Content Safety endpoint
CS_ENDPOINT=$(az cognitiveservices account show \
  --name <content-safety-name> \
  --resource-group <rg> \
  --query "properties.endpoint" -o tsv)

# Create backend
az apim backend create \
  --service-name <apim-name> \
  --resource-group <rg> \
  --backend-id content-safety-backend \
  --protocol http \
  --url "${CS_ENDPOINT}"
```

### Step 2: Grant Access

```bash
# Get Content Safety resource ID
CS_RESOURCE_ID=$(az cognitiveservices account show \
  --name <content-safety-name> \
  --resource-group <rg> \
  --query "id" -o tsv)

# Assign role
az role assignment create \
  --assignee $APIM_PRINCIPAL \
  --role "Cognitive Services User" \
  --scope $CS_RESOURCE_ID
```

### Step 3: Apply Policy

```xml
<llm-content-safety backend-id="content-safety-backend" shield-prompt="true">
    <categories output-type="EightSeverityLevels">
        <category name="Hate" threshold="4" />
        <category name="Sexual" threshold="4" />
        <category name="SelfHarm" threshold="4" />
        <category name="Violence" threshold="4" />
    </categories>
</llm-content-safety>
```

---

## Pattern 5: Convert API to MCP Server

Convert existing APIM API operations into MCP server for AI agent tool discovery.

### Step 1: List APIs

```bash
az apim api list \
  --service-name <apim-name> \
  --resource-group <rg> \
  --query "[].{id:name, displayName:displayName, path:path}" -o table
```

### Step 2: Select API

Use `ask_user` tool to let user select which API to convert.

### Step 3: List Operations

```bash
az apim api operation list \
  --service-name <apim-name> \
  --resource-group <rg> \
  --api-id <api-id> \
  --query "[].{id:name, method:method, url:urlTemplate}" -o table
```

### Step 4: Configure MCP Endpoints

Add MCP tools/list and tools/call operations with appropriate policies.

### Reference

- [MCP Server Overview](https://learn.microsoft.com/azure/api-management/mcp-server-overview)

---

## Lab References

| Scenario | Lab |
|----------|-----|
| Semantic Caching | [semantic-caching](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/semantic-caching) |
| Token Rate Limiting | [token-rate-limiting](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/token-rate-limiting) |
| Content Safety | [content-safety](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/content-safety) |
| Load Balancing | [backend-pool-load-balancing](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/backend-pool-load-balancing) |
| MCP from API | [mcp-from-api](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/mcp-from-api) |

**All labs:** https://github.com/Azure-Samples/AI-Gateway/tree/main/labs
