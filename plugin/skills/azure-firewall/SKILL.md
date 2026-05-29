---
name: azure-firewall
description: "Manage Azure Firewall (Basic, Standard, Premium) and Azure Firewall Manager for centralized network filtering, DNAT/SNAT, threat intelligence, and IDPS. WHEN: azure firewall, firewall rules, firewall policy, DNAT rule, network rule, application rule, threat intelligence, IDPS, TLS inspection, forced tunneling firewall, firewall manager, central firewall management. DO NOT USE FOR: NSG rules on subnets/NICs (use azure-virtual-network), WAF for web apps (use azure-waf), DDoS protection (use azure-ddos-protection)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Firewall

Azure Firewall is a managed, cloud-based network security service that protects Azure Virtual Network resources. It provides centralized network and application-level filtering with built-in high availability, unrestricted cloud scalability, and integration with Azure Monitor. Azure Firewall Manager enables centralized security policy management across multiple firewall instances.

## When to Use This Skill

- Deploying or configuring Azure Firewall in any SKU (Basic, Standard, Premium)
- Creating or modifying DNAT rules, network rules, or application rules
- Configuring rule collection groups and managing rule processing priority
- Setting up firewall policies or migrating from classic rules to firewall policies
- Enabling threat intelligence-based filtering on firewall traffic
- Configuring IDPS (Intrusion Detection and Prevention System) on Premium SKU
- Setting up TLS inspection for outbound or east-west traffic
- Configuring forced tunneling for Azure Firewall
- Managing multiple firewalls centrally with Azure Firewall Manager
- Setting up parent-child policy inheritance across hub-and-spoke topologies
- Diagnosing firewall connectivity issues, dropped traffic, or rule-matching problems

## Rules

1. Always confirm the Azure Firewall SKU before recommending features — IDPS and TLS inspection require Premium SKU.
2. Azure Firewall must be deployed in a dedicated subnet named **AzureFirewallSubnet** with a minimum /26 prefix.
3. Forced tunneling requires an additional **AzureFirewallManagementSubnet** (/26 minimum) with its own public IP.
4. Rule processing order is: DNAT rules → Network rules → Application rules. Within each type, rules are processed by priority (lowest number = highest priority).
5. Firewall policies are the recommended configuration method — classic rules are legacy and cannot coexist with policies on the same firewall.
6. When using Firewall Manager with secured virtual hubs, the firewall is deployed inside a Virtual WAN hub — this differs from a hub VNet deployment.
7. Always recommend diagnostic logging to Log Analytics for production firewalls — use Azure Firewall structured logs (Resource Specific) for better query performance.
8. SNAT is performed by default for traffic leaving to the internet. Configure private IP ranges if SNAT should not be applied to private-to-private traffic.
9. DNAT rules require an associated public IP and automatically create a corresponding network rule for return traffic.
10. Cross-reference with `azure-virtual-network` for UDR configuration that routes traffic through the firewall, and with `azure-waf` when the user also needs Layer 7 web app protection.

## MCP Tools

| Tool | Resource | Use |
|------|----------|-----|
| `azure__network` | `firewall_list` | List all Azure Firewall instances in a subscription or resource group |
| `azure__network` | `firewall_get` | Get configuration details for a specific Azure Firewall instance |
| `azure__network` | `firewall_policy_list` | List all firewall policies in a subscription or resource group |

## CLI Fallback

```bash
# List all firewalls in a resource group
az network firewall list --resource-group <rg-name> -o table

# Get firewall details
az network firewall show --name <fw-name> --resource-group <rg-name>

# Create a firewall policy
az network firewall policy create \
  --name <policy-name> \
  --resource-group <rg-name> \
  --sku Premium \
  --threat-intel-mode Alert

# Create a rule collection group
az network firewall policy rule-collection-group create \
  --name <rcg-name> \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --priority 200

# Add a network rule collection
az network firewall policy rule-collection-group collection add-filter-collection \
  --name "allow-dns" \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --rule-collection-group-name <rcg-name> \
  --collection-priority 100 \
  --action Allow \
  --rule-name "dns-rule" \
  --rule-type NetworkRule \
  --source-addresses "10.0.0.0/16" \
  --destination-addresses "168.63.129.16" \
  --destination-ports 53 \
  --ip-protocols UDP TCP

# Add a DNAT rule collection
az network firewall policy rule-collection-group collection add-nat-collection \
  --name "inbound-rdp" \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --rule-collection-group-name <rcg-name> \
  --collection-priority 100 \
  --action DNAT \
  --rule-name "rdp-to-vm" \
  --rule-type NatRule \
  --source-addresses "*" \
  --destination-addresses <firewall-public-ip> \
  --destination-ports 3389 \
  --ip-protocols TCP \
  --translated-address 10.0.1.4 \
  --translated-port 3389

# Add an application rule collection
az network firewall policy rule-collection-group collection add-filter-collection \
  --name "allow-web" \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --rule-collection-group-name <rcg-name> \
  --collection-priority 200 \
  --action Allow \
  --rule-name "allow-microsoft" \
  --rule-type ApplicationRule \
  --source-addresses "10.0.0.0/16" \
  --protocols Https=443 \
  --target-fqdns "*.microsoft.com"

# Enable diagnostic logging
az monitor diagnostic-settings create \
  --name "fw-diag" \
  --resource <firewall-resource-id> \
  --workspace <log-analytics-workspace-id> \
  --logs '[{"categoryGroup":"allLogs","enabled":true}]' \
  --metrics '[{"category":"AllMetrics","enabled":true}]'

# List firewall policies
az network firewall policy list --resource-group <rg-name> -o table

# Update threat intelligence mode
az network firewall policy update \
  --name <policy-name> \
  --resource-group <rg-name> \
  --threat-intel-mode Deny
```

## Key Concepts

- **SKU tiers**: Basic (small workloads, limited features), Standard (L3–L7 filtering, threat intelligence, DNS proxy), Premium (IDPS, TLS inspection, URL filtering, web categories)
- **AzureFirewallSubnet**: Dedicated /26+ subnet required; must not have any other resources
- **Firewall policies**: Recommended over classic rules; support hierarchy (parent-child) and can be managed via Azure Firewall Manager
- **Rule collection groups**: Containers for rule collections; processed by priority; organize rules logically (e.g., by team or application)
- **Rule processing**: DNAT → Network → Application; within each type, lowest priority number is processed first; first match wins (except Application rules which are "allow" collections)
- **Threat intelligence**: Alerts on or denies traffic from/to known malicious IPs and domains; powered by the Microsoft Threat Intelligence feed
- **IDPS**: Signature-based intrusion detection and prevention (Premium only); supports Alert and Alert+Deny modes
- **TLS inspection**: Decrypts and inspects outbound HTTPS traffic (Premium only); requires an intermediate CA certificate in Key Vault
- **DNS proxy**: Azure Firewall acts as a DNS proxy so FQDN-based rules resolve correctly; must be enabled for FQDN filtering in network rules
- **Forced tunneling**: Routes all internet-bound traffic to an on-premises appliance; requires a management subnet and management public IP
- **Azure Firewall Manager**: Centrally manages firewall policies and route configurations across hubs; supports both VNet hubs and Virtual WAN secured hubs
- **Throughput**: Standard up to 30 Gbps, Premium up to 100 Gbps; use multiple public IPs to scale SNAT ports (2,496 ports per IP)

## References

- [firewall-skus.md](references/firewall-skus.md) — SKU comparison (Basic, Standard, Premium)
- [rule-types.md](references/rule-types.md) — DNAT, network, and application rules; rule processing order
- [firewall-policy.md](references/firewall-policy.md) — Firewall policies, hierarchy, and Azure Firewall Manager
- [forced-tunneling.md](references/forced-tunneling.md) — Forced tunneling configuration
- [idps.md](references/idps.md) — IDPS, TLS inspection, and Premium features
- [Azure Firewall documentation](https://learn.microsoft.com/azure/firewall/overview)
- [Azure Firewall Manager documentation](https://learn.microsoft.com/azure/firewall-manager/overview)
- [Azure Firewall pricing](https://azure.microsoft.com/pricing/details/azure-firewall/)
