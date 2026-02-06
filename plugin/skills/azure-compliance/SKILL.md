---
name: azure-compliance
description: |
  Comprehensive Azure compliance and security auditing capabilities including best practices assessment,
  Key Vault expiration monitoring, and resource configuration validation.
  USE FOR: compliance scan, security audit, azqr, Azure best practices, Key Vault expiration check,
  compliance assessment, resource review, configuration validation, expired certificates, expiring secrets,
  orphaned resources, policy compliance, security posture evaluation.
  DO NOT USE FOR: deploying resources (use azure-deploy), cost analysis alone (use azure-cost-optimization),
  active security hardening (use azure-security-hardening), general Azure Advisor queries (use azure-observability).
---

# Azure Compliance & Security Auditing

## Triggers

Activate this skill when user wants to:
- Check Azure compliance or best practices
- Assess Azure resources for configuration issues
- Run azqr or Azure Quick Review
- Identify orphaned or misconfigured resources
- Review Azure security posture
- "Show me expired certificates/keys/secrets in my Key Vault"
- "Check what's expiring in the next 30 days"
- "Audit my Key Vault for compliance"
- "Find secrets without expiration dates"
- "Check certificate expiration dates"

---

## Assessments

| Assessment | Reference |
|------------|-----------|
| Comprehensive Compliance (azqr) | [references/azure-quick-review.md](references/azure-quick-review.md) |
| Key Vault Expiration | [references/azure-keyvault-expiration-audit.md](references/azure-keyvault-expiration-audit.md) |

## MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_extension_azqr` | Run azqr compliance scans |
| `mcp_azure_mcp_subscription_list` | List available subscriptions |
| `mcp_azure_mcp_group_list` | List resource groups |
| `keyvault_key_list` | List all keys in vault |
| `keyvault_key_get` | Get key details including expiration |
| `keyvault_secret_list` | List all secrets in vault |
| `keyvault_secret_get` | Get secret details including expiration |
| `keyvault_certificate_list` | List all certificates in vault |
| `keyvault_certificate_get` | Get certificate details including expiration |

