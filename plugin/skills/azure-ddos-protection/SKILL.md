---
name: azure-ddos-protection
description: "Configure and manage Azure DDoS Protection (Network Protection and IP Protection) to mitigate volumetric, protocol, and application-layer DDoS attacks on Azure resources. WHEN: DDoS, DDoS protection, DDoS attack, volumetric attack, protocol attack, application layer attack, DDoS mitigation, DDoS plan, DDoS rapid response. DO NOT USE FOR: web app security (use azure-waf), network filtering rules (use azure-firewall), NSG rules (use azure-virtual-network)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure DDoS Protection

Azure DDoS Protection defends Azure resources against distributed denial-of-service (DDoS) attacks. It provides always-on traffic monitoring, automatic attack mitigation, and integration with Azure Monitor for real-time telemetry. Azure offers two tiers: DDoS Network Protection (full-featured, VNet-scoped) and DDoS IP Protection (per-IP, simplified).

## When to Use This Skill

- Enabling DDoS protection on Azure virtual networks or individual public IPs
- Choosing between DDoS Network Protection and DDoS IP Protection tiers
- Reviewing DDoS metrics and attack mitigation telemetry
- Configuring Azure Monitor alerts for DDoS attack events
- Engaging the DDoS Rapid Response (DRR) team during active attacks
- Understanding how Azure mitigates volumetric, protocol, and application-layer attacks
- Planning cost protection and SLA guarantees for DDoS-protected resources
- Reviewing DDoS mitigation reports and flow logs after an attack
- Integrating DDoS protection with Azure Firewall and WAF for defense-in-depth

## Rules

1. DDoS Network Protection is applied at the VNet level and protects all public IPs within that VNet. DDoS IP Protection is applied per public IP address. Confirm which model the user needs.
2. Azure DDoS Infrastructure Protection (basic, free tier) is automatically enabled for all Azure services — it protects the Azure platform but does not provide per-customer tuning, metrics, or SLA guarantees.
3. DDoS Network Protection includes cost protection (credit for resource scale-out during attacks), DDoS Rapid Response access, and WAF discount. DDoS IP Protection does not include these benefits.
4. DDoS Protection does not inspect application payloads — recommend `azure-waf` for Layer 7 application protection (SQL injection, XSS) and `azure-firewall` for network-level filtering.
5. DDoS diagnostic logs must be configured explicitly via Azure Monitor diagnostic settings — they are not enabled by default.
6. Always recommend tagging protected public IPs with descriptive metadata so mitigation reports and alerts can be quickly correlated to specific workloads.
7. The DDoS Rapid Response (DRR) team requires DDoS Network Protection tier. Ensure the user has the correct tier before advising DRR engagement.
8. DDoS mitigation is triggered automatically when traffic exceeds learned baselines — there is no manual trigger. Baseline learning requires a few days of normal traffic patterns.
9. For production workloads exposed to the internet, recommend DDoS Network Protection over DDoS IP Protection for the SLA, cost protection, and DRR access.
10. Cross-reference with `azure-waf` for application-layer DDoS protection and with `azure-firewall` for centralized network security in a defense-in-depth strategy.

## MCP Tools

| Tool | Resource | Use |
|------|----------|-----|
| `azure__network` | `ddos_protection_plan_list` | List all DDoS protection plans in a subscription or resource group |

## CLI Fallback

```bash
# List DDoS protection plans in a subscription
az network ddos-protection list -o table

# Create a DDoS protection plan
az network ddos-protection create \
  --name <plan-name> \
  --resource-group <rg-name> \
  --location <region>

# Associate DDoS plan with a VNet
az network vnet update \
  --name <vnet-name> \
  --resource-group <rg-name> \
  --ddos-protection-plan <plan-resource-id> \
  --ddos-protection true

# Enable DDoS IP Protection on a public IP
az network public-ip update \
  --name <pip-name> \
  --resource-group <rg-name> \
  --ddos-protection-mode Enabled

# View DDoS protection status of a VNet
az network vnet show \
  --name <vnet-name> \
  --resource-group <rg-name> \
  --query '{ddosPlan:ddosProtectionPlan.id, ddosEnabled:enableDdosProtection}'

# Configure DDoS diagnostic logging
az monitor diagnostic-settings create \
  --name "ddos-diag" \
  --resource <public-ip-resource-id> \
  --workspace <log-analytics-workspace-id> \
  --logs '[{"category":"DDoSProtectionNotifications","enabled":true},{"category":"DDoSMitigationFlowLogs","enabled":true},{"category":"DDoSMitigationReports","enabled":true}]' \
  --metrics '[{"category":"AllMetrics","enabled":true}]'

# Create a DDoS alert rule (under-attack notification)
az monitor metrics alert create \
  --name "ddos-under-attack" \
  --resource-group <rg-name> \
  --scopes <public-ip-resource-id> \
  --condition "avg IfUnderDDoSAttack > 0" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action <action-group-id> \
  --description "Alert when DDoS attack is detected"

# Show DDoS protection plan details
az network ddos-protection show \
  --name <plan-name> \
  --resource-group <rg-name>
```

## Key Concepts

- **DDoS Network Protection**: VNet-level protection; includes adaptive tuning, attack telemetry, cost protection (resource scale-out credits), DDoS Rapid Response (DRR), WAF discount, and SLA guarantee
- **DDoS IP Protection**: Per-public-IP protection; includes adaptive tuning and attack telemetry but no cost protection, no DRR, no WAF discount
- **Infrastructure Protection**: Free, always-on platform-level protection for all Azure services; protects the Azure backbone but not individual customer workloads
- **Attack types**: Volumetric (UDP flood, DNS amplification — saturate bandwidth), Protocol (SYN flood, Smurf — exhaust state tables), Application layer (HTTP floods — overwhelm application logic)
- **Mitigation trigger**: Automatic; Azure learns the traffic baseline over days and triggers mitigation when traffic anomalies exceed thresholds
- **DDoS Rapid Response (DRR)**: Microsoft's specialist team that can assist during active attacks; requires DDoS Network Protection; engagement is initiated via a support ticket with Severity A
- **Cost protection**: DDoS Network Protection credits the customer for resource scale-out costs incurred during a documented DDoS attack (e.g., Application Gateway autoscale, VM scale sets, bandwidth)
- **Telemetry**: Metrics include `IfUnderDDoSAttack`, `InboundPacketsDroppedDDoS`, `InboundBytesDroppedDDoS`, `InboundPacketsForwardedDDoS`; available per public IP
- **Diagnostic logs**: Three log categories — DDoSProtectionNotifications (attack start/stop), DDoSMitigationFlowLogs (per-flow details), DDoSMitigationReports (5-minute and post-attack summaries)
- **Defense-in-depth**: Combine DDoS Protection (volumetric/protocol mitigation) + Azure Firewall (network filtering) + WAF (application layer protection) for comprehensive security
- **Pricing**: DDoS Network Protection has a fixed monthly fee covering up to 100 public IPs; DDoS IP Protection is per-IP pricing suited for smaller deployments

## References

- [ddos-tiers.md](references/ddos-tiers.md) — DDoS Network Protection vs DDoS IP Protection comparison
- [telemetry.md](references/telemetry.md) — DDoS metrics, diagnostic logs, and Azure Monitor integration
- [rapid-response.md](references/rapid-response.md) — DDoS Rapid Response team engagement
- [attack-types.md](references/attack-types.md) — Attack types and how Azure mitigates each
- [Azure DDoS Protection documentation](https://learn.microsoft.com/azure/ddos-protection/ddos-protection-overview)
- [Azure DDoS Protection pricing](https://azure.microsoft.com/pricing/details/ddos-protection/)
- [Azure DDoS Protection best practices](https://learn.microsoft.com/azure/ddos-protection/fundamental-best-practices)
