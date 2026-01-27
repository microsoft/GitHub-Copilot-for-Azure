# Azure Redis Cost Optimization

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
Use [redis-subscription-level-report.md](./report-content/redis-subscription-level-report.md) as a template 

### Format B: Detailed Cache Analysis
Individual cache breakdown with specific recommendations.
Use [redis-detailed-cache-analysis.md](./report-content/redis-detailed-cache-analysis.md) as a template 

Tools & Commands

**MCP Tool:** `mcp_azure_mcp_redis` with command `redis_list` (parameter: `subscription`)

**Azure CLI Equivalents:**
- `az account list` - List subscriptions
- `az redis list --subscription <id>` - List Redis caches
- `az redis show` - Get cache details
- `az redis delete` - Remove cache