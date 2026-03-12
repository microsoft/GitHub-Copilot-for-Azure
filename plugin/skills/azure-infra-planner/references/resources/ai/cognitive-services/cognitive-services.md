# Cognitive Services Account

## Identity

| Field | Value |
|-------|-------|
| ARM Type | `Microsoft.CognitiveServices/accounts` |
| Bicep API Version | `2025-06-01` |
| CAF Prefix | Varies by kind — see Subtypes table |

## Region Availability

**Category:** Mainstream — available in all recommended regions; demand-driven in alternate regions. Specific kinds vary by region — always verify for OpenAI, Speech, and Vision services.

## Subtypes (kind)

See [subtypes.md](subtypes.md) for the full list of `kind` values. The `kind` property is required, set at creation, and **cannot be changed**.

## SKU Names

See [skus.md](skus.md) for the complete list of SKU names and tiers.

## Naming

| Constraint | Value |
|------------|-------|
| Min Length | 2 |
| Max Length | 64 |
| Allowed Characters | Alphanumerics and hyphens |
| Pattern (regex) | `^[a-zA-Z0-9][a-zA-Z0-9-]*$` |
| Scope | Resource group |
| Example | `oai-chatbot-prod-001` |

> Must start with an alphanumeric. Name also forms part of the default endpoint subdomain. For Microsoft Entra ID authentication, set a `customSubDomainName` (required, globally unique, 2-64 lowercase alphanumeric/hyphen characters).

## Required Properties (Bicep)

See [bicep.md](bicep.md) for the Bicep resource definition and required properties.

## Key Properties

See [properties.md](properties.md) for the complete list of key properties.

## Pairing Constraints

See [constraints.md](constraints.md) for pairing constraints with other Azure resources.

## Child Resources

| Child Type | ARM Type | Purpose |
|------------|----------|---------|
| Deployments | `Microsoft.CognitiveServices/accounts/deployments` | Model deployments (OpenAI, etc.) |
| Commitment Plans | `Microsoft.CognitiveServices/accounts/commitmentPlans` | Reserved capacity plans |
| RAI Blocklists | `Microsoft.CognitiveServices/accounts/raiBlocklists` | Responsible AI content blocklists |
| RAI Policies | `Microsoft.CognitiveServices/accounts/raiPolicies` | Responsible AI content filtering policies |
| Defender Settings | `Microsoft.CognitiveServices/accounts/defenderForAISettings` | Defender for AI threat protection |
| Encryption Scopes | `Microsoft.CognitiveServices/accounts/encryptionScopes` | Customer-managed key scopes |
| Connections | `Microsoft.CognitiveServices/accounts/connections` | Service connections |
| Projects | `Microsoft.CognitiveServices/accounts/projects` | AI Foundry projects (kind=AIServices) |
| Private Endpoint Connections | `Microsoft.CognitiveServices/accounts/privateEndpointConnections` | Private networking |

## References

- [Bicep resource reference (2025-06-01)](https://learn.microsoft.com/azure/templates/microsoft.cognitiveservices/accounts?pivots=deployment-language-bicep)
- [All API versions](https://learn.microsoft.com/azure/templates/microsoft.cognitiveservices/allversions)
- [Azure naming rules — Cognitive Services](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftcognitiveservices)
- [Custom subdomain names](https://learn.microsoft.com/azure/ai-services/cognitive-services-custom-subdomains)
- [CAF abbreviations](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations)
