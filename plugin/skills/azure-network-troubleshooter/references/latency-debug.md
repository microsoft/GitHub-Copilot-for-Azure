# Latency and Performance Troubleshooting Guide

Diagnose and fix Azure network latency issues, packet loss, throughput degradation, and intermittent connectivity using Connection Monitor, Network Watcher, and performance analysis tools.

## Baseline: Expected Azure Network Latency

Before troubleshooting, know what's normal:

| Scenario | Expected Latency |
|----------|-----------------|
| Same Availability Zone | < 1 ms |
| Cross-AZ (same region) | 1–2 ms |
| Cross-region (same geography) | 5–30 ms |
| Cross-geography (e.g., US to Europe) | 70–150 ms |
| VPN Gateway (same region) | 5–15 ms overhead |
| ExpressRoute (private peering) | 1–5 ms overhead from edge |
| ExpressRoute (Microsoft peering) | Variable by POP distance |

Reference: [Azure network round-trip latency statistics](https://learn.microsoft.com/azure/networking/azure-network-latency)

## Step 1 — Measure Current Latency

### Using Connection Monitor

Connection Monitor provides continuous monitoring and is the primary tool for latency diagnosis.

```bash
# List existing connection monitors
az network watcher connection-monitor list \
  --location <region> \
  --output table

# Create a connection monitor to measure latency
az network watcher connection-monitor create \
  --name <monitor-name> \
  --location <region> \
  --test-group-name "latency-test" \
  --endpoint-source-name "source-vm" \
  --endpoint-source-resource-id <source-vm-id> \
  --endpoint-dest-name "destination" \
  --endpoint-dest-address <dest-ip-or-fqdn> \
  --test-config-name "tcp-test" \
  --protocol Tcp \
  --tcp-port <port> \
  --test-config-threshold-round-trip-time-ms <threshold>
```

### Quick Latency Test from VM

```bash
# Linux — TCP latency test
az vm run-command invoke -g <rg> -n <vm> \
  --command-id RunShellScript \
  --scripts "
    # Install hping3 if needed: apt-get install -y hping3
    hping3 -S -p <port> -c 10 <dest-ip> 2>&1 | tail -3
  "

# Linux — ICMP latency test
az vm run-command invoke -g <rg> -n <vm> \
  --command-id RunShellScript \
  --scripts "ping -c 20 <dest-ip> | tail -5"

# Windows — TCP latency with Test-NetConnection
az vm run-command invoke -g <rg> -n <vm> \
  --command-id RunPowerShellScript \
  --scripts "
    1..10 | ForEach-Object {
      \$sw = [System.Diagnostics.Stopwatch]::StartNew()
      \$result = Test-NetConnection -ComputerName '<dest-ip>' -Port <port> -WarningAction SilentlyContinue
      \$sw.Stop()
      [PSCustomObject]@{Attempt=\$_; Connected=\$result.TcpTestSucceeded; LatencyMs=\$sw.ElapsedMilliseconds}
    } | Format-Table
  "
```

### Using Network Watcher Connection Troubleshoot

```bash
# Provides hop-by-hop latency analysis
az network watcher test-connectivity \
  --resource-group <rg> \
  --source-resource <source-vm-id> \
  --dest-address <dest-ip> \
  --dest-port <port> \
  --query "{status:connectionStatus, latency:avgLatencyInMs, hops:hops[].{type:type, address:address, latency:roundTripTimeMs, issues:issues}}" \
  -o json
```

## Step 2 — Identify the Latency Source

### Check hop-by-hop latency

From the connection troubleshoot output, look at which hop introduces the most latency:

| Hop Type | High Latency Cause |
|----------|-------------------|
| `Source` | VM CPU/memory pressure, NIC driver issues |
| `VirtualNetwork` | Unexpected routing through NVA, cross-AZ traffic |
| `VirtualNetworkGateway` | VPN encryption overhead, gateway SKU limits |
| `Internet` | ISP routing, geographic distance |
| `VirtualAppliance` | NVA overloaded, single-NIC bottleneck |

### Check VM-level performance

```bash
# Linux — check if the VM itself is the bottleneck
az vm run-command invoke -g <rg> -n <vm> \
  --command-id RunShellScript \
  --scripts "
    echo '=== CPU ==='
    top -bn1 | head -5
    echo '=== Network Interface Stats ==='
    cat /proc/net/dev
    echo '=== TCP Stats ==='
    ss -s
    echo '=== Dropped Packets ==='
    netstat -s | grep -i drop
  "
```

## Common Latency Problems

### Problem: NVA/Firewall Bottleneck

**Symptom:** Latency increases when traffic routes through an NVA or Azure Firewall. Normal when going direct.

**Diagnosis:**
```bash
# Check if traffic goes through an NVA
az network watcher show-next-hop -g <rg> --vm <vm> --source-ip <src> --dest-ip <dst>

# If next hop is VirtualAppliance, check NVA metrics
az monitor metrics list \
  --resource <firewall-resource-id> \
  --metric "Throughput" "Latency" \
  --interval PT1M \
  --output table
```

**Fixes:**
- Scale up the NVA/Firewall SKU
- Use Azure Firewall Premium for hardware-accelerated processing
- Bypass the firewall for trusted traffic (adjust UDRs)
- Use multiple NVA instances behind an internal load balancer

### Problem: TCP Window Sizing

**Symptom:** High latency for large data transfers despite low ping times. Throughput is much lower than link capacity.

**Explanation:** TCP throughput is limited by: `Throughput = Window Size / RTT`. With a 64 KB window and 50 ms RTT, max throughput is ~10 Mbps regardless of available bandwidth.

**Diagnosis:**
```bash
# Linux — check current TCP window settings
az vm run-command invoke -g <rg> -n <vm> \
  --command-id RunShellScript \
  --scripts "
    echo '=== TCP Window Scaling ==='
    sysctl net.ipv4.tcp_window_scaling
    echo '=== TCP Buffer Sizes ==='
    sysctl net.ipv4.tcp_rmem
    sysctl net.ipv4.tcp_wmem
    echo '=== Max Buffer ==='
    sysctl net.core.rmem_max
    sysctl net.core.wmem_max
  "
```

**Fix (Linux):**
```bash
# Increase TCP buffer sizes for high-latency, high-bandwidth paths
sysctl -w net.ipv4.tcp_window_scaling=1
sysctl -w net.ipv4.tcp_rmem="4096 87380 16777216"
sysctl -w net.ipv4.tcp_wmem="4096 87380 16777216"
sysctl -w net.core.rmem_max=16777216
sysctl -w net.core.wmem_max=16777216
```

### Problem: MTU/MSS Issues

**Symptom:** Small packets work fine, large packets fail or fragment. Connections hang during data transfer after TCP handshake succeeds. Path MTU discovery failures.

**Azure MTU:** Azure VNets support 1500-byte MTU. VPN tunnels reduce effective MTU due to encapsulation overhead.

| Path | Effective MTU |
|------|--------------|
| VNet to VNet (same region) | 1500 |
| VNet peering (cross-region) | 1500 |
| VPN Gateway (IPsec) | ~1400 (depends on cipher) |
| ExpressRoute | 1500 |
| VNet to Internet | 1500 (may be lower depending on ISP) |

**Diagnosis:**
```bash
# Test path MTU (Linux)
az vm run-command invoke -g <rg> -n <vm> \
  --command-id RunShellScript \
  --scripts "
    # Find MTU by sending non-fragmentable packets of decreasing size
    for size in 1500 1472 1400 1372 1300; do
      echo \"Testing size \$size:\"
      ping -M do -s \$size -c 1 <dest-ip> 2>&1 | grep -E 'bytes from|too long'
    done
  "
```

**Fix:**
```bash
# Clamp MSS on the NIC (prevents fragmentation)
iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu

# Or set a fixed MSS for VPN traffic
iptables -t mangle -A FORWARD -o eth0 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1360
```

### Problem: ExpressRoute vs VPN Performance

**Symptom:** Slower-than-expected performance over hybrid connection.

**ExpressRoute performance checks:**
```bash
# Check ExpressRoute circuit bandwidth utilization
az monitor metrics list \
  --resource <expressroute-circuit-id> \
  --metric "BitsInPerSecond" "BitsOutPerSecond" \
  --interval PT5M \
  --output table

# Check ExpressRoute gateway connection latency
az monitor metrics list \
  --resource <expressroute-gateway-id> \
  --metric "ExpressRouteGatewayBitsPerSecond" \
  --interval PT5M \
  --output table
```

**VPN performance checks:**
```bash
# Check VPN gateway metrics
az monitor metrics list \
  --resource <vpn-gateway-id> \
  --metric "TunnelBandwidth" "TunnelEgressBytes" "TunnelIngressBytes" \
  --interval PT5M \
  --output table
```

**VPN Gateway throughput by SKU:**

| SKU | Max Throughput | Max Tunnels |
|-----|---------------|-------------|
| VpnGw1 | 650 Mbps | 30 S2S |
| VpnGw2 | 1 Gbps | 30 S2S |
| VpnGw3 | 1.25 Gbps | 30 S2S |
| VpnGw4 | 5 Gbps | 100 S2S |
| VpnGw5 | 10 Gbps | 100 S2S |

**Fixes:**
- Upgrade VPN Gateway SKU for higher throughput
- Use ExpressRoute instead of VPN for latency-sensitive workloads
- Enable ExpressRoute FastPath for ultra-low latency (bypasses gateway)
- Use multiple VPN tunnels with ECMP for aggregate throughput

### Problem: Proximity and Region Placement

**Symptom:** Latency between resources that should be "close" is higher than expected.

**Diagnosis:**
```bash
# Check VM placement (availability zone)
az vm show -g <rg> -n <vm> --query "{location:location, zone:zones[0]}"

# Check if VMs are in the same proximity placement group
az vm show -g <rg> -n <vm> --query "proximityPlacementGroup.id"
```

**Fixes:**
- Use **Proximity Placement Groups** to co-locate VMs in the same datacenter
- Place VMs in the **same Availability Zone** for sub-millisecond latency
- Use **Accelerated Networking** for reduced VM-to-VM latency

```bash
# Enable Accelerated Networking on a NIC
az network nic update -g <rg> -n <nic> --accelerated-networking true

# Verify it's enabled
az network nic show -g <rg> -n <nic> --query "enableAcceleratedNetworking"
```

## Packet Loss Troubleshooting

### Detect packet loss

```bash
# Using Connection Monitor (continuous)
az network watcher connection-monitor query \
  --connection-monitor-name <name> \
  --location <region> \
  --query "testResults[].{test:testConfigurationName, loss:checksFailedPercent, latency:roundTripTimeMs}"

# Quick check from VM (Linux)
az vm run-command invoke -g <rg> -n <vm> \
  --command-id RunShellScript \
  --scripts "ping -c 100 -i 0.2 <dest-ip> | tail -5"
```

### Common packet loss causes

| Cause | Diagnosis | Fix |
|-------|-----------|-----|
| SNAT port exhaustion | `az monitor metrics list --resource <lb-id> --metric "SnatConnectionCount"` | Add NAT Gateway, use more frontend IPs |
| NVA dropping packets | Check NVA CPU > 80%, packet queue overflow | Scale NVA, add load-balanced instances |
| Bandwidth exceeded | Check VM size network limits | Upgrade VM size for higher bandwidth |
| NSG rate limiting | Flow log shows intermittent denies | Review and adjust NSG rules |

## Packet Capture for Deep Analysis

```bash
# Start a packet capture
az network watcher packet-capture create \
  --resource-group <rg> \
  --vm <vm-name> \
  --name <capture-name> \
  --storage-account <storage-account-id> \
  --time-limit 60 \
  --filters '[{"protocol":"TCP", "remoteIPAddress":"<dest-ip>", "remotePort":"<port>"}]'

# Check capture status
az network watcher packet-capture show \
  --location <region> \
  --name <capture-name>

# Stop and download
az network watcher packet-capture stop \
  --location <region> \
  --name <capture-name>
```

Download the `.cap` file from the storage account and analyze with Wireshark. Look for:
- TCP retransmissions (packet loss)
- TCP window full (throughput bottleneck)
- RST packets (connection resets)
- ICMP unreachable (routing issues)

## Related Resources

- [Connection Monitor overview](https://learn.microsoft.com/azure/network-watcher/connection-monitor-overview)
- [Azure network round-trip latency](https://learn.microsoft.com/azure/networking/azure-network-latency)
- [Accelerated Networking overview](https://learn.microsoft.com/azure/virtual-network/accelerated-networking-overview)
- For Network Watcher tools → use `azure-network-watcher` skill
- For VPN performance → use `azure-vpn-gateway` skill
- For ExpressRoute performance → use `azure-expressroute` skill
