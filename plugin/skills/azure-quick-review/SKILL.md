---
name: azure-quick-review
description: Performs Azure compliance assessments using Azure Quick Review (azqr) to identify resources that don't comply with Azure best practices. Use this skill when users ask to check compliance, assess Azure resources, run azqr, identify best practice violations, find orphaned resources, or review Azure resource configurations. Activate when users mention compliance scan, resource review, Azure assessment, or security posture evaluation.
---

# Azure Quick Review Compliance Assessment

This skill enables comprehensive Azure compliance assessments using Azure Quick Review (azqr), analyzing findings against Azure best practices, and providing actionable remediation guidance.

## When to Use This Skill

- User asks to check Azure compliance or best practices
- User wants to assess Azure resources for configuration issues
- User mentions running azqr or Azure Quick Review
- User wants to identify orphaned or misconfigured resources
- User needs to review Azure security posture
- Before major deployments to establish a compliance baseline
- After deployments to verify no compliance regressions

## Prerequisites

- **azqr CLI installed** - Install via `winget install azqr` (Windows), `brew install azqr` (macOS), or bash script (Linux)
- **Azure authentication** - Logged in via Azure CLI (`az login`) or using Service Principal/Managed Identity
- **Reader permissions** - Minimum Reader role on target subscription or management group

## Assessment Workflow

### Step 1: Determine Scan Scope

Ask the user or detect from context:

| Scope | Use Case | Required Info |
|-------|----------|---------------|
| Subscription | Full subscription assessment | Subscription ID |
| Resource Group | Targeted assessment | Subscription ID + Resource Group name |
| Management Group | Enterprise-wide assessment | Management Group ID |
| Specific Service | Deep-dive on one resource type | Subscription ID + Service abbreviation |

### Step 2: Run Compliance Scan

Use the Azure MCP tool to run the scan:

```
mcp_azure_mcp_extension_azqr
  subscription: <subscription-id>
  resource-group: <optional-rg-name>
```

**Alternative CLI commands** (if MCP unavailable):

```powershell
# Full subscription scan
azqr scan -s <subscription-id> --json --output-name compliance-scan

# Resource group scan
azqr scan -s <subscription-id> -g <resource-group> --json --output-name compliance-scan

# Management group scan
azqr scan --management-group-id <mg-id> --json --output-name compliance-scan

# Specific service scan (e.g., storage accounts)
azqr scan st -s <subscription-id> --json --output-name storage-scan
```

**Recommended flags:**
- `--json` - Enables programmatic parsing of results
- `--output-name <name>` - Sets output filename (without extension)
- `-c=false` - Disable cost analysis if lacking Cost Management permissions
- `--mask=false` - Show full subscription IDs (for internal use)

### Step 3: Analyze Scan Results

The scan produces an Excel file with these sheets:

| Sheet | Contents | Priority |
|-------|----------|----------|
| **Recommendations** | All recommendations with impacted resource count | High |
| **ImpactedResources** | Resources with specific issues to address | High |
| **Inventory** | All scanned resources with SKU, Tier, SLA details | Medium |
| **Advisor** | Azure Advisor recommendations | Medium |
| **DefenderRecommendations** | Microsoft Defender for Cloud findings | High |
| **Azure Policy** | Non-compliant resources per Azure Policy | Medium |
| **Costs** | 3-month cost history by subscription | Low |
| **Defender** | Defender plan status and tiers | Medium |
| **OutOfScope** | Resources not scanned | Low |

**Focus analysis on:**
1. High-severity recommendations from ImpactedResources
2. Defender recommendations (security-critical)
3. Advisor recommendations (reliability/performance)
4. Policy non-compliance (governance)

### Step 4: Categorize Findings

Group findings by category for prioritized remediation:

| Category | Examples | Severity |
|----------|----------|----------|
| **Security** | Public endpoints, missing encryption, no private endpoints | Critical |
| **Reliability** | No zone redundancy, single instance, no backup | High |
| **Performance** | Undersized SKUs, missing caching, no CDN | Medium |
| **Cost** | Orphaned resources, oversized SKUs, unused reservations | Medium |
| **Operations** | Missing diagnostics, no alerts, no tags | Low |

### Step 5: Generate Remediation Guidance

For each high-priority finding:
1. Explain the risk in plain language
2. Provide remediation options (Portal, CLI, Bicep)
3. Estimate effort and impact

See [references/REMEDIATION-PATTERNS.md](references/REMEDIATION-PATTERNS.md) for common fix templates.

### Step 6: Present Summary

Provide a structured summary:

```markdown
## Compliance Assessment Summary

**Scope:** [Subscription/RG/MG name]
**Scanned:** [Date/Time]
**Resources Analyzed:** [Count]

### Key Findings

| Severity | Count | Top Issues |
|----------|-------|------------|
| Critical | X | [List top 3] |
| High | X | [List top 3] |
| Medium | X | [List top 3] |

### Recommended Actions

1. **[Issue]** - [Brief remediation]
2. **[Issue]** - [Brief remediation]
3. **[Issue]** - [Brief remediation]

### Next Steps
- [ ] Address critical security findings
- [ ] Review and remediate high-severity items
- [ ] Schedule follow-up scan to verify fixes
```

## Supported Azure Services

azqr supports 70+ Azure resource types. Common abbreviations:

| Abbrev | Service |
|--------|---------|
| `aks` | Azure Kubernetes Service |
| `apim` | API Management |
| `appcs` | App Configuration |
| `asp` | App Service |
| `ca` | Container Apps |
| `cosmos` | Cosmos DB |
| `cr` | Container Registry |
| `kv` | Key Vault |
| `lb` | Load Balancer |
| `mysql` | Azure Database for MySQL |
| `psql` | Azure Database for PostgreSQL |
| `redis` | Azure Cache for Redis |
| `sb` | Service Bus |
| `sql` | Azure SQL Database |
| `st` | Storage Accounts |
| `vm` | Virtual Machines |
| `vnet` | Virtual Networks |

Run `azqr types` for the complete list.

## Advanced Features

### Compare Scans Over Time

Track compliance improvement by comparing scan reports:

```powershell
# Generate baseline
azqr scan -s <sub-id> --output-name baseline

# Later, generate new scan
azqr scan -s <sub-id> --output-name current

# Compare
azqr compare --file1 baseline.xlsx --file2 current.xlsx --output comparison.txt
```

### Filtering Recommendations

Create a YAML filter file to exclude specific items:

```yaml
azqr:
  include:
    subscriptions:
      - <subscription-id>
    resourceGroups:
      - /subscriptions/<sub>/resourceGroups/<rg>
  exclude:
    recommendations:
      - <recommendation-id>
    services:
      - /subscriptions/<sub>/resourceGroups/<rg>/providers/<provider>/<name>
```

Apply with: `azqr scan --filters filter.yaml`

### Internal Plugins

Enable additional analysis:

```powershell
# OpenAI throttling analysis
azqr scan -s <sub-id> --plugin openai-throttling

# Carbon emissions tracking
azqr scan -s <sub-id> --plugin carbon-emissions

# Availability zone mapping
azqr scan -s <sub-id> --plugin zone-mapping
```

## Tools Used

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_extension_azqr` | Run azqr scans via Azure MCP |
| `mcp_azure_mcp_subscription_list` | List available subscriptions |
| `mcp_azure_mcp_group_list` | List resource groups in subscription |
| `run_in_terminal` | Execute azqr CLI commands directly |

## Troubleshooting

| Issue | Symptom | Solution |
|-------|---------|----------|
| Cost analysis fails | `AccountCostDisabled` error | Run with `-c=false` flag |
| Permission denied | 403 errors during scan | Verify Reader role on scope |
| Not authenticated | `AADSTS` errors | Run `az login` first |
| azqr not found | Command not recognized | Install via `winget install azqr` |
| Slow scan | Scan takes very long | Use resource group scope or service filter |

## Example Prompts

- "Check my Azure subscription for compliance issues"
- "Run azqr on my production resource group"
- "What Azure resources don't follow best practices?"
- "Assess my storage accounts for security issues"
- "Compare my Azure compliance from last month"

## Reference Documentation

- [Recommendation Categories](references/RECOMMENDATIONS.md)
- [Remediation Patterns](references/REMEDIATION-PATTERNS.md)
- [azqr CLI Reference](references/CLI-REFERENCE.md)
- [Scan Scripts (PowerShell)](scripts/azqr-scan.ps1)
- [Scan Scripts (Bash)](scripts/azqr-scan.sh)
- [Azure Quick Review Documentation](https://azure.github.io/azqr/docs/)
- [Azure Proactive Resiliency Library](https://aka.ms/aprl)
