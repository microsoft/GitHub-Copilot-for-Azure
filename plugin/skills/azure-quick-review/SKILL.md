---
name: azure-quick-review
description: Azure compliance assessment using Azure Quick Review (azqr). Identifies best practice violations and provides remediation.
---

# Azure Quick Review

Compliance assessment using azqr to identify resources violating Azure best practices.

## Prerequisites

Azure authentication (`az login`) + Reader role on scope

## Workflow

1. **Determine scope**: Subscription, Resource Group, or Management Group
2. **Run scan**: `mcp_azure_mcp_extension_azqr` with subscription/resource-group params
3. **Analyze**: Focus on ImpactedResources, DefenderRecommendations, Advisor sheets
4. **Prioritize**: Security (Critical) → Reliability (High) → Performance/Cost (Medium)
5. **Remediate**: See [REMEDIATION-PATTERNS.md](references/REMEDIATION-PATTERNS.md)

## Result Sheets

| Sheet | Focus |
|-------|-------|
| ImpactedResources | Specific issues to fix |
| DefenderRecommendations | Security findings |
| Recommendations | All findings with counts |
| Advisor | Reliability/performance |

## MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_extension_azqr` | Run compliance scan |
| `mcp_azure_mcp_subscription_list` | List subscriptions |
| `mcp_azure_mcp_group_list` | List resource groups |

## References

- [Recommendations](references/RECOMMENDATIONS.md)
- [Remediation Patterns](references/REMEDIATION-PATTERNS.md)
- [azqr Docs](https://azure.github.io/azqr/docs/)
