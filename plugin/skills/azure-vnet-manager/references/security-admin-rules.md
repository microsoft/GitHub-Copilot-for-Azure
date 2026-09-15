# Security Admin Rules

Security admin rules in Azure Virtual Network Manager (AVNM) provide centralized, top-down network security enforcement across all VNets in a network group. They evaluate before NSG rules, enabling platform teams to enforce security baselines that workload teams cannot override.

## Security Admin Rules vs NSGs

| Feature | Security Admin Rules | Network Security Groups |
|---------|---------------------|------------------------|
| Scope | All VNets in a network group | Individual subnet or NIC |
| Management | Central platform team | Workload team or resource owner |
| Evaluation order | First (before NSGs) | Second (after security admin rules) |
| Override by workload teams | No (except AllowAlways allows NSG to evaluate) | Yes (workload teams control NSG rules) |
| Access types | Allow, AlwaysAllow, Deny | Allow, Deny |
| Maximum rules | 100 per rule collection | 1,000 per NSG |

## Rule Evaluation Order

Traffic evaluation follows this sequence:

1. **Security admin rules** (managed by AVNM) — evaluated first, in priority order (lower number = higher priority)
2. **NSG rules** — evaluated second, in priority order

### How access types interact with NSGs

| Security Admin Rule | NSG Rule | Final Result |
|--------------------|----------|--------------|
| **Deny** | Allow | **Denied** — security admin deny overrides NSG allow |
| **Deny** | Deny | **Denied** |
| **Allow** | Allow | **Allowed** |
| **Allow** | Deny | **Denied** — security admin allow passes to NSG, which denies |
| **AlwaysAllow** | Allow | **Allowed** |
| **AlwaysAllow** | Deny | **Allowed** — AlwaysAllow overrides NSG deny |
| No matching rule | Allow | **Allowed** — falls through to NSG evaluation |
| No matching rule | Deny | **Denied** — falls through to NSG evaluation |

Key insight:
- **Deny**: Blocks traffic regardless of NSGs. Use for hard security boundaries.
- **Allow**: Permits traffic to continue to NSG evaluation. NSGs can still deny it. Use when you want to set a baseline but let workload teams add further restrictions.
- **AlwaysAllow**: Permits traffic regardless of NSGs. Use for traffic that must always flow (e.g., monitoring probes, management traffic).

## Creating Security Admin Rules

### Step 1: Create a security admin configuration

```bash
az network manager security-admin-config create \
  --name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG
```

### Step 2: Create a rule collection

A rule collection groups rules together and associates them with network groups:

```bash
az network manager security-admin-config rule-collection create \
  --name prodRules \
  --configuration-name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --applies-to-groups network-group-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/networkGroups/prodVNets"
```

### Step 3: Create rules

#### Deny inbound SSH from the internet

```bash
az network manager security-admin-config rule-collection rule create \
  --name denySSHFromInternet \
  --rule-collection-name prodRules \
  --configuration-name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --kind "Custom" \
  --protocol "Tcp" \
  --access "Deny" \
  --priority 100 \
  --direction "Inbound" \
  --sources address-prefix="Internet" address-prefix-type="ServiceTag" \
  --destinations address-prefix="*" address-prefix-type="IPPrefix" \
  --dest-port-ranges 22
```

#### Deny inbound RDP from the internet

```bash
az network manager security-admin-config rule-collection rule create \
  --name denyRDPFromInternet \
  --rule-collection-name prodRules \
  --configuration-name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --kind "Custom" \
  --protocol "Tcp" \
  --access "Deny" \
  --priority 110 \
  --direction "Inbound" \
  --sources address-prefix="Internet" address-prefix-type="ServiceTag" \
  --destinations address-prefix="*" address-prefix-type="IPPrefix" \
  --dest-port-ranges 3389
```

#### Always allow Azure Load Balancer health probes

```bash
az network manager security-admin-config rule-collection rule create \
  --name alwaysAllowLBProbes \
  --rule-collection-name prodRules \
  --configuration-name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --kind "Custom" \
  --protocol "*" \
  --access "AlwaysAllow" \
  --priority 200 \
  --direction "Inbound" \
  --sources address-prefix="AzureLoadBalancer" address-prefix-type="ServiceTag" \
  --destinations address-prefix="*" address-prefix-type="IPPrefix" \
  --dest-port-ranges 0-65535
```

#### Deny all outbound to a known bad IP range

```bash
az network manager security-admin-config rule-collection rule create \
  --name denyBadRange \
  --rule-collection-name prodRules \
  --configuration-name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --kind "Custom" \
  --protocol "*" \
  --access "Deny" \
  --priority 300 \
  --direction "Outbound" \
  --sources address-prefix="*" address-prefix-type="IPPrefix" \
  --destinations address-prefix="198.51.100.0/24" address-prefix-type="IPPrefix" \
  --dest-port-ranges 0-65535
```

#### Allow management traffic from a jump box subnet

```bash
az network manager security-admin-config rule-collection rule create \
  --name allowManagement \
  --rule-collection-name prodRules \
  --configuration-name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --kind "Custom" \
  --protocol "Tcp" \
  --access "AlwaysAllow" \
  --priority 150 \
  --direction "Inbound" \
  --sources address-prefix="10.0.255.0/24" address-prefix-type="IPPrefix" \
  --destinations address-prefix="*" address-prefix-type="IPPrefix" \
  --dest-port-ranges 22 3389
```

## Rule Priority

- Priority range: 1–4096 (lower number = higher priority, evaluated first)
- Rules within a rule collection are evaluated in priority order
- When a rule matches, the action is taken and no further rules in that collection are evaluated
- If no rule matches, traffic passes to NSG evaluation

## Source and Destination Address Types

| Type | Description | Example |
|------|-------------|---------|
| `IPPrefix` | IP address or CIDR range | `10.0.0.0/8`, `*` (any) |
| `ServiceTag` | Azure service tag | `Internet`, `AzureLoadBalancer`, `VirtualNetwork` |

## Managing Security Admin Rules

```bash
# List rule collections
az network manager security-admin-config rule-collection list \
  --configuration-name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --output table

# List rules in a collection
az network manager security-admin-config rule-collection rule list \
  --rule-collection-name prodRules \
  --configuration-name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --output table

# Delete a rule
az network manager security-admin-config rule-collection rule delete \
  --name denyBadRange \
  --rule-collection-name prodRules \
  --configuration-name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --yes

# Delete a rule collection
az network manager security-admin-config rule-collection delete \
  --name prodRules \
  --configuration-name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --yes

# Delete a security admin configuration (must not be deployed)
az network manager security-admin-config delete \
  --name baselineSecurity \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --yes
```

## Common Security Baselines

### Enterprise baseline (recommended starting point)

| Priority | Direction | Rule | Access | Purpose |
|----------|-----------|------|--------|---------|
| 100 | Inbound | Deny SSH from Internet | Deny | Block SSH from public internet |
| 110 | Inbound | Deny RDP from Internet | Deny | Block RDP from public internet |
| 200 | Inbound | AlwaysAllow LB probes | AlwaysAllow | Ensure health probes always work |
| 210 | Inbound | AlwaysAllow monitoring | AlwaysAllow | Ensure Azure Monitor agent traffic flows |
| 300 | Inbound | Allow management from jump box | AlwaysAllow | Bastion/jump box access for admins |

### High-security baseline (add to enterprise baseline)

| Priority | Direction | Rule | Access | Purpose |
|----------|-----------|------|--------|---------|
| 120 | Inbound | Deny high-risk ports | Deny | Block SMB (445), Telnet (23), FTP (21) from internet |
| 310 | Outbound | Deny known bad IPs | Deny | Block outbound to threat intel IP ranges |
| 320 | Outbound | Deny IRC | Deny | Block IRC (6667) used by botnets |

## Limitations

- Maximum 100 security admin rules per rule collection
- Maximum 10 rule collections per security admin configuration
- Service tags are supported as sources and destinations, but not all service tags are available
- Security admin rules cannot reference application security groups (ASGs)
- Changes require redeployment to take effect

## Learn More

- [Security admin rules overview — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/concept-security-admins)
- [Create security admin rules — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/how-to-block-network-traffic-portal)
- [Security admin rules vs NSGs — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/concept-security-admins#security-admin-rules-versus-network-security-groups)
