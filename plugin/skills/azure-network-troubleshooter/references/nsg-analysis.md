# NSG Troubleshooting Guide

Diagnose and fix Azure Network Security Group (NSG) issues including effective rule analysis, priority conflicts, ASG misconfigurations, and flow log analysis.

## How NSGs Work

NSGs contain security rules that allow or deny network traffic. Rules are evaluated by **priority** (lowest number = highest priority). Key concepts:

- **Two NSG attachment points:** Subnet level and NIC level. Traffic must pass BOTH if both are present.
- **Stateful:** If outbound traffic is allowed, the return inbound traffic is automatically permitted (and vice versa).
- **Default rules:** Cannot be deleted, but can be overridden by rules with lower priority numbers.
- **Processing stops** at the first matching rule.

### Default Rules (always present, priority 65000+)

| Priority | Name | Direction | Action |
|----------|------|-----------|--------|
| 65000 | AllowVnetInBound | Inbound | Allow VirtualNetwork → VirtualNetwork |
| 65001 | AllowAzureLoadBalancerInBound | Inbound | Allow AzureLoadBalancer → Any |
| 65500 | DenyAllInBound | Inbound | Deny Any → Any |
| 65000 | AllowVnetOutBound | Outbound | Allow VirtualNetwork → VirtualNetwork |
| 65001 | AllowInternetOutBound | Outbound | Allow Any → Internet |
| 65500 | DenyAllOutBound | Outbound | Deny Any → Any |

## Step 1 — Check If NSG Is Blocking Traffic

### IP Flow Verify (fastest check)

```bash
az network watcher test-ip-flow \
  --resource-group <rg> \
  --vm <vm-name> \
  --direction <Inbound|Outbound> \
  --protocol <TCP|UDP> \
  --local "<local-ip>:<local-port>" \
  --remote "<remote-ip>:<remote-port>"
```

The output tells you:
- `Access: Allow` or `Access: Deny`
- The **name of the rule** that made the decision
- Whether it's a subnet-level or NIC-level NSG rule

### View Effective Security Rules

```bash
# This shows ALL rules that apply to a NIC (merged from subnet + NIC NSGs)
az network nic list-effective-nsg \
  --resource-group <rg> \
  --name <nic-name> \
  --output json
```

Parse the output for readability:
```bash
az network nic list-effective-nsg -g <rg> -n <nic> -o json | \
  jq '.value[].effectiveSecurityRules[] | {
    name,
    priority,
    direction,
    access,
    protocol,
    srcAddr: .sourceAddressPrefix,
    srcPort: .sourcePortRange,
    dstAddr: .destinationAddressPrefix,
    dstPort: .destinationPortRange
  }' | jq -s 'sort_by(.priority)'
```

## Step 2 — Identify the Problem

### Problem: Priority Conflicts

**Symptom:** A rule you created to allow traffic is not working because a higher-priority Deny rule blocks it first.

```bash
# List all rules sorted by priority
az network nsg rule list \
  --resource-group <rg> \
  --nsg-name <nsg-name> \
  --output table \
  --query "sort_by([], &priority)"
```

**Rules are evaluated in priority order (lowest number first).** A Deny rule at priority 100 blocks traffic even if an Allow rule exists at priority 200.

**Fix:** Either:
- Delete or modify the conflicting Deny rule
- Create your Allow rule with a lower priority number (higher priority)

```bash
# Create a higher-priority allow rule
az network nsg rule create \
  --resource-group <rg> \
  --nsg-name <nsg-name> \
  --name AllowMyTraffic \
  --priority 90 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-address-prefixes <source-cidr> \
  --destination-port-ranges <port> \
  --destination-address-prefixes <dest-cidr>
```

### Problem: Subnet NSG + NIC NSG Double Filtering

**Symptom:** Traffic is allowed by one NSG but blocked by the other. Both must allow the traffic.

**Traffic flow for inbound:**
```
Internet → Subnet NSG (inbound rules) → NIC NSG (inbound rules) → VM
```

**Traffic flow for outbound:**
```
VM → NIC NSG (outbound rules) → Subnet NSG (outbound rules) → Internet
```

**Diagnosis:**
```bash
# Check which NSGs are attached
az network vnet subnet show -g <rg> --vnet-name <vnet> -n <subnet> \
  --query "networkSecurityGroup.id"

az network nic show -g <rg> -n <nic> \
  --query "networkSecurityGroup.id"

# Check rules on each NSG separately
az network nsg rule list -g <rg> --nsg-name <subnet-nsg> -o table
az network nsg rule list -g <rg> --nsg-name <nic-nsg> -o table
```

**Best practice:** Use NSGs at the subnet level only. If you must use both, ensure rules are consistent.

### Problem: Application Security Group (ASG) Misconfiguration

**Symptom:** Rules referencing ASGs don't match traffic as expected.

```bash
# List ASGs and their members
az network asg list -g <rg> -o table

# Check which ASGs a NIC belongs to
az network nic show -g <rg> -n <nic> \
  --query "ipConfigurations[].applicationSecurityGroups[].id"

# List NSG rules that reference ASGs
az network nsg rule list -g <rg> --nsg-name <nsg> -o json | \
  jq '.[] | select(.sourceApplicationSecurityGroups != null or .destinationApplicationSecurityGroups != null) | {name, priority, direction, access}'
```

**Common ASG pitfalls:**
- The NIC must be in the **same VNet** as other NICs in the ASG
- ASGs can only be used as source OR destination in a rule, **not both** in the same rule (unless both ASGs have members in the same VNet)
- A NIC can belong to multiple ASGs
- Rules with ASG sources/destinations don't appear in effective rules with the ASG name — they expand to IP addresses

### Problem: Service Tag Not Covering Expected IPs

**Symptom:** A rule using a service tag (e.g., `Storage`, `AzureCloud`) doesn't match traffic you expect it to match.

```bash
# List available service tags and their IP ranges
az network list-service-tags --location <region> \
  --query "values[?name=='<ServiceTag>'].properties.addressPrefixes" -o json

# Common service tags
az network list-service-tags --location <region> \
  --query "values[].name" -o tsv | sort
```

**Common issues:**
- Service tags are **region-specific.** `Storage.EastUS` only covers storage in East US.
- Some services use dynamic IPs. The service tag is updated weekly.
- `VirtualNetwork` service tag includes: VNet address space, peered VNet address spaces, on-premises ranges (from VPN/ER), and Azure service endpoint addresses.

## Step 3 — Analyze NSG Flow Logs

Flow logs show every connection attempt and whether it was allowed or denied.

### Enable flow logs

```bash
# Create a storage account for flow logs (if not already existing)
az storage account create \
  --resource-group <rg> \
  --name <storage-account> \
  --location <region> \
  --sku Standard_LRS

# Enable flow logs (v2 with traffic analytics)
az network watcher flow-log create \
  --resource-group <rg> \
  --name <flow-log-name> \
  --nsg <nsg-resource-id> \
  --storage-account <storage-account-id> \
  --enabled true \
  --format JSON \
  --log-version 2 \
  --retention 30 \
  --traffic-analytics true \
  --workspace <log-analytics-workspace-id>
```

### Query flow logs via Log Analytics

```kusto
// Denied flows in the last hour
AzureNetworkAnalytics_CL
| where TimeGenerated > ago(1h)
| where FlowStatus_s == "D"
| project TimeGenerated, SrcIP_s, DestIP_s, DestPort_d, L4Protocol_s, NSGRule_s
| order by TimeGenerated desc
| take 50

// Top denied source IPs
AzureNetworkAnalytics_CL
| where TimeGenerated > ago(24h)
| where FlowStatus_s == "D"
| summarize DeniedFlows = count() by SrcIP_s
| order by DeniedFlows desc
| take 20

// Allowed flows to a specific destination
AzureNetworkAnalytics_CL
| where TimeGenerated > ago(1h)
| where FlowStatus_s == "A"
| where DestIP_s == "<target-ip>"
| project TimeGenerated, SrcIP_s, DestPort_d, L4Protocol_s, NSGRule_s
| order by TimeGenerated desc
```

### Common "Traffic Denied" Patterns

| Pattern | Likely Cause | Fix |
|---------|-------------|-----|
| Denied by `DefaultRule_DenyAllInBound` | No allow rule exists for this inbound traffic | Create an explicit allow rule |
| Denied by `DefaultRule_DenyAllOutBound` | No allow rule exists for this outbound traffic | Create an explicit outbound allow rule (rare — default allows internet) |
| Denied by a named rule | An explicit deny rule is blocking traffic | Check if the deny rule is too broad or if your allow rule has lower priority |
| Allowed by subnet NSG, denied by NIC NSG | Double-NSG filtering | Add matching rule to NIC NSG or remove NIC-level NSG |
| Allowed by NSG but connection still fails | Problem is NOT the NSG — check routing, DNS, firewall, or destination service | Continue to routing or DNS troubleshooting |

## NSG Best Practices

1. **Use subnet-level NSGs** as the primary enforcement point. Avoid NIC-level NSGs unless you need per-VM differentiation.
2. **Use Application Security Groups** to group VMs by role instead of managing IP-based rules.
3. **Leave a gap between priority numbers** (e.g., 100, 200, 300) to make inserting new rules easy.
4. **Use service tags** instead of hard-coded IP addresses wherever possible.
5. **Enable flow logs** on all NSGs for auditing and troubleshooting.
6. **Document NSG rules** with descriptive names and the `--description` field.
7. **Avoid "allow all" rules** (`*` source, `*` port) — be as specific as possible.

## Related Resources

- [Network security groups overview](https://learn.microsoft.com/azure/virtual-network/network-security-groups-overview)
- [NSG flow logs overview](https://learn.microsoft.com/azure/network-watcher/nsg-flow-logs-overview)
- [Application security groups](https://learn.microsoft.com/azure/virtual-network/application-security-groups)
- [Service tags overview](https://learn.microsoft.com/azure/virtual-network/service-tags-overview)
- For firewall-level filtering → use `azure-firewall` skill
- For VNet and subnet management → use `azure-virtual-network` skill
