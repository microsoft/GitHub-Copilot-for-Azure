# Azure Front Door Standard vs Premium Tier

## Tier Overview

Azure Front Door has two current tiers. Classic Front Door is legacy and should be migrated.

### Standard Tier

Best for: CDN and global load balancing without WAF or Private Link requirements.

- Global HTTP/HTTPS routing with anycast
- Integrated CDN with edge caching
- Custom domains with managed TLS certificates
- Rules engine for URL rewrite, redirect, header modification
- Basic real-time logging and analytics
- Built-in DDoS protection (infrastructure level)

### Premium Tier

Best for: Enterprise workloads requiring WAF, Private Link, and advanced security.

Everything in Standard, plus:
- **WAF integration** — Managed rule sets (OWASP, bot protection), custom rules, geo-filtering, rate limiting
- **Private Link origins** — Secure, private connectivity to backends (App Service, Storage, ILB)
- **Bot protection** — Microsoft-managed bot manager rule set
- **Enhanced analytics** — Detailed traffic, WAF, and security reports
- **Advanced real-time logs** — Extended fields for security analysis

## Feature Comparison Matrix

| Feature | Standard | Premium |
|---------|----------|---------|
| **Routing** | | |
| Global anycast routing | ✅ | ✅ |
| Multi-origin load balancing | ✅ | ✅ |
| Health probes | ✅ | ✅ |
| Session affinity | ✅ | ✅ |
| HTTP→HTTPS redirect | ✅ | ✅ |
| Custom domains | 100 | 500 |
| **Caching** | | |
| Edge caching | ✅ | ✅ |
| Query string handling | ✅ | ✅ |
| Compression (gzip, brotli) | ✅ | ✅ |
| Cache purge | ✅ | ✅ |
| **Rules Engine** | | |
| URL rewrite | ✅ | ✅ |
| URL redirect | ✅ | ✅ |
| Header modification | ✅ | ✅ |
| Max rule sets | 25 | 50 |
| Max rules per set | 25 | 25 |
| **Security** | | |
| Managed TLS certificates | ✅ | ✅ |
| Custom TLS certificates | ✅ | ✅ |
| TLS 1.2+ enforcement | ✅ | ✅ |
| Infrastructure DDoS | ✅ | ✅ |
| WAF managed rules | ❌ | ✅ |
| WAF custom rules | ❌ | ✅ |
| Bot protection | ❌ | ✅ |
| Geo-filtering (WAF) | ❌ | ✅ |
| Rate limiting (WAF) | ❌ | ✅ |
| **Connectivity** | | |
| Public origins | ✅ | ✅ |
| Private Link origins | ❌ | ✅ |
| **Analytics** | | |
| Built-in reports | Basic | Advanced |
| Real-time logs | Basic | Extended |
| Health probe logs | ✅ | ✅ |
| WAF logs | N/A | ✅ |

## Decision Tree

```
Do you need WAF at the edge?
├── Yes → Premium
└── No
    ├── Do you need Private Link origins?
    │   ├── Yes → Premium
    │   └── No
    │       ├── Do you need bot protection?
    │       │   ├── Yes → Premium
    │       │   └── No → Standard (sufficient)
    │       └── More than 100 custom domains?
    │           ├── Yes → Premium
    │           └── No → Standard
```

## Migration from Classic to Standard/Premium

### Why Migrate

- Classic Front Door is being deprecated
- Standard/Premium offer better CDN integration, rules engine, and Private Link
- Unified management experience

### Migration Steps

```bash
# Step 1: Validate Classic FD configuration compatibility
az afd profile show --profile-name <classic-fd> -g <rg>

# Step 2: Use the Azure portal migration tool
# Navigate to: Front Door (classic) → Overview → Migrate button
# Or use the CLI migration preview:
az afd profile upgrade \
  --profile-name <classic-fd> \
  -g <rg> \
  --sku Premium_AzureFrontDoor
```

### Migration Considerations

| Concern | Detail |
|---------|--------|
| Downtime | Zero-downtime migration (DNS cutover) |
| Custom domains | Migrated automatically |
| WAF policies | Migrated to new WAF policy format |
| Rules engine | Migrated to new rule set format |
| Backend pools | Become origin groups |
| Routing rules | Become routes |

## Cost Comparison

| Component | Standard | Premium |
|-----------|----------|---------|
| Base fee (per month) | Lower | Higher |
| Per-request charge | Same | Same |
| Data transfer (outbound) | Same | Same |
| WAF requests | N/A | Per-request WAF fee |
| Private Link | N/A | Included (origin data transfer) |

**Cost optimization tips:**
1. Start with Standard; upgrade to Premium only when needed
2. Use caching aggressively to reduce origin requests
3. Enable compression to reduce data transfer
4. Set appropriate cache durations for static content
5. Premium WAF + Private Link may replace App Gateway WAF (consolidation savings)

## Source Documentation

- [Azure Front Door tiers](https://learn.microsoft.com/azure/frontdoor/standard-premium/tier-comparison)
- [Migrate from Classic to Standard/Premium](https://learn.microsoft.com/azure/frontdoor/tier-migration)
- [Front Door pricing](https://azure.microsoft.com/pricing/details/frontdoor/)
