# IP Flow Verify

IP flow verify tests whether a packet is allowed or denied to or from a virtual machine based on network security group (NSG) rules. It identifies the specific NSG rule that allows or blocks the traffic, making it the fastest way to diagnose NSG-related connectivity issues.

## How It Works

IP flow verify evaluates the effective NSG rules applied to a VM's network interface. It checks:

1. NSG rules at the **NIC level** (if an NSG is associated with the NIC)
2. NSG rules at the **subnet level** (if an NSG is associated with the subnet)

It returns the result (Allow or Deny) and the name of the specific rule that matched. If no rule matches, the default rules apply (DenyAllInbound for inbound, AllowInternetOutbound for outbound).

> **Important:** IP flow verify evaluates NSG rules only. It does not check Azure Firewall rules, NVA (Network Virtual Appliance) rules, route tables, or application-level firewalls.

## Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `--vm` | Target VM name | `myVM` |
| `--resource-group` | Resource group of the VM | `myRG` |
| `--direction` | Traffic direction | `Inbound` or `Outbound` |
| `--protocol` | Network protocol | `TCP`, `UDP`, or `*` |
| `--local` | Local (VM) IP and port | `10.0.0.4:443` or `10.0.0.4:*` |
| `--remote` | Remote IP and port | `10.1.0.4:49152` or `10.1.0.4:*` |

The `--local` parameter refers to the VM being tested. The `--remote` parameter refers to the other endpoint.

## CLI Usage

### Test inbound TCP traffic to port 443

```bash
az network watcher test-ip-flow \
  --resource-group myRG \
  --vm myVM \
  --direction Inbound \
  --protocol TCP \
  --local 10.0.0.4:443 \
  --remote 203.0.113.10:49152
```

**Output (allowed):**
```json
{
  "access": "Allow",
  "ruleName": "AllowHTTPS"
}
```

**Output (denied):**
```json
{
  "access": "Deny",
  "ruleName": "DefaultRule_DenyAllInBound"
}
```

### Test outbound traffic to the internet

```bash
az network watcher test-ip-flow \
  --resource-group myRG \
  --vm myVM \
  --direction Outbound \
  --protocol TCP \
  --local 10.0.0.4:* \
  --remote 8.8.8.8:443
```

### Test inbound SSH access

```bash
az network watcher test-ip-flow \
  --resource-group myRG \
  --vm myVM \
  --direction Inbound \
  --protocol TCP \
  --local 10.0.0.4:22 \
  --remote 198.51.100.5:49152
```

### Test UDP traffic (DNS)

```bash
az network watcher test-ip-flow \
  --resource-group myRG \
  --vm myVM \
  --direction Outbound \
  --protocol UDP \
  --local 10.0.0.4:* \
  --remote 168.63.129.16:53
```

### Test inbound traffic from a VNet peer

```bash
az network watcher test-ip-flow \
  --resource-group myRG \
  --vm myVM \
  --direction Inbound \
  --protocol TCP \
  --local 10.0.0.4:1433 \
  --remote 10.1.0.4:49152
```

## Interpreting Results

### Access Values

| Result | Meaning |
|--------|---------|
| `Allow` | Traffic is permitted by the identified NSG rule |
| `Deny` | Traffic is blocked by the identified NSG rule |

### Common Rule Names

| Rule Name Pattern | Meaning |
|-------------------|---------|
| `AllowVnetInBound` | Default rule: allows all inbound traffic within the VNet |
| `AllowAzureLoadBalancerInBound` | Default rule: allows Azure Load Balancer health probes |
| `DenyAllInBound` | Default rule: denies all other inbound traffic |
| `AllowVnetOutBound` | Default rule: allows all outbound traffic within the VNet |
| `AllowInternetOutBound` | Default rule: allows outbound traffic to the internet |
| `DenyAllOutBound` | Default rule: denies all other outbound traffic |
| Custom names (e.g., `AllowHTTPS`, `DenySSH`) | User-defined NSG rules |

### Default Rule Evaluation

If the result shows a `DefaultRule_*` rule, it means no user-defined rule matched the traffic. Default rules have the lowest priority (65000–65500) and serve as catch-all rules.

## Diagnostic Scenarios

### Scenario 1: VM cannot receive web traffic

```bash
# Test inbound HTTPS
az network watcher test-ip-flow \
  --resource-group myRG --vm webVM \
  --direction Inbound --protocol TCP \
  --local 10.0.0.4:443 --remote 0.0.0.0:49152
```

If result is `Deny` with `DefaultRule_DenyAllInBound`, you need to create an NSG rule allowing inbound TCP 443.

### Scenario 2: VM cannot connect to a database

```bash
# Test outbound to SQL Server
az network watcher test-ip-flow \
  --resource-group myRG --vm appVM \
  --direction Outbound --protocol TCP \
  --local 10.0.0.4:* --remote 10.1.0.4:1433
```

If result is `Deny`, check the source VM's outbound NSG rules. Also test inbound on the database VM:

```bash
az network watcher test-ip-flow \
  --resource-group myRG --vm dbVM \
  --direction Inbound --protocol TCP \
  --local 10.1.0.4:1433 --remote 10.0.0.4:49152
```

### Scenario 3: Verify that SSH is blocked from the internet

```bash
az network watcher test-ip-flow \
  --resource-group myRG --vm myVM \
  --direction Inbound --protocol TCP \
  --local 10.0.0.4:22 --remote 203.0.113.1:49152
```

If result is `Deny`, SSH is properly blocked. If `Allow`, identify the rule and evaluate whether it should be removed.

## Limitations

- Only evaluates NSG rules — does not account for Azure Firewall, NVAs, or route-based filtering
- Cannot test traffic that bypasses NSGs (e.g., traffic to service endpoints, private endpoints)
- Requires the VM to be in a running state
- Tests a single flow at a time — for bulk analysis, use NSG diagnostics instead
- The IP addresses must be valid for the VM's NIC configuration

## When to Use IP Flow Verify vs Other Tools

| Tool | Use When |
|------|----------|
| **IP flow verify** | Quick check: is traffic allowed or denied by NSGs? |
| **NSG diagnostics** | Evaluate multiple flows or get effective security rules |
| **Connection troubleshoot** | Full end-to-end connectivity test including routing |
| **Next hop** | Determine where traffic is being routed |
| **Effective security rules** | View all effective NSG rules on a NIC |

## Learn More

- [IP flow verify overview — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/ip-flow-verify-overview)
- [Diagnose VM network traffic filter problem — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/diagnose-vm-network-traffic-filtering-problem)
- [Network security groups overview — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network/network-security-groups-overview)
