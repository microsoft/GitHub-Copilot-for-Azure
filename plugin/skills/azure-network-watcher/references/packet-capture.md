# Packet Capture

Packet capture in Network Watcher records network traffic to and from a VM for analysis. It is an essential diagnostic tool for troubleshooting connectivity issues, analyzing application behavior, and investigating security incidents.

## Prerequisites

Before creating a packet capture, the target VM must have the Network Watcher VM extension installed:

```bash
# Install on a Linux VM
az vm extension set \
  --resource-group myRG \
  --vm-name myLinuxVM \
  --name NetworkWatcherAgentLinux \
  --publisher Microsoft.Azure.NetworkWatcher

# Install on a Windows VM
az vm extension set \
  --resource-group myRG \
  --vm-name myWindowsVM \
  --name NetworkWatcherAgentWindows \
  --publisher Microsoft.Azure.NetworkWatcher

# Verify the extension is installed
az vm extension show \
  --resource-group myRG \
  --vm-name myVM \
  --name NetworkWatcherAgentLinux
```

The VM agent must also be in a healthy running state.

## Creating a Packet Capture

### Basic capture (all traffic, stored in storage account)

```bash
az network watcher packet-capture create \
  --resource-group myRG \
  --vm myVM \
  --name myCapture \
  --storage-account myStorageAccount \
  --time-limit 300
```

### Capture with filters

Filters reduce the capture size by recording only matching traffic. Multiple filters use OR logic — traffic matching any filter is captured.

```bash
az network watcher packet-capture create \
  --resource-group myRG \
  --vm myVM \
  --name filteredCapture \
  --storage-account myStorageAccount \
  --time-limit 600 \
  --filters '[
    {"protocol":"TCP","localIPAddress":"10.0.0.4","remoteIPAddress":"10.1.0.0/24","localPort":"443"},
    {"protocol":"TCP","localIPAddress":"10.0.0.4","remotePort":"3306"}
  ]'
```

### Filter parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `protocol` | TCP, UDP, or Any | `TCP` |
| `localIPAddress` | VM's IP address or CIDR range | `10.0.0.4` or `10.0.0.0/24` |
| `remoteIPAddress` | Remote IP address or CIDR range | `10.1.0.4` or `0.0.0.0/0` |
| `localPort` | Local port or range | `443` or `80-443` |
| `remotePort` | Remote port or range | `3306` or `1024-65535` |

## Storage Options

Packet captures can be stored in three ways:

### 1. Storage account only

```bash
az network watcher packet-capture create \
  --resource-group myRG \
  --vm myVM \
  --name storageCapture \
  --storage-account myStorageAccount \
  --storage-path "https://mystorage.blob.core.windows.net/captures" \
  --time-limit 300
```

The capture file is stored as a `.cap` file in the storage account under the path `https://{account}.blob.core.windows.net/network-watcher-logs/subscriptions/{sub}/resourcegroups/{rg}/providers/microsoft.compute/virtualmachines/{vm}/{capture-name}/{timestamp}.cap`.

### 2. Local file on the VM

```bash
az network watcher packet-capture create \
  --resource-group myRG \
  --vm myVM \
  --name localCapture \
  --file-path "/var/captures/mycapture.cap" \
  --time-limit 300
```

On Windows VMs, use a path like `C:\captures\mycapture.cap`. The file is stored directly on the VM's disk.

### 3. Both storage account and local file

```bash
az network watcher packet-capture create \
  --resource-group myRG \
  --vm myVM \
  --name dualCapture \
  --storage-account myStorageAccount \
  --file-path "/var/captures/mycapture.cap" \
  --time-limit 300
```

## Capture Limits

| Setting | Default | Maximum |
|---------|---------|---------|
| `--time-limit` | 18,000 seconds (5 hours) | 18,000 seconds |
| `--bytes-to-capture-per-packet` | 0 (entire packet) | 4,294,967,295 bytes |
| `--total-bytes-per-session` | 1,073,741,824 (1 GB) | 4,294,967,295 bytes |
| Concurrent captures per region | — | 10 per VM, 100 per subscription |

## Managing Captures

```bash
# List all packet captures in a region
az network watcher packet-capture list --location eastus --output table

# Check capture status
az network watcher packet-capture show-status --location eastus --name myCapture

# Stop a running capture
az network watcher packet-capture stop --location eastus --name myCapture

# Delete a capture session (does not delete the capture file)
az network watcher packet-capture delete --location eastus --name myCapture
```

## Capture Status Values

| Status | Description |
|--------|-------------|
| `Running` | Capture is actively recording traffic |
| `Stopped` | Capture was manually stopped or timed out |
| `Failed` | Capture encountered an error (check the error reason) |
| `NotStarted` | Capture was created but has not started |

## Analyzing Captures

### Download from storage account

```bash
# List blobs in the network-watcher-logs container
az storage blob list \
  --account-name myStorageAccount \
  --container-name network-watcher-logs \
  --output table

# Download the capture file
az storage blob download \
  --account-name myStorageAccount \
  --container-name network-watcher-logs \
  --name "subscriptions/{sub}/resourcegroups/myRG/providers/microsoft.compute/virtualmachines/myVM/myCapture/{timestamp}.cap" \
  --file mycapture.cap
```

### Analysis tools

Capture files are in standard `.cap` (pcap) format and can be analyzed with:

- **Wireshark** — full-featured GUI packet analyzer (most common)
- **tcpdump** — command-line analysis on Linux
- **Microsoft Message Analyzer** — Windows-based analysis (deprecated but still functional)
- **tshark** — Wireshark's command-line companion

### Common Wireshark display filters for Azure captures

| Filter | Purpose |
|--------|---------|
| `tcp.port == 443` | HTTPS traffic |
| `tcp.flags.syn == 1 && tcp.flags.ack == 0` | TCP connection initiations (SYN only) |
| `tcp.analysis.retransmission` | Retransmitted packets (indicates network issues) |
| `dns` | DNS queries and responses |
| `ip.addr == 10.0.0.4` | Traffic to/from a specific IP |
| `tcp.flags.reset == 1` | TCP RST packets (connection rejections) |
| `http.response.code >= 400` | HTTP error responses |

## Troubleshooting Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Capture fails to start | Extension not installed | Install the Network Watcher VM extension |
| Capture fails to start | VM agent unhealthy | Restart the VM agent or the VM |
| Empty capture file | No traffic matching filters | Broaden filters or remove them |
| Capture stops early | Total bytes limit reached | Increase `--total-bytes-per-session` or use filters |
| Cannot access capture file | Storage account permissions | Verify the Network Watcher has access to the storage account |
| Extension install fails | VM not running | Start the VM before installing the extension |

## Learn More

- [Packet capture overview — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/packet-capture-overview)
- [Create a packet capture — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/packet-capture-vm-portal)
- [Analyze packet captures with Wireshark — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/packet-capture-inspect)
