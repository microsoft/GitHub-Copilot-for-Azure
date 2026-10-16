# IP Addressing in Azure Virtual Networks

## Public IP Address SKUs

Azure offers two SKUs for public IP addresses: Basic and Standard.

### Basic vs Standard Comparison

| Feature | Basic SKU | Standard SKU |
|---------|-----------|-------------|
| Allocation | Static or Dynamic | Static only |
| Availability zones | Not zone-redundant | Zone-redundant by default |
| Routing preference | Internet routing only | Internet or Microsoft network routing |
| Security | Open by default (NSG optional) | Secure by default (NSG required) |
| Load balancer compatibility | Basic LB only | Standard LB only |
| Cross-region LB | Not supported | Supported |
| NAT Gateway | Not supported | Supported |
| Global tier | Not available | Available (for cross-region LB) |
| Idle timeout | 4 min (fixed) | 4–30 min (configurable) |
| Price | Free (for most uses) | Charged per hour + data |

### Basic SKU Retirement

> **IMPORTANT**: Basic SKU public IPs are scheduled for retirement on **September 30, 2025**. All new deployments should use Standard SKU.

#### Migration Steps

```bash
# Step 1: Check existing Basic SKU public IPs
az network public-ip list --query "[?sku.name=='Basic']" -o table

# Step 2: Upgrade to Standard (requires disassociation first)
# Disassociate the IP from the resource
az network nic ip-config update -g MyRG --nic-name MyNIC -n ipconfig1 --remove publicIpAddress

# Upgrade the SKU
az network public-ip update -g MyRG -n MyPublicIP --sku Standard

# Re-associate (may require NSG rule since Standard is secure-by-default)
az network nic ip-config update -g MyRG --nic-name MyNIC -n ipconfig1 \
  --public-ip-address MyPublicIP
```

> **Note**: Migration requires downtime because the public IP must be disassociated, upgraded, and re-associated. Plan for a maintenance window.

## Static vs Dynamic Allocation

### Static IP Addresses

- The IP is assigned immediately when the public IP resource is created.
- The IP does not change across resource stop/start, reboot, or reassignment.
- Use for: DNS records, firewall allowlists, SSL certificates bound to an IP, applications that require a fixed IP.

### Dynamic IP Addresses (Basic SKU only)

- The IP is assigned when the public IP is attached to a running resource.
- The IP may change when the resource is stopped and restarted (deallocated).
- Standard SKU does not support dynamic allocation — all Standard IPs are static.

```bash
# Create a static Standard public IP
az network public-ip create -g MyRG -n MyStaticIP \
  --sku Standard \
  --allocation-method Static \
  --zone 1 2 3

# Create a zone-redundant Standard public IP (default behavior)
az network public-ip create -g MyRG -n MyZoneRedundantIP \
  --sku Standard \
  --allocation-method Static
```

## IP Prefixes

### Public IP Prefixes

A public IP prefix is a contiguous range of public IP addresses that you reserve. This guarantees that your public IPs come from a known range, simplifying firewall rules and allowlisting.

| Prefix Size | Addresses | Common Use |
|-------------|-----------|------------|
| /31 | 2 | Minimal, small services |
| /30 | 4 | Small deployments |
| /29 | 8 | Medium deployments |
| /28 | 16 | Large deployments, NAT Gateway |

```bash
# Create a public IP prefix (/28 = 16 addresses)
az network public-ip prefix create -g MyRG -n MyIPPrefix \
  --length 28 \
  --location eastus

# Create a public IP from the prefix
az network public-ip create -g MyRG -n MyIP1 \
  --sku Standard \
  --public-ip-prefix MyIPPrefix
```

### Custom IP Prefixes (BYOIP)

Bring Your Own IP (BYOIP) lets you use your organization's own public IP ranges in Azure. The range must be validated through the Regional Internet Registry (RIR) and provisioned in Azure before use.

Requirements:
- Minimum prefix size: /24 (IPv4) or /48 (IPv6)
- ROA (Route Origin Authorization) must be created at your RIR
- Provisioning can take several weeks for validation

```bash
# Create a custom IP prefix (after RIR validation)
az network custom-ip prefix create -g MyRG -n MyBYOIP \
  --cidr 203.0.113.0/24 \
  --location eastus \
  --authorization-message "<signed-message>" \
  --signed-message "<RIR-signed>"
```

## IPv6 Dual-Stack Support

Azure VNets support dual-stack (IPv4 + IPv6) networking. VMs can have both IPv4 and IPv6 addresses and communicate over both protocols.

### Dual-Stack Configuration

```bash
# Create a dual-stack VNet
az network vnet create -g MyRG -n DualStackVNet \
  --address-prefixes 10.0.0.0/16 fd00:db8::/48 \
  --subnet-name Default \
  --subnet-prefixes 10.0.0.0/24 fd00:db8::/64

# Create an IPv6 public IP
az network public-ip create -g MyRG -n MyIPv6PublicIP \
  --sku Standard \
  --allocation-method Static \
  --version IPv6

# Create a dual-stack NIC
az network nic create -g MyRG -n DualStackNIC \
  --vnet-name DualStackVNet --subnet Default \
  --private-ip-address-version IPv4 \
  --public-ip-address MyIPv4PublicIP

# Add IPv6 configuration to the NIC
az network nic ip-config create -g MyRG --nic-name DualStackNIC \
  -n IPv6Config \
  --private-ip-address-version IPv6 \
  --vnet-name DualStackVNet --subnet Default \
  --public-ip-address MyIPv6PublicIP
```

### IPv6 Limitations in Azure

- IPv6-only VNets are not supported — dual-stack is required (IPv4 is always present).
- Not all Azure services support IPv6. Check service documentation before planning.
- IPv6 subnet size must be exactly /64 (Azure requirement).
- IPv6 UDRs are supported but some next-hop types are limited.
- NSGs fully support IPv6 source and destination rules.

## Private IP Addresses

### Static vs Dynamic Private IPs

| Type | Behavior | Use When |
|------|----------|----------|
| Dynamic | Azure assigns the next available IP from the subnet | Default — suitable for most workloads |
| Static | You specify the exact IP address | DNS servers, domain controllers, load balancer backends, apps with IP-based dependencies |

```bash
# Create a NIC with a static private IP
az network nic create -g MyRG -n MyNIC \
  --vnet-name MyVNet --subnet AppSubnet \
  --private-ip-address 10.0.1.10

# Update an existing NIC to use a static IP
az network nic ip-config update -g MyRG --nic-name MyNIC -n ipconfig1 \
  --private-ip-address 10.0.1.10 \
  --private-ip-address-allocation Static
```

### Private IP Reservation Best Practices

1. **Document static IP assignments** — maintain a registry to avoid conflicts.
2. **Reserve IPs for infrastructure** — DNS servers, Active Directory, NVAs.
3. **Leave the first few IPs in each subnet unassigned** — Azure uses x.x.x.1 through x.x.x.3.
4. **Start static assignments from x.x.x.10** or higher to leave room for growth.
5. **Use Azure IPAM** or a third-party IPAM tool for large environments.

## NAT Gateway and Public IPs

Azure NAT Gateway provides outbound internet connectivity for resources in a subnet using one or more public IP addresses or a public IP prefix.

### Key Benefits

- Predictable outbound IPs (from the NAT Gateway's public IP or prefix)
- No SNAT port exhaustion — NAT Gateway supports up to 64,000 SNAT ports per public IP
- Up to 16 public IPs per NAT Gateway (1,024,000 total SNAT ports)
- Replaces the need for public IPs on individual VMs for outbound access

```bash
# Create a NAT Gateway with a public IP
az network public-ip create -g MyRG -n NatGwIP --sku Standard
az network nat gateway create -g MyRG -n MyNatGw \
  --public-ip-addresses NatGwIP \
  --idle-timeout 10

# Associate with a subnet
az network vnet subnet update -g MyRG --vnet-name MyVNet -n AppSubnet \
  --nat-gateway MyNatGw
```

### NAT Gateway vs Other Outbound Methods

| Method | Predictable IP | Port Limits | Cost |
|--------|---------------|-------------|------|
| NAT Gateway | Yes | 64K per IP | Per hour + per GB |
| VM public IP | Yes | 64K per VM | Per hour per IP |
| Load Balancer outbound rules | Yes | Configurable | Part of LB cost |
| Default outbound (retiring) | No | Varies | Free (retiring) |

> **Note**: Azure default outbound access (where VMs without explicit outbound config get a random public IP) is being retired. Plan to use NAT Gateway, LB outbound rules, or VM public IPs.

## IP Allocation Strategy for Large Deployments

### Principles

1. **Align IP ranges with organizational units** — assign /16 blocks per business unit or environment.
2. **Reserve space for growth** — allocate 2-3x what you currently need.
3. **Use consistent offset patterns** — e.g., subnet .0 is always GatewaySubnet, .1 is AzureBastionSubnet.
4. **Separate production and non-production** — use distinct /8 ranges (e.g., 10.x for prod, 172.16.x for dev).
5. **Plan for hybrid** — coordinate with on-premises teams to avoid overlaps.

### Example Large-Scale IP Plan

| Block | CIDR | Purpose |
|-------|------|---------|
| 10.0.0.0/8 | Split into /16 per region | Production Azure |
| 172.16.0.0/12 | Split into /16 per region | Dev/Test Azure |
| 192.168.0.0/16 | On-premises ranges | Corporate network |

## Troubleshooting

### Public IP Not Attaching to Resource

**Symptom**: Error when associating a public IP with a VM NIC or load balancer.
**Causes**:
1. SKU mismatch — Standard IP with Basic LB or vice versa.
2. Zone mismatch — IP zone does not align with the resource's zone.
3. IP already associated with another resource.

**Fix**: Verify SKU and zone compatibility. Disassociate the IP from any existing resource before attaching to a new one.

```bash
# Check public IP details and associations
az network public-ip show -g MyRG -n MyPublicIP \
  --query '{sku:sku.name, zone:zones, ipConfig:ipConfiguration.id}'
```

### IPv6 Connectivity Issues

**Symptom**: IPv6 traffic not working despite dual-stack configuration.
**Causes**:
1. NSG does not have IPv6-aware rules.
2. IPv6 subnet not properly configured (/64 required).
3. Application not listening on IPv6 addresses (listening on 0.0.0.0 only covers IPv4; use :: for IPv6).
4. UDRs not configured for IPv6 address prefixes.

**Fix**: Add explicit IPv6 NSG rules, verify subnet configuration, check application binding.

### SNAT Port Exhaustion

**Symptom**: Intermittent outbound connection failures.
**Cause**: Too many outbound connections from VMs sharing a limited number of SNAT ports.
**Fix**: Deploy a NAT Gateway with sufficient public IPs (each IP provides 64K ports). For existing LB-based SNAT, increase the allocated ports per backend instance.

```bash
# Check SNAT port allocation on a load balancer
az network lb outbound-rule list -g MyRG --lb-name MyLB -o table
```
