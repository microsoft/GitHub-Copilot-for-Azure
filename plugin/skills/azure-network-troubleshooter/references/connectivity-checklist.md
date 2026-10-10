# Universal Connectivity Troubleshooting Checklist

Systematic checklist for diagnosing any Azure network connectivity failure. Work through each step in order — most issues are found in steps 1-3.

## Prerequisites

```bash
# Ensure Network Watcher is enabled in the region
az network watcher configure --resource-group NetworkWatcherRG --locations <region> --enabled true

# Verify you have the right subscription context
az account show --query "{name:name, id:id}" -o table
```

## Step 1 — Verify NSGs Allow Traffic (IP Flow Verify)

NSG misconfigurations are the #1 cause of connectivity failures. Check both source and destination.

### Check outbound from source

```bash
az network watcher test-ip-flow \
  --resource-group <source-rg> \
  --vm <source-vm> \
  --direction Outbound \
  --protocol TCP \
  --local "<source-ip>:*" \
  --remote "<dest-ip>:<dest-port>"
```

### Check inbound at destination

```bash
az network watcher test-ip-flow \
  --resource-group <dest-rg> \
  --vm <dest-vm> \
  --direction Inbound \
  --protocol TCP \
  --local "<dest-ip>:<dest-port>" \
  --remote "<source-ip>:*"
```

### Interpret results

| Result | Meaning | Action |
|--------|---------|--------|
| `Access: Allow` | NSG permits this flow | NSG is not the problem — continue to Step 2 |
| `Access: Deny`, rule name shown | A specific NSG rule blocks the flow | Check the named rule and its priority |
| `Access: Deny`, `DefaultRule_DenyAllInBound` | No rule allows this inbound flow | Add an allow rule with lower priority number |

### View all effective NSG rules

```bash
# Shows the merged result of all NSG rules on a NIC (subnet + NIC level)
az network nic list-effective-nsg \
  --resource-group <rg> \
  --name <nic-name> \
  --output json | jq '.value[].effectiveSecurityRules[] | {name, protocol, sourceAddress: .sourceAddressPrefix, destAddress: .destinationAddressPrefix, destPort: .destinationPortRange, access, priority, direction}'
```

### Common NSG pitfalls

- **Subnet NSG + NIC NSG both apply.** Traffic must pass BOTH. A rule allowing traffic on the subnet NSG is useless if the NIC NSG denies it.
- **Priority matters.** Lower number = higher priority. A Deny at priority 100 overrides an Allow at priority 200.
- **Service tags vs. IP addresses.** Verify the service tag covers the expected IP ranges. Use `az network list-service-tags --location <region>` to check.
- **Return traffic.** NSGs are stateful — if outbound is allowed, the return traffic is automatically permitted. But if using Azure Firewall or an NVA, those may NOT be stateful for all protocols.

## Step 2 — Check Effective Routes (Next Hop)

After confirming NSGs allow traffic, verify the traffic is routed correctly.

### Determine next hop

```bash
az network watcher show-next-hop \
  --resource-group <rg> \
  --vm <vm-name> \
  --source-ip <source-ip> \
  --dest-ip <dest-ip>
```

### Interpret next hop results

| Next Hop Type | Meaning | Potential Issue |
|---------------|---------|-----------------|
| `VnetLocal` | Destination is in the same VNet or peered VNet | Expected for VNet traffic — check dest VM/NIC is healthy |
| `Internet` | Traffic routes to the internet | If destination is in Azure, a route is missing |
| `VirtualNetworkGateway` | Traffic routes through VPN/ER gateway | Verify gateway is running and tunnel is up |
| `VirtualAppliance` | Traffic routes through an NVA | Verify NVA is forwarding traffic (IP forwarding enabled) |
| `None` | Traffic is dropped | A UDR with next hop "None" is blackholing this traffic |

### View full effective route table

```bash
az network nic show-effective-route-table \
  --resource-group <rg> \
  --name <nic-name> \
  --output table
```

Look for:
- **Conflicting routes:** Multiple routes for the same prefix with different next hops. Most specific prefix wins. If prefixes are equal, priority is: UDR > BGP > system route.
- **Missing routes:** If the destination subnet has no route, traffic uses the default `0.0.0.0/0` route.
- **Black hole routes:** Routes with next hop `None` explicitly drop traffic.

## Step 3 — Verify DNS Resolution

If the destination is specified by hostname (FQDN), DNS must resolve correctly.

### Test DNS from inside the VM

```bash
az vm run-command invoke \
  --resource-group <rg> \
  --name <vm-name> \
  --command-id RunShellScript \
  --scripts "nslookup <hostname> && cat /etc/resolv.conf"
```

For Windows VMs:

```bash
az vm run-command invoke \
  --resource-group <rg> \
  --name <vm-name> \
  --command-id RunPowerShellScript \
  --scripts "Resolve-DnsName <hostname>; Get-DnsClientServerAddress"
```

### Check DNS configuration

```bash
# Check VNet DNS settings
az network vnet show -g <rg> -n <vnet> --query "dhcpOptions.dnsServers"

# If empty, Azure default DNS (168.63.129.16) is used
# If custom DNS servers are set, verify they are reachable
```

For detailed DNS troubleshooting → see [dns-debug.md](dns-debug.md)

## Step 4 — Test End-to-End Connectivity

Use Network Watcher connection troubleshoot for a comprehensive path analysis.

### VM-to-VM connectivity test

```bash
az network watcher test-connectivity \
  --resource-group <source-rg> \
  --source-resource <source-vm-resource-id> \
  --dest-resource <dest-vm-resource-id> \
  --dest-port <port>
```

### VM-to-external-endpoint test

```bash
az network watcher test-connectivity \
  --resource-group <source-rg> \
  --source-resource <source-vm-resource-id> \
  --dest-address <ip-or-fqdn> \
  --dest-port <port>
```

### Interpret connection troubleshoot output

The output includes:
- **connectionStatus:** `Reachable`, `Unreachable`, or `Unknown`
- **avgLatencyInMs:** Average latency for the connection
- **hops:** Array of hops with issues identified at each

```bash
# Parse hops for issues
az network watcher test-connectivity \
  --resource-group <rg> \
  --source-resource <vm-id> \
  --dest-address 10.0.2.4 \
  --dest-port 443 \
  --query "hops[].{type:type, address:address, issues:issues}" -o json
```

## Step 5 — Check Resource Health

Verify the networking resources themselves are healthy.

```bash
# Check VPN gateway health
az network vnet-gateway show -g <rg> -n <gw> --query "provisioningState"

# Check load balancer backend health
az network lb probe show -g <rg> --lb-name <lb> -n <probe> 

# Check Application Gateway backend health
az network application-gateway show-backend-health -g <rg> -n <appgw>

# Check ExpressRoute circuit state
az network express-route show -g <rg> -n <circuit> --query "{provisioningState:provisioningState, serviceProviderState:serviceProviderProvisioningState, circuitState:circuitProvisioningState}"
```

## Step 6 — Review Activity Logs

Check if a recent configuration change caused the issue.

```bash
# Network configuration changes in the last 2 hours
az monitor activity-log list \
  --resource-group <rg> \
  --start-time "$(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --query "[?contains(operationName.value,'Microsoft.Network') && status.value=='Succeeded'].{operation:operationName.localizedValue, caller:caller, time:eventTimestamp}" \
  --output table

# Check for failed deployments
az monitor activity-log list \
  --resource-group <rg> \
  --start-time "$(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --query "[?status.value=='Failed'].{operation:operationName.localizedValue, error:properties.statusMessage, time:eventTimestamp}" \
  --output table
```

### Common configuration changes that break connectivity

- NSG rule added or modified
- Route table associated or dissociated from a subnet
- UDR added or changed
- VNet peering created, deleted, or resynchronized
- DNS server settings changed on VNet
- Firewall rule collection modified
- VPN connection shared key rotated
- Subnet delegation changed

## Decision Tree Summary

```
Connectivity Failure
├── NSG Deny? (Step 1)
│   └── YES → Fix NSG rule (check priority, both subnet+NIC NSGs)
├── Wrong Next Hop? (Step 2)
│   └── YES → Fix route table / UDR / peering / gateway
├── DNS Failure? (Step 3)
│   └── YES → Fix DNS zone / VNet link / resolver config
├── End-to-End Unreachable? (Step 4)
│   └── YES → Analyze hop-by-hop for the failing component
├── Resource Unhealthy? (Step 5)
│   └── YES → Remediate or re-provision the resource
└── Recent Config Change? (Step 6)
    └── YES → Correlate change with failure onset and revert if needed
```

## Related Skills

- For detailed NSG analysis → see [nsg-analysis.md](nsg-analysis.md)
- For routing issues → see [routing-debug.md](routing-debug.md)
- For DNS problems → see [dns-debug.md](dns-debug.md)
- For latency issues → see [latency-debug.md](latency-debug.md)
- For VPN-specific troubleshooting → use `azure-vpn-gateway` skill
- For ExpressRoute issues → use `azure-expressroute` skill
