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
    3. az redis update --name dev-api-cache --resource-group dev-rg --sku Standard --vm-size C3

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