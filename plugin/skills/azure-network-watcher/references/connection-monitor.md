# Connection Monitor

Connection Monitor provides continuous, end-to-end connectivity monitoring between source endpoints (Azure VMs, on-premises machines) and destination endpoints (Azure resources, external URLs, IP addresses). It replaces the legacy Connection Monitor (classic) and Network Performance Monitor.

## Architecture

Connection Monitor uses a hierarchical structure:

- **Connection Monitor** — the top-level resource, scoped to a region
- **Test Groups** — logical groupings of sources, destinations, and test configurations
- **Endpoints** — source and destination resources (VMs, IP addresses, URLs, Azure resources)
- **Test Configurations** — protocol settings, frequency, and success thresholds

A single connection monitor can contain multiple test groups, allowing you to monitor different connectivity scenarios from one resource.

## Supported Source Endpoints

| Source Type | Requirements |
|-------------|-------------|
| Azure VM | Network Watcher extension installed |
| Azure VM Scale Set | Network Watcher extension on instances |
| On-premises machine | Azure Monitor Agent installed, connected via Log Analytics workspace |
| Azure Arc-enabled server | Azure Monitor Agent installed |

## Supported Destination Endpoints

| Destination Type | Example |
|------------------|---------|
| Azure VM | VM resource ID |
| External URL | `https://www.microsoft.com` |
| IP address | `10.0.1.4` or `203.0.113.1` |
| Azure resource | Storage account, SQL Database, App Service |

## Test Protocols

### TCP Test

```bash
az network watcher connection-monitor create \
  --name myMonitor \
  --location eastus \
  --test-group-name webServerGroup \
  --endpoint-source-name sourceVM \
  --endpoint-source-resource-id "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Compute/virtualMachines/sourceVM" \
  --endpoint-dest-name destVM \
  --endpoint-dest-resource-id "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Compute/virtualMachines/destVM" \
  --test-config-name tcpTest \
  --protocol Tcp \
  --tcp-port 443 \
  --tcp-disable-trace-route false \
  --frequency 30
```

TCP tests check if a TCP connection can be established on the specified port. They report round-trip time and connection success/failure.

### HTTP Test

```bash
az network watcher connection-monitor test-configuration add \
  --connection-monitor myMonitor \
  --location eastus \
  --name httpTest \
  --protocol Http \
  --http-port 443 \
  --http-method GET \
  --http-path "/" \
  --http-valid-status-codes 200 301 302 \
  --frequency 60
```

HTTP tests send HTTP requests and validate the response status code. They report latency, response time, and whether the returned status code is in the valid set.

### ICMP Test

```bash
az network watcher connection-monitor test-configuration add \
  --connection-monitor myMonitor \
  --location eastus \
  --name icmpTest \
  --protocol Icmp \
  --frequency 60
```

ICMP tests use ping to check basic reachability. Note that ICMP may be blocked by NSGs or firewalls even if TCP connectivity works.

## Thresholds and Alerts

Connection Monitor supports configurable thresholds for alerting:

- **Round-trip time threshold** — alert when latency exceeds a specified value in milliseconds
- **Checks failed percentage** — alert when the percentage of failed checks exceeds a threshold

```bash
# Add a test configuration with thresholds
az network watcher connection-monitor test-configuration add \
  --connection-monitor myMonitor \
  --location eastus \
  --name criticalTest \
  --protocol Tcp \
  --tcp-port 1433 \
  --frequency 30 \
  --threshold-failed-percent 10 \
  --threshold-round-trip-time 100
```

To integrate with Azure Monitor alerts, create a metric alert on the Connection Monitor metrics:

```bash
# Create an alert rule for connection monitor check failures
az monitor metrics alert create \
  --name "ConnectionMonitorAlert" \
  --resource-group myRG \
  --scopes "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkWatchers/NetworkWatcher_eastus/connectionMonitors/myMonitor" \
  --condition "avg ChecksFailedPercent > 20" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Insights/actionGroups/myActionGroup"
```

## Monitoring On-Premises to Azure

To monitor connectivity from on-premises machines to Azure resources:

1. Install the Azure Monitor Agent on the on-premises machine
2. Connect the machine to a Log Analytics workspace
3. Add the on-premises machine as a source endpoint using its Log Analytics workspace ID

```bash
# Create a connection monitor with an on-premises source
az network watcher connection-monitor create \
  --name onPremToAzure \
  --location eastus \
  --test-group-name hybridGroup \
  --endpoint-source-name onPremServer \
  --endpoint-source-type ExternalAddress \
  --endpoint-source-address "192.168.1.10" \
  --endpoint-dest-name azureVM \
  --endpoint-dest-resource-id "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Compute/virtualMachines/destVM" \
  --test-config-name tcpTest \
  --protocol Tcp \
  --tcp-port 3389 \
  --frequency 60
```

## Managing Connection Monitors

```bash
# List all connection monitors in a region
az network watcher connection-monitor list --location eastus --output table

# Show details of a specific monitor
az network watcher connection-monitor show --location eastus --name myMonitor

# Query test results
az network watcher connection-monitor query --location eastus --name myMonitor

# Stop a connection monitor (pause monitoring)
az network watcher connection-monitor stop --location eastus --name myMonitor

# Start a paused connection monitor
az network watcher connection-monitor start --location eastus --name myMonitor

# Delete a connection monitor
az network watcher connection-monitor delete --location eastus --name myMonitor
```

## Topology Considerations

| Scenario | Recommended Test Protocol | Frequency |
|----------|--------------------------|-----------|
| Web app availability | HTTP (check status codes) | 30–60 seconds |
| Database connectivity | TCP on port 1433/3306/5432 | 30 seconds |
| VPN tunnel health | TCP or ICMP | 60 seconds |
| DNS resolution | TCP on port 53 | 60 seconds |
| General reachability | ICMP | 60–300 seconds |

## Quotas and Limits

- Maximum 100 connection monitors per subscription per region
- Maximum 20 test groups per connection monitor
- Maximum 100 endpoints (sources and destinations combined) per connection monitor
- Maximum 25 test configurations per connection monitor
- Test frequency minimum: 30 seconds for TCP/HTTP, 60 seconds for ICMP

## Learn More

- [Connection Monitor overview — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/connection-monitor-overview)
- [Create a Connection Monitor — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/connection-monitor-create-using-portal)
- [Migrate to Connection Monitor from Network Performance Monitor — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/migrate-to-connection-monitor-from-network-performance-monitor)
