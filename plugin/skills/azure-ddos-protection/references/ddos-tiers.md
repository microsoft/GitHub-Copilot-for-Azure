# Azure DDoS Protection Tiers

Azure offers multiple tiers of DDoS protection. Understanding the differences is essential for selecting the right level of protection for your workloads.

## Tier Comparison

| Feature | Infrastructure Protection | DDoS IP Protection | DDoS Network Protection |
|---------|--------------------------|-------------------|------------------------|
| **Cost** | Free (included) | Per-IP monthly fee | Fixed monthly fee + overage |
| **Scope** | Azure platform | Individual public IP | Entire VNet (all public IPs) |
| **Automatic mitigation** | Yes (platform-level) | Yes (per-IP tuning) | Yes (per-IP tuning) |
| **Traffic baseline learning** | No | Yes | Yes |
| **Adaptive tuning** | No | Yes | Yes |
| **Attack metrics** | No | Yes (per-IP) | Yes (per-IP) |
| **Diagnostic logs** | No | Yes | Yes |
| **Mitigation reports** | No | Yes | Yes |
| **Mitigation flow logs** | No | Yes | Yes |
| **Azure Monitor alerts** | No | Yes | Yes |
| **DDoS Rapid Response (DRR)** | No | **No** | **Yes** |
| **Cost protection (credits)** | No | **No** | **Yes** |
| **WAF discount** | No | **No** | **Yes** |
| **SLA guarantee** | Azure SLA | Service SLA | **DDoS-specific SLA** |
| **Public IPs covered** | All Azure resources | Selected IPs only | All IPs in protected VNets |
| **Max protected resources** | N/A | Per-IP basis | Up to 100 public IPs (default) |

## Infrastructure Protection (Free Tier)

Azure DDoS Infrastructure Protection is automatically enabled for every Azure service at no additional cost.

### What it provides
- **Platform-level protection**: Protects the Azure backbone infrastructure from large-scale volumetric attacks
- **Always-on monitoring**: Traffic is always monitored at the Azure edge
- **Automatic mitigation**: Known attack patterns are mitigated at the Azure edge before reaching customer resources

### What it does NOT provide
- No per-customer traffic baselining or adaptive tuning
- No attack metrics, logs, or reports for individual resources
- No alerting capabilities
- No DDoS Rapid Response support
- No cost protection or SLA guarantee
- No visibility into whether your specific resources are being attacked

### When Infrastructure Protection is sufficient
- Dev/test environments not exposed to the public internet
- Internal workloads accessed only via private endpoints or VPN
- Resources behind Azure Firewall with no direct public IP exposure

## DDoS IP Protection

DDoS IP Protection provides per-IP protection with adaptive tuning and attack telemetry, billed on a per-IP basis.

### Key characteristics
- Enabled on individual public IP addresses
- Per-IP pricing model — cost scales linearly with the number of protected IPs
- Includes all monitoring and telemetry features (metrics, logs, reports)
- Does **not** include DDoS Rapid Response, cost protection, or WAF discount

### When to choose DDoS IP Protection
- **Small deployments**: Protecting 1-10 public IPs where per-IP pricing is cheaper than the fixed Network Protection fee
- **Budget-sensitive workloads**: When DRR, cost protection, and WAF discount are not needed
- **Non-critical public endpoints**: Workloads where the advanced support tier of Network Protection is not justified
- **Multi-VNet deployments**: When you want to protect specific IPs across different VNets without a DDoS plan per VNet

### Enable DDoS IP Protection

```bash
# Enable on a public IP
az network public-ip update \
  --name <pip-name> \
  --resource-group <rg-name> \
  --ddos-protection-mode Enabled

# Verify protection mode
az network public-ip show \
  --name <pip-name> \
  --resource-group <rg-name> \
  --query "ddosSettings"
```

## DDoS Network Protection

DDoS Network Protection provides comprehensive VNet-level protection with the highest tier of DDoS defense capabilities.

### Key characteristics
- Enabled at the VNet level via a DDoS protection plan
- Fixed monthly fee covering up to 100 public IPs across all VNets associated with the plan
- Includes DDoS Rapid Response (DRR) for expert assistance during active attacks
- Includes cost protection — Azure credits resource scale-out costs incurred during documented DDoS attacks
- Includes a discount on WAF (Web Application Firewall) licensing
- Provides a DDoS-specific SLA with financial guarantee

### When to choose DDoS Network Protection
- **Production workloads with public endpoints**: Any internet-facing production service
- **Regulated industries**: Finance, healthcare, government where DDoS resilience is a compliance requirement
- **Large deployments**: When protecting 15+ public IPs, Network Protection's fixed price is usually cheaper than per-IP pricing
- **Business-critical applications**: Where DDoS Rapid Response support and cost protection justify the investment
- **Organizations with WAF**: The WAF discount offsets part of the DDoS protection cost

### Enable DDoS Network Protection

```bash
# Create a DDoS protection plan
az network ddos-protection create \
  --name <plan-name> \
  --resource-group <rg-name> \
  --location <region>

# Associate the plan with a VNet
az network vnet update \
  --name <vnet-name> \
  --resource-group <rg-name> \
  --ddos-protection-plan <plan-resource-id> \
  --ddos-protection true

# A single plan can protect VNets across multiple resource groups and regions
# Associate additional VNets with the same plan
az network vnet update \
  --name <vnet2-name> \
  --resource-group <rg2-name> \
  --ddos-protection-plan <plan-resource-id> \
  --ddos-protection true
```

## Cost Comparison

### Pricing model

| Tier | Pricing structure |
|------|-------------------|
| Infrastructure Protection | Free |
| DDoS IP Protection | ~$199/month per protected public IP |
| DDoS Network Protection | ~$2,944/month (covers up to 100 public IPs) + overage per additional IP |

### Break-even analysis

- At **1 public IP**: IP Protection (~$199/mo) is significantly cheaper than Network Protection (~$2,944/mo)
- At **15 public IPs**: IP Protection (~$2,985/mo) roughly equals Network Protection (~$2,944/mo)
- At **15+ public IPs**: Network Protection becomes cheaper AND includes DRR + cost protection + WAF discount
- Factor in the WAF discount when evaluating — if you also use WAF, Network Protection's effective cost is lower

### Cost protection benefit (Network Protection only)

During a documented DDoS attack, if your resources scale out (e.g., Application Gateway autoscales, VM scale sets add instances, bandwidth spikes), Azure credits the incremental costs. This can save thousands of dollars during a sustained attack.

Eligible cost protection resources:
- Application Gateway (including WAF v2)
- Azure Load Balancer (Standard)
- Azure Public IP Addresses
- Virtual Machine Scale Sets
- Bandwidth (egress) charges

## Decision Matrix

| Scenario | Recommended tier |
|----------|-----------------|
| Dev/test, no public endpoints | Infrastructure Protection (free) |
| 1-5 public IPs, non-critical | DDoS IP Protection |
| 1-14 public IPs, mission-critical | DDoS Network Protection (for DRR + cost protection) |
| 15+ public IPs, any criticality | DDoS Network Protection |
| Regulated industry (any count) | DDoS Network Protection |
| Using WAF alongside DDoS | DDoS Network Protection (WAF discount) |

## Common Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| No DDoS metrics visible | IP Protection or Network Protection not enabled | Verify ddos-protection is enabled on the VNet or IP |
| Cannot engage DDoS Rapid Response | Using IP Protection tier (DRR requires Network Protection) | Upgrade to DDoS Network Protection |
| High DDoS protection cost | Too many IPs on IP Protection | Switch to Network Protection if 15+ IPs |
| VNet shows "DDoS protection: Disabled" | Plan not associated | Run `az network vnet update` with `--ddos-protection true` |
| Cost protection claim denied | Attack not documented in DDoS mitigation logs | Ensure diagnostic logging is enabled BEFORE an attack |

## Related

- [telemetry.md](telemetry.md) — Metrics and diagnostic logs for monitoring
- [rapid-response.md](rapid-response.md) — DRR engagement (Network Protection only)
- [attack-types.md](attack-types.md) — Types of attacks mitigated by each tier
- [Azure DDoS Protection pricing](https://azure.microsoft.com/pricing/details/ddos-protection/)
