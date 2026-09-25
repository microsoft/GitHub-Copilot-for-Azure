# Network Segmentation Strategies

Design network segmentation for Azure workloads using subnets, NSGs, ASGs, Azure Firewall, and zero-trust patterns.

## Why Segmentation Matters

Network segmentation limits blast radius. If an attacker compromises a web server, segmentation prevents lateral movement to database servers. Azure provides multiple segmentation layers:

```
Layer 1: Subscription/VNet boundaries (strongest isolation)
Layer 2: Subnet + NSG (standard segmentation)
Layer 3: ASGs within subnets (micro-segmentation)
Layer 4: Azure Firewall between segments (inspection + logging)
Layer 5: Private endpoints (PaaS isolation)
```

## Segmentation Approaches

### Approach 1: Subnet-Based Segmentation (Recommended Starting Point)

Separate workload tiers into different subnets with NSGs controlling traffic between them.

```
VNet: 10.1.0.0/22
├── web-subnet    10.1.0.0/26   NSG: allow 443 from Internet
├── app-subnet    10.1.0.64/26  NSG: allow 8080 from web-subnet only
├── data-subnet   10.1.0.128/26 NSG: allow 1433 from app-subnet only
└── mgmt-subnet   10.1.0.192/26 NSG: allow 22/3389 from Bastion only
```

```bash
# Create NSG for app subnet — only allow traffic from web subnet
az network nsg create -g <rg> -n app-nsg

az network nsg rule create \
  -g <rg> --nsg-name app-nsg \
  -n AllowFromWeb \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-address-prefixes 10.1.0.0/26 \
  --destination-port-ranges 8080

az network nsg rule create \
  -g <rg> --nsg-name app-nsg \
  -n DenyAllInbound \
  --priority 4000 \
  --direction Inbound \
  --access Deny \
  --protocol '*' \
  --source-address-prefixes '*' \
  --destination-port-ranges '*'

# Associate NSG with subnet
az network vnet subnet update \
  -g <rg> --vnet-name <vnet> -n app-subnet \
  --network-security-group app-nsg
```

### Approach 2: Application Security Groups (Micro-Segmentation)

ASGs let you group VMs by role and write NSG rules that reference groups instead of IP addresses. This is ideal when VMs in the same subnet have different roles.

```bash
# Create ASGs for each application role
az network asg create -g <rg> -n web-servers
az network asg create -g <rg> -n app-servers
az network asg create -g <rg> -n db-servers

# Associate VM NICs with ASGs
az network nic ip-config update \
  -g <rg> --nic-name web-vm-nic \
  -n ipconfig1 \
  --application-security-groups web-servers

az network nic ip-config update \
  -g <rg> --nic-name app-vm-nic \
  -n ipconfig1 \
  --application-security-groups app-servers

# Create NSG rules using ASGs
az network nsg rule create \
  -g <rg> --nsg-name workload-nsg \
  -n WebToApp \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-asgs web-servers \
  --destination-asgs app-servers \
  --destination-port-ranges 8080

az network nsg rule create \
  -g <rg> --nsg-name workload-nsg \
  -n AppToDb \
  --priority 110 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-asgs app-servers \
  --destination-asgs db-servers \
  --destination-port-ranges 1433
```

**ASG advantages:**
- Rules follow the VM, not the IP — works with dynamic IP assignment
- A VM can belong to multiple ASGs
- Cleaner rule sets than managing CIDR ranges

### Approach 3: Azure Firewall Between Segments

For environments requiring deep inspection, logging, and threat intelligence between segments, route inter-subnet traffic through Azure Firewall.

```bash
# Create UDR to route web→app traffic through firewall
az network route-table create -g <rg> -n web-rt
az network route-table route create \
  -g <rg> --route-table-name web-rt \
  -n to-app-via-fw \
  --address-prefix 10.1.0.64/26 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address <firewall-private-ip>

# Create UDR for return traffic
az network route-table create -g <rg> -n app-rt
az network route-table route create \
  -g <rg> --route-table-name app-rt \
  -n to-web-via-fw \
  --address-prefix 10.1.0.0/26 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address <firewall-private-ip>

# Associate route tables
az network vnet subnet update -g <rg> --vnet-name <vnet> -n web-subnet --route-table web-rt
az network vnet subnet update -g <rg> --vnet-name <vnet> -n app-subnet --route-table app-rt
```

Then create firewall rules to allow specific traffic:
```bash
# Application rule collection for web-to-app
az network firewall network-rule create \
  -g <rg> -f <firewall> \
  --collection-name web-to-app \
  --priority 200 \
  --action Allow \
  -n allow-app-traffic \
  --protocols TCP \
  --source-addresses 10.1.0.0/26 \
  --destination-addresses 10.1.0.64/26 \
  --destination-ports 8080
```

### Approach 4: VNet Manager Security Admin Rules

Azure Virtual Network Manager provides centralized security rules that platform teams can enforce across multiple VNets. These rules have higher priority than NSGs and cannot be overridden by workload teams.

```bash
# Create security admin configuration
az network manager security-admin-config create \
  -g <rg> \
  --network-manager-name <manager> \
  -n baseline-security

# Create a rule collection
az network manager security-admin-config rule-collection create \
  -g <rg> \
  --network-manager-name <manager> \
  --configuration-name baseline-security \
  -n deny-risky-ports \
  --applies-to-groups "[{networkGroupId:<group-id>}]"

# Add a rule to deny SSH from Internet (enforced by platform)
az network manager security-admin-config rule-collection rule create \
  -g <rg> \
  --network-manager-name <manager> \
  --configuration-name baseline-security \
  --rule-collection-name deny-risky-ports \
  -n deny-ssh-from-internet \
  --kind Custom \
  --protocol Tcp \
  --direction Inbound \
  --access Deny \
  --priority 100 \
  --source-address-prefixes "Internet" \
  --dest-port-ranges 22
```

## Zero Trust Networking in Azure

Zero trust means "never trust, always verify" — even for traffic within the network.

### Zero Trust Principles for Azure Networking

1. **Verify explicitly:** Authenticate and authorize every network flow
2. **Least privilege access:** Only allow the minimum required traffic
3. **Assume breach:** Segment aggressively, encrypt in transit, log everything

### Implementing Zero Trust

```
┌─────────────────────────────────────────────┐
│                  Internet                    │
└──────────┬──────────────────────┬────────────┘
           │                      │
    ┌──────▼──────┐        ┌──────▼──────┐
    │  Front Door │        │ DDoS Prot.  │
    │  (WAF)      │        │             │
    └──────┬──────┘        └─────────────┘
           │
    ┌──────▼──────┐
    │ App Gateway │  ← SSL termination, mTLS
    │  (WAF v2)   │
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  NSG + ASG  │  ← Micro-segmentation
    │  Web Tier   │
    └──────┬──────┘
           │ ← Azure Firewall inspection
    ┌──────▼──────┐
    │  NSG + ASG  │
    │  App Tier   │
    └──────┬──────┘
           │ ← Private Endpoint
    ┌──────▼──────┐
    │  Azure SQL  │  ← Public endpoint disabled
    │  (PaaS)     │
    └─────────────┘
```

### Zero Trust checklist

- [ ] **Disable public endpoints** on all PaaS services — use Private Endpoints
- [ ] **NSGs on every subnet** with explicit allow rules (default deny)
- [ ] **Azure Firewall** for east-west traffic inspection between tiers
- [ ] **WAF** on all internet-facing HTTP endpoints (Front Door or App Gateway)
- [ ] **DDoS Protection** Standard on the VNet
- [ ] **Encryption in transit** — TLS 1.2+ everywhere, no unencrypted traffic
- [ ] **NSG flow logs** enabled for all NSGs → sent to Log Analytics
- [ ] **Azure Firewall logs** sent to Log Analytics
- [ ] **Just-in-time VM access** via Microsoft Defender for Cloud
- [ ] **No public IPs on VMs** — use Azure Bastion for management access
- [ ] **Service endpoints or Private Link** for Azure-to-Azure PaaS traffic
- [ ] **DNS** — use Private DNS zones so names resolve to private IPs

## Segmentation Patterns by Workload

### Three-tier web application

```
NSG rules:
  web-subnet  ← allow 443 from Internet, 80 from AppGw subnet
  app-subnet  ← allow 8080 from web-subnet only
  data-subnet ← allow 1433 from app-subnet only
  all subnets ← deny all other inbound
```

### Microservices (AKS)

```
AKS network policy (Calico or Azure):
  - Namespace-level isolation (each microservice in its own namespace)
  - Allow: frontend → backend-api (port 8080)
  - Allow: backend-api → database (port 5432)
  - Deny: frontend → database (no direct access)
  - Allow: all → monitoring namespace (metrics export)
```

### Shared services hub

```
Hub segmentation:
  AzureFirewallSubnet   ← managed by Azure, no NSG needed
  GatewaySubnet         ← managed by Azure, no NSG needed
  AzureBastionSubnet    ← managed by Azure (auto NSG rules)
  shared-services       ← NSG: allow RDP/SSH from Bastion subnet only
  dns-resolver-inbound  ← NSG: allow DNS (53) from all VNets
```

## Comparing Segmentation Tools

| Tool | Scope | Managed By | Overridable | Best For |
|------|-------|-----------|-------------|----------|
| NSG | Subnet or NIC | Workload team | Yes | Standard per-workload segmentation |
| ASG | VM group within NSG | Workload team | Yes | Role-based micro-segmentation |
| Azure Firewall | VNet or cross-VNet | Platform team | No (by workload) | Central inspection, logging, threat intel |
| VNet Manager Admin Rules | Multi-VNet | Platform team | No | Organization-wide baseline rules |
| AKS Network Policy | Pod-level | DevOps team | N/A | Kubernetes micro-segmentation |
| Private Endpoints | PaaS access | Workload team | N/A | PaaS service isolation |

## Related Resources

- [Azure network security best practices](https://learn.microsoft.com/azure/security/fundamentals/network-best-practices)
- [Zero trust networking for Azure](https://learn.microsoft.com/security/zero-trust/deploy/networks)
- [Application security groups](https://learn.microsoft.com/azure/virtual-network/application-security-groups)
- [Azure Firewall overview](https://learn.microsoft.com/azure/firewall/overview)
- For firewall configuration → use `azure-firewall` skill
- For VNet and NSG management → use `azure-virtual-network` skill
- For VNet Manager → use `azure-vnet-manager` skill
