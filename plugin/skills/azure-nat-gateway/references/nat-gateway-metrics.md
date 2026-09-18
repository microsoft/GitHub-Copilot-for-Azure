# NAT Gateway Metrics and Monitoring

## Key NAT Gateway Metrics

Azure NAT Gateway exposes the following metrics through Azure Monitor. All metrics are available in the `Microsoft.Network/natGateways` resource provider namespace.

### SNATConnectionCount

- **Description**: Total number of active SNAT connections at a point in time. This is the concurrently active connection count — not a cumulative total.
- **Unit**: Count
- **Aggregation**: Sum, Max, Avg
- **Why it matters**: This is your primary capacity indicator. Each public IP supports 64,512 SNAT ports. When SNATConnectionCount approaches that ceiling (or `64,512 × number_of_public_IPs`), new connections will fail.
- **Dimensions**: Protocol (TCP/UDP), Connection State (Attempted, Active, Failed, Timed Out)
- **Healthy range**: Below 80% of available port capacity. For 1 public IP, keep below ~51,600 sustained.

Use the **Connection State** dimension to break down connections:
- **Attempted**: New connections initiated — a rising trend indicates growing demand.
- **Active**: Currently established connections consuming SNAT ports.
- **Failed**: Connections that could not be established — non-zero values indicate exhaustion or connectivity problems.
- **Timed Out**: Connections closed by idle timeout expiry — high values may indicate the idle timeout is too short or connections are being abandoned.

### TotalConnectionCount

- **Description**: Cumulative total of all SNAT connections over a time period, including succeeded and failed.
- **Unit**: Count
- **Aggregation**: Sum
- **Why it matters**: Shows the overall connection rate and throughput of your NAT Gateway. Use this to understand connection velocity — how many connections per minute or hour your workload generates.

### DroppedPackets

- **Description**: Number of packets dropped by NAT Gateway.
- **Unit**: Count
- **Aggregation**: Sum
- **Why it matters**: This is the most critical alert metric. Dropped packets typically mean SNAT port exhaustion — NAT Gateway cannot allocate a port for a new connection and drops the SYN packet. Any non-zero value warrants investigation.
- **Common causes**: SNAT exhaustion, NAT Gateway health issues, or packet malformation.

### ByteCount

- **Description**: Total number of bytes processed (inbound + outbound) through NAT Gateway.
- **Unit**: Bytes
- **Aggregation**: Sum
- **Why it matters**: Tracks data throughput. Useful for capacity planning and cost estimation. NAT Gateway supports up to 50 Gbps of throughput — if ByteCount trends indicate you are approaching this, consider distributing traffic across multiple subnets with separate NAT Gateways.

### PacketCount

- **Description**: Total number of packets processed through NAT Gateway.
- **Unit**: Count
- **Aggregation**: Sum
- **Why it matters**: Combined with ByteCount, helps identify traffic patterns. A high packet count with low byte count suggests many small requests (e.g., API calls), while low packet count with high bytes suggests bulk transfers.

### DatapathAvailability

- **Description**: Health of the NAT Gateway data path, expressed as a percentage.
- **Unit**: Percent
- **Aggregation**: Avg, Min
- **Why it matters**: Indicates whether NAT Gateway is healthy and processing traffic. A value of 100% means fully operational. Values below 100% indicate a platform issue affecting NAT Gateway — this is not caused by customer configuration and should be reported to Azure support.
- **Healthy value**: 100% at all times. Any sustained drop below 100% is a platform incident.

## Setting Up Metric Alerts

### Alert 1: SNAT Exhaustion Warning (DroppedPackets)

This is the highest-priority alert. Any dropped packets indicate connections are failing.

```bash
# Create an action group for notifications
az monitor action-group create -g MyRG -n NATGatewayAlerts \
  --short-name NATAlerts \
  --action email admin admin@contoso.com

# Create alert for dropped packets > 0
az monitor metrics alert create -g MyRG -n NATGateway-DroppedPackets \
  --scopes /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --condition "total DroppedPackets > 0" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 1 \
  --action NATGatewayAlerts \
  --description "NAT Gateway is dropping packets — possible SNAT exhaustion"
```

### Alert 2: High SNAT Connection Count

Warn before reaching capacity. For a single public IP, alert at 80% (51,600 connections).

```bash
az monitor metrics alert create -g MyRG -n NATGateway-HighSNAT \
  --scopes /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --condition "max SNATConnectionCount > 51600" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 2 \
  --action NATGatewayAlerts \
  --description "SNAT connections exceeding 80% of single-IP capacity"
```

Adjust the threshold based on your public IP count: `threshold = 64,512 × number_of_IPs × 0.8`.

### Alert 3: Datapath Availability Drop

```bash
az monitor metrics alert create -g MyRG -n NATGateway-DatapathHealth \
  --scopes /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --condition "avg DatapathAvailability < 100" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 1 \
  --action NATGatewayAlerts \
  --description "NAT Gateway datapath availability degraded — possible platform issue"
```

### Alert 4: Failed Connection Rate

Alert when failed connections exceed a threshold over a 5-minute window.

```bash
az monitor metrics alert create -g MyRG -n NATGateway-FailedConnections \
  --scopes /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --condition "total SNATConnectionCount > 100" \
  --condition-dimension "ConnectionState=Failed" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 2 \
  --action NATGatewayAlerts \
  --description "High rate of failed SNAT connections"
```

## Dashboard Creation

Create an Azure Monitor workbook or dashboard with these panels for comprehensive NAT Gateway visibility:

### Recommended Dashboard Panels

1. **SNAT Connection Count (Time Chart)**: Line chart showing SNATConnectionCount over time, with a horizontal threshold line at 80% of capacity. Split by Connection State dimension.
2. **Dropped Packets (Bar Chart)**: Bar chart of DroppedPackets per 5-minute interval. Any bars indicate problems.
3. **Datapath Availability (Gauge)**: Single-value gauge showing current DatapathAvailability. Green at 100%, red below.
4. **Connection Rate (Time Chart)**: TotalConnectionCount as a rate (connections per minute) to see demand trends.
5. **Throughput (Time Chart)**: ByteCount as a rate (MB/s) to monitor data throughput.
6. **Packet Rate (Time Chart)**: PacketCount per minute to identify traffic spikes.

### Azure CLI: Query Metrics for Dashboard Data

```bash
# SNAT connections over the last hour, 5-minute intervals
az monitor metrics list \
  --resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --metric SNATConnectionCount \
  --interval PT5M \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --aggregation Maximum

# Dropped packets over the last 24 hours
az monitor metrics list \
  --resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --metric DroppedPackets \
  --interval PT1H \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ) \
  --aggregation Total

# Throughput over the last hour
az monitor metrics list \
  --resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --metric ByteCount \
  --interval PT5M \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --aggregation Total
```

## Diagnostic Logs

NAT Gateway supports diagnostic settings to route logs to Log Analytics, Storage, or Event Hubs.

### Enable Diagnostic Settings

```bash
az monitor diagnostic-settings create \
  --name NATGatewayDiagnostics \
  --resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --workspace /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.OperationalInsights/workspaces/MyWorkspace \
  --metrics '[{"category":"AllMetrics","enabled":true,"retentionPolicy":{"enabled":true,"days":90}}]'
```

### Log Analytics Integration

Once diagnostic settings are configured, query NAT Gateway metrics in Log Analytics using Kusto Query Language (KQL):

```kusto
// SNAT connection trends over the last 24 hours
AzureMetrics
| where ResourceProvider == "MICROSOFT.NETWORK"
| where Resource contains "NATGATEWAY"
| where MetricName == "SNATConnectionCount"
| where TimeGenerated > ago(24h)
| summarize MaxConnections = max(Maximum), AvgConnections = avg(Average) by bin(TimeGenerated, 5m)
| order by TimeGenerated desc

// Detect SNAT exhaustion events (dropped packets)
AzureMetrics
| where ResourceProvider == "MICROSOFT.NETWORK"
| where Resource contains "NATGATEWAY"
| where MetricName == "DroppedPackets"
| where Total > 0
| project TimeGenerated, Resource, Total
| order by TimeGenerated desc

// Datapath availability dips
AzureMetrics
| where ResourceProvider == "MICROSOFT.NETWORK"
| where Resource contains "NATGATEWAY"
| where MetricName == "DatapathAvailability"
| where Average < 100
| project TimeGenerated, Resource, Average
| order by TimeGenerated desc
```

## Interpreting Metric Patterns

### Healthy NAT Gateway

- **SNATConnectionCount**: Steady or follows predictable business-hours pattern. Well below 80% of capacity.
- **DroppedPackets**: Consistently zero.
- **DatapathAvailability**: Constant 100%.
- **TotalConnectionCount**: Smooth rate matching expected application traffic.

### SNAT Exhaustion in Progress

- **SNATConnectionCount**: Plateaus near capacity ceiling (e.g., ~64,000 for 1 IP).
- **DroppedPackets**: Spikes appear, correlating with peak traffic times.
- **TotalConnectionCount**: Connection attempts remain high, but successful connections flatten.
- **Action**: Add more public IPs immediately. Investigate application connection management.

### Connection Leak

- **SNATConnectionCount**: Steadily climbs over hours or days without corresponding workload increase.
- **DroppedPackets**: Eventually begins as count approaches capacity.
- **TotalConnectionCount**: New connections continue, but active connections never decrease.
- **Action**: Application-level investigation — look for unclosed sockets, missing connection pool cleanup, or HTTP clients not being disposed.

### Platform Health Issue

- **DatapathAvailability**: Drops below 100%, possibly to 0%.
- **All other metrics**: May drop to zero or show erratic behavior.
- **DroppedPackets**: May spike if traffic is partially flowing.
- **Action**: Check Azure Status page. Open a support ticket with Microsoft. This is a platform issue, not a configuration problem.

### Intermittent Exhaustion

- **SNATConnectionCount**: Spikes briefly to near-capacity during peak periods, then recovers.
- **DroppedPackets**: Small numbers during spike periods only.
- **Action**: May be acceptable if brief and infrequent. Consider adding a public IP for headroom, or optimize application connection patterns for peak periods.
