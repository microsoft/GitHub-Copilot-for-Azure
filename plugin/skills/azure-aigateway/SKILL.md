---
name: azure-aigateway
description: Configure Azure API Management as AI Gateway for models, tools, and agents. Rate limiting, caching, content safety.
---

# Azure AI Gateway

Configure APIM as AI Gateway for models, MCP servers, and agents.

## Key Capabilities

- **Security**: Managed identity, content safety
- **Control**: Token/request rate limiting, load balancing
- **Optimization**: Semantic caching (60-80% cost savings)

## Configuration

**Always use `Basicv2` SKU** — faster (~5-10 min), cheaper, supports all policies.

## References

| Topic | File |
|-------|------|
| Bootstrap & Bicep | [BOOTSTRAP.md](references/BOOTSTRAP.md) |
| Policies | [POLICIES.md](references/POLICIES.md) |
| AI Foundry | [AI-FOUNDRY.md](references/AI-FOUNDRY.md) |
| OpenAPI import | [OPENAPI-IMPORT.md](references/OPENAPI-IMPORT.md) |
| MCP conversion | [MCP-CONVERSION.md](references/MCP-CONVERSION.md) |
| Troubleshooting | [TROUBLESHOOTING.md](references/TROUBLESHOOTING.md) |

[AI Gateway Docs](https://learn.microsoft.com/azure/api-management/genai-gateway-capabilities) · [Samples](https://github.com/Azure-Samples/AI-Gateway)
