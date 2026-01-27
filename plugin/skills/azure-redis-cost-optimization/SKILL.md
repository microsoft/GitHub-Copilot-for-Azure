---
name: azure-redis-cost-optimization
description: Interactive cost optimization analysis for Azure Redis caches. Supports subscription-level audits or filtered searches by subscription prefix. Analyzes SKU tiers, provisioning states, tags, and age to identify cost savings opportunities across Azure Managed Redis, Azure Cache for Redis, and Redis Enterprise services.
---

# Azure Redis Cost Optimization & Cleanup

Interactive analysis tool to identify cost savings opportunities in Azure Redis deployments through conversational queries and targeted scans.

## Skill Activation Triggers

**Use this skill immediately when the user asks to:**
- "Analyze Redis costs in my subscription"
- "Show me expensive Redis caches that can be optimized"
- "Audit Redis caches in subscriptions starting with 'CacheTeam'"
- "Find Redis caches I can clean up to save money"
- "Check Redis costs across all my subscriptions"
- "Which Redis caches are in failed state?"
- "Review Redis resources for my team's subscriptions"
- "Find Redis cost optimization opportunities"

**Key Indicators:**
- Mentions "cost", "expensive", "optimize", or "savings" with Redis
- References subscription prefix or multiple subscriptions
- Questions about Redis resource cleanup or waste
- Requests for cost analysis or audit reports

## Overview

This skill provides **interactive, conversational cost optimization** for Azure Redis resources. It guides users through scoped analysis by:

1. **Accepting flexible input**: Subscription ID, tenant ID, or subscription name prefix
2. **Asking clarifying questions**: Subscription-level vs. all subscriptions, specific filters
3. **Analyzing Redis caches**: SKU tiers, provisioning states, tags, age
4. **Generating targeted reports**: Prioritized recommendations with cost impact

## Initial Input Options

The skill accepts any of these identifiers to start the analysis:

| Input Type | Example | Use Case |
|------------|---------|----------|
| **Subscription ID** | `a1b2c3d4-...` | Analyze specific subscription |
| **Subscription Name** | `Production-Environment` | User-friendly identifier |
| **Subscription Prefix** | `CacheTeam -` | Analyze all team subscriptions |
| **Tenant ID** | `tenant-guid` | Analyze entire organization |
| **"All my subscriptions"** | (keyword) | Scan all accessible subscriptions |

## Analysis Workflow

1. **Identify subscriptions** - Filter by ID, name, or prefix
2. **Ask clarifying questions** - Scope (summary/detailed), focus area (all/critical/savings/compliance)
3. **Scan Redis resources** - Use `mcp_azure_mcp_redis` tool to list caches
4. **Apply optimization rules** - Detect failed states, oversized tiers, missing tags
5. **Generate report** - Present findings with actionable recommendations and cost impact



## Cost Optimization Rules

When analyzing each cache, apply these prioritized rules:

| Priority | Rule | Detection Logic | Recommendation | Avg Savings |
|----------|------|----------------|----------------|-------------|
| 🔴 Critical | Failed Cache | `provisioningState == 'Failed'` | Delete immediately | $50-300/mo |
| 🔴 Critical | Stuck Creating | `provisioningState == 'Creating'` AND age >4 hours | Delete/support ticket | $50-300/mo |
| 🟠 High | Premium in Dev | `sku.name == 'Premium'` AND `tags.environment in ['dev','test','staging']` | Downgrade to Standard | $175/mo |
| 🟠 High | Enterprise Unused | `sku.name startsWith 'Enterprise'` AND no modules/clustering | Downgrade to Premium/Standard | $300-1000/mo |
| 🟠 High | Old Test Cache | `tags.purpose == 'test'` AND age >60 days | Delete or downgrade | $50-150/mo |
| 🟡 Medium | Large Dev Cache | `sku.capacity >3` AND `tags.environment == 'dev'` | Reduce size | $100-300/mo |
| 🟡 Medium | No Expiration Tag | Missing `expirationDate` or `ttl` tag | Add cleanup policy | N/A |
| 🟢 Low | Untagged Resource | Missing required tags (`environment`, `owner`) | Apply tags | N/A |
| 🟢 Low | Old Cache | Age >365 days | Review if still needed | Variable |

## Report Formats

### Format A: Subscription-Level Summary
Quick overview of costs and issues per subscription (use for multi-subscription scans).

```
Redis Cost Optimization Report
Tenant: Contoso Corp
Generated: January 26, 2026
Subscriptions Analyzed: 3 (filtered by prefix "CacheTeam -")

═══════════════════════════════════════════════════════════════════

EXECUTIVE SUMMARY
- Total Redis Caches: 20
- Current Monthly Cost: $3,625
- Potential Savings: $875/month (24.1%)
- Critical Issues: 4 caches requiring immediate action

BY SUBSCRIPTION
┌─────────────────────┬──────┬──────────┬─────────────┬──────────┐
│ Subscription        │Caches│  Cost/Mo │  Savings/Mo │ Priority │
├─────────────────────┼──────┼──────────┼─────────────┼──────────┤
│ CacheTeam - Alpha   │   5  │   $850   │   $425      │    🔴    │
│ CacheTeam - Beta    │   3  │   $375   │     $0      │    🟢    │
│ CacheTeam - Prod    │  12  │ $2,400   │   $450      │    🟠    │
└─────────────────────┴──────┴──────────┴─────────────┴──────────┘

CRITICAL ISSUES (🔴 Immediate Action Required)
- CacheTeam - Alpha: 1 failed cache, 2 Premium in dev
- CacheTeam - Prod: 1 old test cache (180 days)

Next Steps:
1. Review detailed analysis for CacheTeam - Alpha (type 'analyze alpha')
2. Review detailed analysis for CacheTeam - Prod (type 'analyze prod')
3. Generate full report with all recommendations (type 'full report')
```

### Format B: Detailed Cache Analysis
Individual cache breakdown with specific recommendations.

```
Redis Cost Optimization Report - Detailed Analysis
Subscription: CacheTeam - Alpha (a1b2c3d4-...)
Generated: January 26, 2026

═══════════════════════════════════════════════════════════════════

SUBSCRIPTION OVERVIEW
- Total Caches: 5
- Current Monthly Cost: $850
- Potential Savings: $425/month (50%)
- Critical Issues: 3

CRITICAL ISSUES (🔴 Immediate Action)

[1] dev-redis-test-01
    SKU: Premium P1 (6GB)
    State: Failed
    Location: eastus
    Age: 12 days
    Cost: $300/month
    Tags: environment=dev, owner=john@contoso.com
    
    ❌ Problem: Cache in Failed state for 12 days
    💡 Recommendation: Delete immediately
    💰 Savings: $300/month
    
    Action: az redis delete --name dev-redis-test-01 --resource-group dev-rg

[2] dev-api-cache
    SKU: Premium P1 (6GB)
    State: Running
    Location: eastus
    Age: 120 days
    Cost: $300/month
    Tags: environment=dev, owner=jane@contoso.com
    
    ⚠️ Problem: Premium tier in dev environment
    💡 Recommendation: Downgrade to Standard C3 (6GB)
    💰 Savings: $175/month
    
    Next Steps:
    1. Verify with owner: jane@contoso.com
    2. Schedule maintenance window
    3. az redis update --name dev-api-cache --resource-group dev-rg --sku Standard --size 6GB

HIGH PRIORITY (🟠 Review This Week)

[3] test-cache-q3-2025
    SKU: Standard C2 (2.5GB)
    State: Running
    Location: westus
    Age: 180 days
    Cost: $100/month
    Tags: purpose=test, temporary=true, created=2025-07-15
    
    ⚠️ Problem: Temporary test cache running for 6 months
    💡 Recommendation: Delete if no longer needed
    💰 Savings: $100/month
    
    Action: Confirm with team, then delete

HEALTHY CACHES (🟢 No Action Needed)

[4] prod-session-cache
    SKU: Standard C3 (6GB)
    State: Running
    Cost: $125/month
    Tags: environment=prod, owner=team@contoso.com
    ✓ Appropriate tier for production workload

[5] staging-api-cache
    SKU: Standard C1 (1GB)
    State: Running
    Cost: $75/month
    Tags: environment=staging
    ✓ Cost-optimized for staging environment

═══════════════════════════════════════════════════════════════════

SAVINGS SUMMARY
- Critical issues resolved: $425/month
- Total potential savings: $425/month (50% reduction)
- New monthly cost: $425/month

RECOMMENDED ACTIONS
1. [Immediate] Delete dev-redis-test-01 (Failed state)
2. [This Week] Downgrade dev-api-cache to Standard
3. [This Week] Confirm test-cache-q3-2025 still needed, delete if not

Would you like me to:
  A. Generate Azure CLI commands for these actions
  B. Analyze another subscription
  C. Export full report to CSV
  D. Set up automated monitoring

Please select (A/B/C/D):
```

Tools & Commands

**MCP Tool:** `mcp_azure_mcp_redis` with command `redis_list` (parameter: `subscription`)

**Azure CLI Equivalents:**
- `az account list` - List subscriptions
- `az redis list --subscription <id>` - List Redis caches
- `az redis show` - Get cache details
- `az redis delete` - Remove cache