# Azure API Management Deployment Guide

Complete reference for deploying Azure API Management (APIM) for API Gateway and AI Gateway scenarios.

---

## Overview

Azure API Management is a fully managed service for publishing, securing, transforming, maintaining, and monitoring APIs. It serves as both a traditional API Gateway and an AI Gateway for LLM-based applications.

**Key Benefits:**
- **Security** - Authentication, authorization, rate limiting, IP filtering
- **Transformation** - Request/response modification, protocol translation
- **Observability** - Logging, metrics, tracing, analytics
- **AI Gateway** - Token limits, semantic caching, content safety for AI models
- **Developer Portal** - Self-service API discovery and documentation

**When to use Azure API Management:**
- **API Gateway** - Centralized entry point for backend APIs
- **AI Gateway** - Govern AI models, MCP tools, and agents
- **Rate Limiting** - Protect APIs from abuse
- **Authentication** - Centralized auth for multiple backends
- **API Versioning** - Manage multiple API versions
- **Monetization** - Usage tracking and billing

**Deployment Workflow:**
```
Create APIM → Add Backends → Import APIs → Configure Policies → Test
```

---

## Prerequisites and Validation

### Pattern 0: Prerequisites Validation

**Always validate prerequisites before starting deployment.**

```bash
# Check Azure CLI authentication
az account show || az login

# Verify subscription
az account show --query "{name:name, id:id}" -o table

# Check if APIM already exists
az apim list --query "[].{name:name, rg:resourceGroup, sku:sku.name}" -o table
```

### Prerequisites Checklist

**Setup:**
- [ ] Azure subscription created
- [ ] Azure CLI installed (`az --version`)
- [ ] Azure CLI authenticated (`az login`)
- [ ] Appropriate permissions (Contributor on resource group)

---

## Pattern 1: Deploy APIM Instance

Create a new API Management instance with Basicv2 SKU (recommended).

```bash
# Set variables
RESOURCE_GROUP="rg-apim"
LOCATION="eastus"
APIM_NAME="apim-$(openssl rand -hex 4)"
PUBLISHER_EMAIL="admin@contoso.com"
PUBLISHER_NAME="Contoso"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Deploy APIM with Basicv2 SKU (~5-10 min deployment)
az apim create \
  --name $APIM_NAME \
  --resource-group $RESOURCE_GROUP \
  --publisher-email $PUBLISHER_EMAIL \
  --publisher-name "$PUBLISHER_NAME" \
  --sku-name Basicv2 \
  --enable-managed-identity true

# Get gateway URL
az apim show --name $APIM_NAME --resource-group $RESOURCE_GROUP --query "gatewayUrl" -o tsv
```

### SKU Selection Guide

| SKU | Deployment Time | Monthly Cost | Use Case |
|-----|-----------------|--------------|----------|
| **Basicv2** (recommended) | ~5-10 min | ~$150 | Dev/test, AI Gateway, small production |
| Standardv2 | ~10-15 min | ~$300 | Production APIs, higher throughput |
| Developer | ~30 min | ~$50 | Development only (no SLA) |
| Premium | ~45+ min | ~$2800+ | Enterprise, multi-region, VNet integration |

**Decision guide:**
- **Default to Basicv2** - Fast deployment, cost-effective, supports all AI Gateway policies
- **Use Standardv2** - Higher throughput needed (>1000 req/sec)
- **Use Developer** - Development/testing only, no production SLA required
- **Use Premium** - Need VNet integration, multi-region, or >99.95% SLA

---

## Pattern 2: Discovery Commands

Find existing APIM instances and their configuration.

```bash
# List all APIM instances in subscription
az apim list --query "[].{name:name, rg:resourceGroup, sku:sku.name, location:location}" -o table

# Get APIM details
az apim show --name <apim-name> --resource-group <rg>

# Get gateway URL
az apim show --name <apim-name> --resource-group <rg> --query "gatewayUrl" -o tsv

# Get management URL
az apim show --name <apim-name> --resource-group <rg> --query "managementApiUrl" -o tsv

# Get managed identity principal ID (for role assignments)
az apim show --name <apim-name> --resource-group <rg> --query "identity.principalId" -o tsv

# List APIs
az apim api list --service-name <apim-name> --resource-group <rg> \
  --query "[].{id:name, displayName:displayName, path:path}" -o table

# List backends
az apim backend list --service-name <apim-name> --resource-group <rg> \
  --query "[].{id:name, url:url, protocol:protocol}" -o table

# List products
az apim product list --service-name <apim-name> --resource-group <rg> \
  --query "[].{id:name, displayName:displayName, state:state}" -o table

# List subscriptions (for API keys)
az apim subscription list --service-name <apim-name> --resource-group <rg> \
  --query "[].{name:displayName, scope:scope, state:state}" -o table
```

---

## Pattern 3: Add Backend

Configure backends for your APIs and AI models.

### Custom API Backend

```bash
az apim backend create \
  --service-name <apim-name> \
  --resource-group <rg> \
  --backend-id my-api-backend \
  --protocol http \
  --url "https://my-api.example.com"
```

### Azure OpenAI Backend

```bash
# Get Azure OpenAI endpoint
AOAI_ENDPOINT=$(az cognitiveservices account show \
  --name <aoai-name> \
  --resource-group <aoai-rg> \
  --query "properties.endpoint" -o tsv)

# Create backend
az apim backend create \
  --service-name <apim-name> \
  --resource-group <apim-rg> \
  --backend-id openai-backend \
  --protocol http \
  --url "${AOAI_ENDPOINT}openai"

# Grant APIM access to Azure OpenAI
APIM_PRINCIPAL=$(az apim show \
  --name <apim-name> \
  --resource-group <apim-rg> \
  --query "identity.principalId" -o tsv)

AOAI_ID=$(az cognitiveservices account show \
  --name <aoai-name> \
  --resource-group <aoai-rg> \
  --query "id" -o tsv)

az role assignment create \
  --assignee $APIM_PRINCIPAL \
  --role "Cognitive Services User" \
  --scope $AOAI_ID
```

### AI Foundry Backend

```bash
# Get AI Foundry endpoint
AI_ENDPOINT=$(az cognitiveservices account show \
  --name <ai-foundry-name> \
  --resource-group <rg> \
  --query "properties.endpoints[\"Azure AI Model Inference API\"]" -o tsv)

# Create backend
az apim backend create \
  --service-name <apim-name> \
  --resource-group <apim-rg> \
  --backend-id ai-foundry-backend \
  --protocol http \
  --url "$AI_ENDPOINT"
```

---

## Pattern 4: Import API

Import APIs from OpenAPI/Swagger specifications.

### From URL

```bash
az apim api import \
  --service-name <apim-name> \
  --resource-group <rg> \
  --api-id my-api \
  --path /api \
  --display-name "My API" \
  --specification-format OpenApiJson \
  --specification-url "https://example.com/openapi.json"
```

### From Local File

```bash
# JSON format
az apim api import \
  --service-name <apim-name> \
  --resource-group <rg> \
  --api-id my-api \
  --path /api \
  --display-name "My API" \
  --specification-format OpenApiJson \
  --specification-path "./openapi.json"

# YAML format
az apim api import \
  --service-name <apim-name> \
  --resource-group <rg> \
  --api-id my-api \
  --path /api \
  --display-name "My API" \
  --specification-format OpenApi \
  --specification-path "./openapi.yaml"
```

### Supported Specification Formats

| Format | CLI Value | File Extension |
|--------|-----------|----------------|
| OpenAPI 3.x JSON | `OpenApiJson` | `.json` |
| OpenAPI 3.x YAML | `OpenApi` | `.yaml`, `.yml` |
| Swagger 2.0 JSON | `SwaggerJson` | `.json` |
| WSDL | `Wsdl` | `.wsdl` |

---

## Pattern 5: Get Subscription Keys

Retrieve API keys for testing.

```bash
# List subscriptions
az apim subscription list \
  --service-name <apim-name> \
  --resource-group <rg> \
  --query "[].{name:displayName, id:name, state:state}" -o table

# Get subscription keys
az apim subscription keys list \
  --service-name <apim-name> \
  --resource-group <rg> \
  --subscription-id <subscription-id>

# Create new subscription
az apim subscription create \
  --service-name <apim-name> \
  --resource-group <rg> \
  --subscription-id my-subscription \
  --display-name "My Subscription" \
  --scope "/apis"  # All APIs
```

---

## Pattern 6: Test Gateway

Test API endpoints through the gateway.

```bash
# Get gateway URL
GATEWAY_URL=$(az apim show \
  --name <apim-name> \
  --resource-group <rg> \
  --query "gatewayUrl" -o tsv)

# Test simple GET request
curl -X GET "${GATEWAY_URL}/<api-path>" \
  -H "Ocp-Apim-Subscription-Key: <subscription-key>"

# Test POST with JSON body
curl -X POST "${GATEWAY_URL}/<api-path>" \
  -H "Content-Type: application/json" \
  -H "Ocp-Apim-Subscription-Key: <subscription-key>" \
  -d '{"key": "value"}'

# Test Azure OpenAI through gateway
curl -X POST "${GATEWAY_URL}/openai/deployments/<deployment>/chat/completions?api-version=2024-02-01" \
  -H "Content-Type: application/json" \
  -H "Ocp-Apim-Subscription-Key: <subscription-key>" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

---

## Pattern 7: Configuration After Deployment

After deploying APIM, use the **azure-aigateway** skill to:
- Configure APIM policies (rate limiting, authentication, caching)
- Set up AI-specific policies (semantic caching, token limits, content safety)
- Manage governance for models, tools, and agents

The **azure-aigateway** skill provides comprehensive policy patterns and configuration guidance.

---

## Best Practices

| Practice | Description |
|----------|-------------|
| **Use Basicv2 SKU** | Fast deployment (~5-10 min vs 30+ for Developer), cost-effective |
| **Enable managed identity** | Use for secure backend authentication without API keys |
| **Use subscription keys** | Require keys for all APIs (`subscriptionRequired: true`) |
| **Configure rate limiting** | Protect backends from abuse |
| **Enable Application Insights** | For comprehensive monitoring and diagnostics |
| **Use named values** | Store secrets and config in named values, not in policies |
| **Version your APIs** | Use path-based or header-based versioning |

---

## Troubleshooting

### Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Slow deployment** | Takes 30+ minutes | Use Basicv2 SKU instead of Developer or Premium |
| **Backend auth fails** | 401 from Azure OpenAI | Assign "Cognitive Services User" role to APIM managed identity |
| **API not found** | 404 error | Verify API path, check subscription key is valid for API scope |
| **Rate limit exceeded** | 429 error | Increase rate limit in policy or upgrade SKU |
| **CORS errors** | Browser blocks request | Add CORS policy in inbound section |
| **Import fails** | Invalid OpenAPI spec | Validate spec with online validator, check format parameter |

### Debug Commands

```bash
# Check APIM status
az apim show --name <apim-name> --resource-group <rg> --query "provisioningState" -o tsv

# View API details
az apim api show --service-name <apim-name> --resource-group <rg> --api-id <api-id>

# Check backend configuration
az apim backend show --service-name <apim-name> --resource-group <rg> --backend-id <backend-id>

# Test connectivity to backend
curl -v <backend-url>

# View APIM logs (requires diagnostic settings)
az monitor diagnostic-settings list --resource <apim-resource-id>
```

---

## Azure Resources Reference

### Core Resources for APIM

| Resource Type | Purpose | API Version |
|--------------|---------|-------------|
| `Microsoft.ApiManagement/service` | APIM instance | 2024-06-01-preview |
| `Microsoft.ApiManagement/service/apis` | API definitions | 2024-06-01-preview |
| `Microsoft.ApiManagement/service/backends` | Backend configurations | 2024-06-01-preview |
| `Microsoft.ApiManagement/service/subscriptions` | API subscriptions/keys | 2024-06-01-preview |
| `Microsoft.ApiManagement/service/products` | API products | 2024-06-01-preview |

### Example Bicep Template

```bicep
@description('Location for all resources')
param location string = resourceGroup().location

@description('APIM instance name')
param apimName string

@description('Publisher email')
param publisherEmail string

@description('Publisher name')
param publisherName string

@allowed(['Basicv2', 'Standardv2', 'Developer', 'Premium'])
param sku string = 'Basicv2'

resource apim 'Microsoft.ApiManagement/service@2024-06-01-preview' = {
  name: apimName
  location: location
  sku: {
    name: sku
    capacity: 1
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
  }
}

output gatewayUrl string = apim.properties.gatewayUrl
output managementUrl string = apim.properties.managementApiUrl
output principalId string = apim.identity.principalId
```

---

## Additional Resources

- [Azure API Management Documentation](https://learn.microsoft.com/azure/api-management/)
- [GenAI Gateway Capabilities](https://learn.microsoft.com/azure/api-management/genai-gateway-capabilities)
- [APIM Policies Reference](https://learn.microsoft.com/azure/api-management/api-management-policies)
- [AI-Gateway Samples Repository](https://github.com/Azure-Samples/AI-Gateway)
- [MCP Server Overview](https://learn.microsoft.com/azure/api-management/mcp-server-overview)
