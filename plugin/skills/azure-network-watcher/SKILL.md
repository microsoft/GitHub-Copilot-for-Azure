---
name: azure-network-watcher
description: "Diagnose, monitor, and troubleshoot Azure network issues using Network Watcher capabilities including packet capture, NSG flow logs, IP flow verify, next hop, connection troubleshoot, VPN troubleshoot, topology, and connection monitor. WHEN: network watcher, packet capture, flow logs, NSG flow logs, connection troubleshoot, IP flow verify, next hop, VPN troubleshoot, network topology, NSG diagnostics, connection monitor. DO NOT USE FOR: Azure Monitor metrics/logs (use general monitoring), Application Insights (use appinsights-instrumentation), resource health checks (use azure-diagnostics)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Network Watcher

Azure Network Watcher is a regional service that provides network monitoring and diagnostic tools for Azure IaaS resources. It enables you to monitor, diagnose, and gain insights into your network health and performance.

## When to Use This Skill

- Capturing and analyzing network packets on a VM to diagnose connectivity or application issues
- Enabling and querying NSG flow logs to understand traffic patterns and detect anomalies
- Verifying whether a specific network flow is allowed or denied by NSG rules (IP flow verify)
- Determining the next hop for traffic from a VM to identify routing problems
- Troubleshooting VPN gateway connections and site-to-site tunnel failures
- Running connection troubleshoot to test reachability between a source VM and a destination
- Setting up Connection Monitor to continuously test connectivity to Azure, on-premises, or external endpoints
- Viewing network topology for a resource group or virtual network
- Running NSG diagnostics to evaluate effective security rules on a NIC or subnet

## Rules

1. Network Watcher must be enabled in every region where you have IaaS resources. Azure automatically enables it when you create or update a virtual network in a subscription, but verify it exists before running diagnostics.
2. Always specify the correct Network Watcher region — diagnostic operations run against the Network Watcher in the same region as the target resource.
3. Packet captures require the Network Watcher VM extension installed on the target VM. Install it before attempting a capture.
4. NSG flow logs v2 are preferred over v1 — they include throughput information needed for Traffic Analytics.
5. Connection Monitor replaces the legacy Connection Monitor (classic) and Network Performance Monitor. Always use Connection Monitor v2 for new setups.
6. IP flow verify checks NSG rules only — it does not evaluate Azure Firewall rules, NVA rules, or route tables.
7. Next hop identifies the next hop type from Azure route tables — verify UDR configuration separately if the next hop is unexpected.
8. Store packet captures and flow logs in a storage account in the same region as the Network Watcher to avoid cross-region data transfer costs.
9. VPN troubleshoot operations can take several minutes to complete — do not assume immediate results.
10. The VM agent must be running and healthy for packet capture and connection troubleshoot to work.

## MCP Tools

| Tool | Method | Purpose |
|------|--------|---------|
| `azure__network` | `network_watcher_list` | List Network Watcher instances across subscriptions and regions |

> **Note:** Most Network Watcher diagnostic operations (packet capture, IP flow verify, next hop, connection troubleshoot, VPN troubleshoot) require CLI commands. Use the MCP tool to discover and verify Network Watcher instances, then use CLI for diagnostic operations.

## CLI Fallback

```bash
# List Network Watcher instances
az network watcher list --output table

# Enable Network Watcher in a region
az network watcher configure --resource-group NetworkWatcherRG --locations eastus --enabled true

# --- IP Flow Verify ---
az network watcher test-ip-flow \
  --resource-group myRG \
  --vm myVM \
  --direction Inbound \
  --protocol TCP \
  --local 10.0.0.4:* \
  --remote 10.1.0.4:443

# --- Next Hop ---
az network watcher show-next-hop \
  --resource-group myRG \
  --vm myVM \
  --source-ip 10.0.0.4 \
  --dest-ip 10.1.0.4

# --- Packet Capture ---
# Install the Network Watcher extension on the VM first
az vm extension set \
  --resource-group myRG \
  --vm-name myVM \
  --name NetworkWatcherAgentLinux \
  --publisher Microsoft.Azure.NetworkWatcher

# Create a packet capture
az network watcher packet-capture create \
  --resource-group myRG \
  --vm myVM \
  --name myCapture \
  --storage-account myStorageAccount \
  --time-limit 300 \
  --filters '[{"protocol":"TCP","localIPAddress":"10.0.0.4","localPort":"443"}]'

# List packet captures
az network watcher packet-capture list --location eastus --output table

# Stop a packet capture
az network watcher packet-capture stop --location eastus --name myCapture

# Show packet capture status
az network watcher packet-capture show-status --location eastus --name myCapture

# --- NSG Flow Logs ---
# Create NSG flow log (v2 with Traffic Analytics)
az network watcher flow-log create \
  --resource-group myRG \
  --name myFlowLog \
  --nsg myNSG \
  --storage-account myStorageAccount \
  --enabled true \
  --format JSON \
  --log-version 2 \
  --retention 90 \
  --traffic-analytics true \
  --workspace myLogAnalyticsWorkspace

# List flow logs
az network watcher flow-log list --location eastus --output table

# Show flow log configuration
az network watcher flow-log show --location eastus --name myFlowLog

# --- Connection Troubleshoot ---
az network watcher test-connectivity \
  --resource-group myRG \
  --source-resource myVM \
  --dest-address 10.1.0.4 \
  --dest-port 443 \
  --protocol TCP

# --- VPN Troubleshoot ---
az network watcher troubleshooting start \
  --resource-group myRG \
  --resource myVPNGateway \
  --resource-type vpnGateway \
  --storage-account myStorageAccount \
  --storage-path "https://mystorage.blob.core.windows.net/troubleshoot"

# Show VPN troubleshoot results
az network watcher troubleshooting show \
  --resource-group myRG \
  --resource myVPNGateway \
  --resource-type vpnGateway

# --- Connection Monitor ---
az network watcher connection-monitor create \
  --name myMonitor \
  --location eastus \
  --test-group-name myTestGroup \
  --endpoint-source-name myVM \
  --endpoint-source-resource-id "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Compute/virtualMachines/myVM" \
  --endpoint-dest-name myDest \
  --endpoint-dest-address 10.1.0.4 \
  --test-config-name tcpTest \
  --protocol Tcp \
  --tcp-port 443

# List connection monitors
az network watcher connection-monitor list --location eastus --output table

# --- Topology ---
az network watcher show-topology \
  --resource-group myRG \
  --location eastus

# --- NSG Diagnostics ---
az network watcher run-configuration-diagnostic \
  --resource "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkInterfaces/myNIC" \
  --direction Inbound \
  --profiles '[{"direction":"Inbound","protocol":"TCP","source":"10.0.0.4","destination":"10.0.1.4","destinationPort":"443"}]'
```

## Key Concepts

- **Network Watcher** is a regional service — there is one instance per region per subscription, automatically created in the `NetworkWatcherRG` resource group.
- **IP Flow Verify** tests whether a packet is allowed or denied by NSG rules. It evaluates both the NIC-level and subnet-level NSGs. It returns the specific rule name that allows or denies the flow.
- **Next Hop** returns the next hop type (VirtualNetwork, Internet, VirtualAppliance, VNetPeering, None) and the next hop IP address. Use it to diagnose asymmetric routing, black-holed traffic, or misconfigured UDRs.
- **Packet Capture** runs on a VM using the Network Watcher extension. Captures can be stored in a storage account or locally on the VM. Use capture filters to reduce noise and file size.
- **NSG Flow Logs** record information about IP traffic flowing through NSGs. Version 2 logs add byte and packet counts per flow, which are required for Traffic Analytics.
- **Traffic Analytics** processes NSG flow log data in a Log Analytics workspace to provide flow visualization, top talkers, security insights, and geo-mapping of traffic.
- **Connection Troubleshoot** performs a connectivity check from a source VM to a destination and returns the full hop-by-hop path along with issues detected at each hop.
- **VPN Troubleshoot** diagnoses VPN gateway and connection health, checking tunnel status, SA lifetime, routing configuration, and certificate validity.
- **Connection Monitor** provides continuous, agent-based end-to-end connectivity monitoring. It supports TCP, HTTP, and ICMP test protocols with configurable thresholds and alerting.
- **Topology** produces a visual or JSON representation of network resources and their relationships within a resource group or VNet.

## References

- [Connection Monitor setup and configuration](references/connection-monitor.md)
- [Packet capture creation and analysis](references/packet-capture.md)
- [NSG flow logs and Traffic Analytics](references/nsg-flow-logs.md)
- [IP flow verify diagnostic](references/ip-flow-verify.md)
- [Next hop diagnostic](references/next-hop.md)
- [Network Watcher overview — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/network-watcher-monitoring-overview)
- [Network Watcher FAQ — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/frequently-asked-questions)
