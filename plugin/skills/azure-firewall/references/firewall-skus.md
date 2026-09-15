# Azure Firewall SKU Comparison

Azure Firewall offers three SKUs — Basic, Standard, and Premium — each targeting different workload profiles. Choosing the right SKU at deployment is critical because upgrading from Basic to Standard requires redeployment; Standard to Premium can be upgraded in-place.

## Feature Matrix

| Feature | Basic | Standard | Premium |
|---------|-------|----------|---------|
| **Intended workload** | SMB, low-throughput | Most production workloads | High-security, regulated |
| **Throughput** | Up to 250 Mbps | Up to 30 Gbps | Up to 100 Gbps |
| **Availability Zones** | No | Yes | Yes |
| **DNAT rules** | Limited | Yes | Yes |
| **Network rules (L3/L4)** | Yes | Yes | Yes |
| **Application rules (L7)** | Yes (FQDN-based) | Yes | Yes |
| **Threat intelligence** | Alert only | Alert or Deny | Alert or Deny |
| **DNS proxy** | No | Yes | Yes |
| **FQDN in network rules** | No | Yes (requires DNS proxy) | Yes |
| **FQDN tags** | No | Yes | Yes |
| **Web categories** | No | No | Yes |
| **URL filtering** | No | No | Yes (full path) |
| **IDPS** | No | No | Yes |
| **TLS inspection** | No | No | Yes |
| **Explicit proxy** | No | No | Yes |
| **Forced tunneling** | No | Yes | Yes |
| **Multiple public IPs** | No | Yes (up to 250) | Yes (up to 250) |
| **Firewall policy** | Yes | Yes | Yes |
| **Azure Firewall Manager** | Yes | Yes | Yes |
| **Structured logs** | Yes | Yes | Yes |
| **Active FTP support** | No | Yes | Yes |

## SKU Selection Guidance

### Choose Basic when

- Throughput needs are under 250 Mbps
- You need basic L3/L4 filtering with FQDN-based application rules
- Budget is constrained and advanced features are not required
- The workload is dev/test or a small branch office
- You do not need availability zones

### Choose Standard when

- Production workloads requiring high availability and zone redundancy
- You need threat intelligence-based filtering (alert and deny)
- DNS proxy functionality is required for FQDN filtering in network rules
- Throughput up to 30 Gbps is sufficient
- You need DNAT for inbound traffic or multiple public IPs for SNAT scaling
- Forced tunneling to an on-premises appliance is required

### Choose Premium when

- Regulatory or compliance requirements demand TLS inspection of outbound traffic
- IDPS (Intrusion Detection and Prevention) is required for deep packet inspection
- URL-level filtering (beyond FQDN) is needed — e.g., block `example.com/admin` but allow `example.com`
- Web category filtering is required (e.g., block gambling, social media)
- The workload handles sensitive data and needs the highest throughput (up to 100 Gbps)
- You are operating in industries like finance, healthcare, or government

## Throughput and Scaling

- **Basic**: Fixed at ~250 Mbps; no autoscaling
- **Standard**: Baseline ~30 Gbps; can burst higher with autoscaling; scales based on CPU and throughput
- **Premium**: Baseline ~100 Gbps with TLS inspection disabled; TLS inspection reduces effective throughput

Scaling considerations:
- Azure Firewall autoscales within its SKU limits based on load
- Use multiple public IPs to increase SNAT port capacity: 2,496 ports per public IP per backend instance
- For maximum SNAT capacity, deploy with up to 250 public IPs
- Monitor the `FirewallHealth`, `Throughput`, and `SNATPortUtilization` metrics

## Pricing Tiers

All SKUs have two cost components:
1. **Deployment (fixed hourly)**: Charged per firewall instance per hour
2. **Data processing**: Charged per GB processed by the firewall

Approximate monthly costs (check [Azure pricing](https://azure.microsoft.com/pricing/details/azure-firewall/) for current rates):
- **Basic**: ~$0.395/hr deployment + $0.065/GB data processed
- **Standard**: ~$1.25/hr deployment + $0.016/GB data processed
- **Premium**: ~$1.75/hr deployment + $0.016/GB data processed

Cost optimization tips:
- Use Azure Firewall Manager to share a single firewall policy across multiple firewalls
- For dev/test environments, consider stopping the firewall during off-hours with `az network firewall update --name <fw> --resource-group <rg> --no-wait` and deallocating IPs
- Basic SKU has higher per-GB cost — cross the cost-efficiency threshold at moderate traffic volumes where Standard becomes cheaper

## Upgrade Paths

- **Basic → Standard**: Requires delete and redeploy (no in-place upgrade)
- **Standard → Premium**: In-place upgrade supported via `az network firewall update --sku AZFW_Hub --tier Premium` or through the portal
- **Premium → Standard**: Downgrade is not supported; must redeploy
- When upgrading to Premium, ensure a Key Vault-managed intermediate CA certificate is provisioned if TLS inspection will be used

## Common Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| Low throughput | SKU limits hit | Check `Throughput` metric; consider upgrading SKU |
| SNAT port exhaustion | Not enough public IPs | Add public IPs; monitor `SNATPortUtilization` |
| Feature unavailable | Wrong SKU | Verify SKU supports the feature (see matrix above) |
| Cannot enable IDPS | Running Standard SKU | Upgrade to Premium |
| Cannot enable forced tunneling | Running Basic SKU | Deploy Standard or Premium |

## Related

- [rule-types.md](rule-types.md) — How rule processing works across all SKUs
- [idps.md](idps.md) — Premium-only IDPS and TLS inspection details
- [Azure Firewall SKU documentation](https://learn.microsoft.com/azure/firewall/choose-firewall-sku)
