# Network Security Groups (NSGs) and Rules

## Overview

A Network Security Group (NSG) contains a list of security rules that allow or deny inbound and outbound network traffic to Azure resources. NSGs can be associated with subnets or individual network interfaces (NICs). They act as a stateful firewall — if you allow an inbound request, the response is automatically allowed.

## Rule Evaluation Order

NSG rules are evaluated by **priority** — a number between 100 and 4096. Lower numbers are evaluated first and take precedence.

### Inbound Traffic Flow

1. Azure evaluates the **subnet-level NSG** first (if one is associated).
2. If traffic passes, Azure evaluates the **NIC-level NSG** (if one is associated).
3. Within each NSG, rules are evaluated from **lowest priority number** (highest precedence) to highest.
4. The first matching rule determines the action (Allow or Deny). No further rules are evaluated.
5. If no custom rule matches, the **default rules** at priority 65000+ apply.

### Outbound Traffic Flow

1. Azure evaluates the **NIC-level NSG** first.
2. If traffic passes, Azure evaluates the **subnet-level NSG**.
3. Same priority-based evaluation within each NSG.

> **Key insight**: For inbound, subnet NSG runs first. For outbound, NIC NSG runs first. Both must allow the traffic for it to flow.

## Default Rules

Every NSG is created with three default inbound and three default outbound rules. These cannot be deleted but can be overridden with custom rules at a higher precedence (lower priority number).

### Default Inbound Rules

| Priority | Name | Source | Destination | Port | Protocol | Action |
|----------|------|--------|-------------|------|----------|--------|
| 65000 | AllowVnetInBound | VirtualNetwork | VirtualNetwork | Any | Any | Allow |
| 65001 | AllowAzureLoadBalancerInBound | AzureLoadBalancer | Any | Any | Any | Allow |
| 65500 | DenyAllInBound | Any | Any | Any | Any | Deny |

### Default Outbound Rules

| Priority | Name | Source | Destination | Port | Protocol | Action |
|----------|------|--------|-------------|------|----------|--------|
| 65000 | AllowVnetOutBound | VirtualNetwork | VirtualNetwork | Any | Any | Allow |
| 65001 | AllowInternetOutBound | Any | Internet | Any | Any | Allow |
| 65500 | DenyAllOutBound | Any | Any | Any | Any | Deny |

### Service Tags Used in Default Rules

- **VirtualNetwork**: includes the VNet address space, all connected on-premises address spaces, peered VNets, and VNets connected to a virtual network gateway.
- **AzureLoadBalancer**: represents the Azure infrastructure load balancer health probe source IP (168.63.129.16).
- **Internet**: all addresses outside the VNet address space that are reachable via the public internet.

## Custom Rule Structure

Each NSG rule consists of these properties:

| Property | Description | Values |
|----------|-------------|--------|
| Name | Unique name within the NSG | Up to 80 characters |
| Priority | 100–4096, lower = higher precedence | Leave gaps for insertions |
| Direction | Inbound or Outbound | `Inbound`, `Outbound` |
| Action | Allow or Deny | `Allow`, `Deny` |
| Source | Source IP, CIDR, service tag, or ASG | e.g., `10.0.0.0/24`, `Internet`, `AsgWeb` |
| Source Port | Source port or range | `*`, `80`, `1024-65535` |
| Destination | Destination IP, CIDR, service tag, or ASG | Same options as Source |
| Destination Port | Destination port or range | `*`, `443`, `80,443,8080` |
| Protocol | Network protocol | `Tcp`, `Udp`, `Icmp`, `Esp`, `Ah`, `*` |

## Application Security Groups (ASGs)

ASGs let you group VMs by workload function and write NSG rules referencing those groups instead of individual IP addresses. This simplifies rule management significantly in dynamic environments.

### How ASGs Work

1. Create an ASG (e.g., `WebServers`, `AppServers`, `DbServers`).
2. Assign VM NICs to the appropriate ASG.
3. Write NSG rules using ASGs as source or destination instead of IP addresses.
4. When VMs are added or removed, ASG membership updates automatically take effect — no rule changes needed.

### ASG Example: 3-Tier Application

```bash
# Create ASGs
az network asg create -g MyRG -n WebServers
az network asg create -g MyRG -n AppServers
az network asg create -g MyRG -n DbServers

# Associate VM NICs with ASGs (during NIC create or update)
az network nic update -g MyRG -n WebVM-NIC --application-security-groups WebServers
az network nic update -g MyRG -n AppVM-NIC --application-security-groups AppServers
az network nic update -g MyRG -n DbVM-NIC --application-security-groups DbServers

# Create NSG with ASG-based rules
az network nsg create -g MyRG -n TierNSG

# Allow internet to web tier on 80/443
az network nsg rule create -g MyRG --nsg-name TierNSG -n AllowWebInbound \
  --priority 100 --direction Inbound --access Allow --protocol Tcp \
  --source-address-prefixes Internet \
  --destination-asgs WebServers \
  --destination-port-ranges 80 443

# Allow web tier to app tier on 8080
az network nsg rule create -g MyRG --nsg-name TierNSG -n AllowWebToApp \
  --priority 200 --direction Inbound --access Allow --protocol Tcp \
  --source-asgs WebServers \
  --destination-asgs AppServers \
  --destination-port-ranges 8080

# Allow app tier to DB tier on 1433
az network nsg rule create -g MyRG --nsg-name TierNSG -n AllowAppToDb \
  --priority 300 --direction Inbound --access Allow --protocol Tcp \
  --source-asgs AppServers \
  --destination-asgs DbServers \
  --destination-port-ranges 1433
```

### ASG Rules and Constraints

- All NICs assigned to an ASG must be in the **same VNet**.
- You cannot mix ASGs from different VNets in the same rule.
- A single NIC can belong to multiple ASGs (up to the platform limit).
- ASGs are free — no additional cost beyond the NSG.

## Common Rule Sets

### Web Tier (Public-Facing)

| Priority | Name | Dir | Source | Dest | Port | Protocol | Action |
|----------|------|-----|--------|------|------|----------|--------|
| 100 | AllowHTTPS | In | Internet | WebServers | 443 | Tcp | Allow |
| 110 | AllowHTTP | In | Internet | WebServers | 80 | Tcp | Allow |
| 120 | AllowHealthProbe | In | AzureLoadBalancer | WebServers | * | * | Allow |
| 4096 | DenyAllInbound | In | * | * | * | * | Deny |

### Application Tier (Internal Only)

| Priority | Name | Dir | Source | Dest | Port | Protocol | Action |
|----------|------|-----|--------|------|------|----------|--------|
| 100 | AllowFromWeb | In | WebServers (ASG) | AppServers | 8080 | Tcp | Allow |
| 110 | AllowHealthProbe | In | AzureLoadBalancer | AppServers | * | * | Allow |
| 4096 | DenyAllInbound | In | * | * | * | * | Deny |

### Database Tier (Restricted)

| Priority | Name | Dir | Source | Dest | Port | Protocol | Action |
|----------|------|-----|--------|------|------|----------|--------|
| 100 | AllowSQL | In | AppServers (ASG) | DbServers | 1433 | Tcp | Allow |
| 110 | AllowMySQL | In | AppServers (ASG) | DbServers | 3306 | Tcp | Allow |
| 120 | AllowPostgres | In | AppServers (ASG) | DbServers | 5432 | Tcp | Allow |
| 4096 | DenyAllInbound | In | * | * | * | * | Deny |

### Management Access (Bastion Only)

| Priority | Name | Dir | Source | Dest | Port | Protocol | Action |
|----------|------|-----|--------|------|------|----------|--------|
| 100 | AllowSSH | In | AzureBastionSubnet | * | 22 | Tcp | Allow |
| 110 | AllowRDP | In | AzureBastionSubnet | * | 3389 | Tcp | Allow |
| 4096 | DenyAllInbound | In | * | * | * | * | Deny |

## Priority Numbering Best Practices

Organize priorities in blocks to keep rules manageable:

| Range | Purpose |
|-------|---------|
| 100–199 | External/internet-facing rules |
| 200–299 | Inter-tier communication rules |
| 300–399 | Management and monitoring rules |
| 400–499 | Azure service integration rules |
| 500–999 | Reserved for future use |
| 1000–1999 | Application-specific rules |
| 2000–2999 | Security and compliance rules |
| 3000–4096 | Explicit deny rules (before default deny) |

**Leave gaps** between priorities (e.g., 100, 110, 120 instead of 100, 101, 102) to allow inserting rules later without renumbering.

## NSG Flow Logs

NSG flow logs record information about IP traffic flowing through an NSG. They are essential for monitoring, compliance, and troubleshooting.

### Enabling Flow Logs

```bash
# Create a storage account for flow logs
az storage account create -g MyRG -n flowlogsstorage --sku Standard_LRS

# Enable NSG flow logs (version 2 for traffic analytics support)
az network watcher flow-log create \
  --location eastus \
  -g MyRG \
  -n MyFlowLog \
  --nsg MyNSG \
  --storage-account flowlogsstorage \
  --log-version 2 \
  --retention 30

# Enable Traffic Analytics (requires Log Analytics workspace)
az network watcher flow-log update \
  --location eastus \
  -g MyRG \
  -n MyFlowLog \
  --traffic-analytics true \
  --workspace MyLogAnalyticsWorkspace
```

### Flow Log Data

Each flow log entry contains:
- Source and destination IP/port
- Protocol
- Traffic direction (inbound/outbound)
- Traffic decision (allowed/denied)
- Byte and packet counts (version 2)
- Flow state (begin, continuing, end — version 2)

## Diagnostics and Verification

### Check Effective Security Rules

The "effective security rules" view shows all NSG rules (from both subnet and NIC NSGs) merged and sorted by priority — exactly what Azure evaluates for traffic decisions.

```bash
# View effective NSG rules for a NIC
az network nic list-effective-nsg -g MyRG -n MyVM-NIC

# View effective NSG rules in the portal:
# VM → Networking → Effective security rules
```

### IP Flow Verify

Network Watcher's IP Flow Verify tests whether a specific packet is allowed or denied and identifies which rule made the decision.

```bash
# Test if inbound TCP/443 is allowed to a specific VM
az network watcher test-ip-flow \
  --direction Inbound \
  --protocol Tcp \
  --local 10.0.0.4:443 \
  --remote 203.0.113.50:12345 \
  --vm MyVM \
  -g MyRG
```

## Troubleshooting

### Rules Not Taking Effect

**Symptom**: Added an Allow rule but traffic is still blocked.
**Causes**:
1. A higher-precedence (lower number) Deny rule exists above your Allow rule.
2. NSG is not associated with the correct subnet or NIC.
3. Both subnet-level and NIC-level NSGs exist, and one of them is blocking.

**Fix**: Check effective security rules. Verify NSG associations. Use IP Flow Verify to identify the blocking rule.

### Traffic Allowed That Should Be Blocked

**Symptom**: Traffic is flowing despite no explicit Allow rule.
**Causes**:
1. The `AllowVnetInBound` default rule (65000) allows all intra-VNet traffic.
2. The `AllowInternetOutBound` default rule allows all outbound internet traffic.

**Fix**: Add an explicit Deny rule at a lower priority number than the default rules (any priority under 65000).

### NSG Associated but No Rules Visible

**Symptom**: NSG shows as associated to a subnet but the rules panel is empty.
**Cause**: You may be viewing a different NSG, or the rules were deleted.
**Fix**: Verify the NSG resource ID matches the expected one. Default rules always exist even if custom rules are empty.

### Cannot Create Rule — ASG Error

**Symptom**: Error when creating a rule with ASG references.
**Cause**: The ASG and the NSG are in different regions, or the ASG is in a different VNet than the NICs.
**Fix**: ASGs must be in the same region as the NSG. All NICs in an ASG must be in the same VNet.

```bash
# Verify NSG association
az network vnet subnet show -g MyRG --vnet-name MyVNet -n MySubnet --query 'networkSecurityGroup.id'

# List all rules in an NSG
az network nsg rule list -g MyRG --nsg-name MyNSG -o table --include-default
```
