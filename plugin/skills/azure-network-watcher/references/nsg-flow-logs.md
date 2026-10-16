# NSG Flow Logs

NSG flow logs record information about IP traffic flowing through network security groups. They are essential for network monitoring, security auditing, usage tracking, and compliance. Version 2 flow logs add byte and packet counts, which are required for Traffic Analytics.

## Flow Log Versions

| Feature | Version 1 | Version 2 |
|---------|-----------|-----------|
| Flow state tracking | Yes | Yes |
| Bytes per flow | No | Yes |
| Packets per flow | No | Yes |
| Traffic Analytics support | Limited | Full |
| Throughput information | No | Yes |

Always use version 2 for new deployments.

## Enabling NSG Flow Logs

### Basic flow log (v2)

```bash
az network watcher flow-log create \
  --resource-group myRG \
  --name myFlowLog \
  --nsg myNSG \
  --storage-account myStorageAccount \
  --enabled true \
  --format JSON \
  --log-version 2 \
  --retention 90
```

### Flow log with Traffic Analytics

```bash
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
  --workspace myLogAnalyticsWorkspace \
  --interval 10
```

The `--interval` parameter sets the Traffic Analytics processing interval in minutes (10 or 60).

### VNet flow logs (newer alternative to NSG flow logs)

Azure now also supports VNet flow logs, which log at the virtual network level:

```bash
az network watcher flow-log create \
  --resource-group myRG \
  --name myVNetFlowLog \
  --vnet myVNet \
  --storage-account myStorageAccount \
  --enabled true \
  --format JSON \
  --log-version 2 \
  --retention 90 \
  --traffic-analytics true \
  --workspace myLogAnalyticsWorkspace
```

VNet flow logs capture all traffic in the VNet, not just traffic evaluated by NSGs.

## Log Analytics Workspace Integration

Traffic Analytics requires a Log Analytics workspace. The workspace processes raw flow log data and stores it in the `AzureNetworkAnalytics_CL` table.

```bash
# Create a workspace if needed
az monitor log-analytics workspace create \
  --resource-group myRG \
  --workspace-name myWorkspace \
  --location eastus

# Update a flow log to enable Traffic Analytics
az network watcher flow-log update \
  --resource-group myRG \
  --name myFlowLog \
  --traffic-analytics true \
  --workspace myWorkspace \
  --interval 10
```

## Retention

| Storage Location | Retention Configuration |
|------------------|------------------------|
| Storage account | `--retention` parameter (1–365 days, 0 = forever) |
| Log Analytics workspace | Workspace-level retention settings (30–730 days) |

Storage account retention uses Azure Storage lifecycle management to automatically delete old flow log files.

## Flow Log Schema (v2)

Flow logs are stored as JSON files in the storage account at:
```
https://{account}.blob.core.windows.net/insights-logs-networksecuritygroupflowevent/resourceId=/SUBSCRIPTIONS/{sub}/RESOURCEGROUPS/{rg}/PROVIDERS/MICROSOFT.NETWORK/NETWORKSECURITYGROUPS/{nsg}/y={year}/m={month}/d={day}/h={hour}/m=00/macAddress={mac}/PT1H.json
```

### Record structure

Each flow tuple in version 2 contains:
```
{timestamp},{source IP},{dest IP},{source port},{dest port},{protocol},{traffic flow},{traffic decision},{flow state},{packets source to dest},{bytes source to dest},{packets dest to source},{bytes dest to source}
```

| Field | Values |
|-------|--------|
| Protocol | T (TCP), U (UDP) |
| Traffic flow | I (inbound), O (outbound) |
| Traffic decision | A (allowed), D (denied) |
| Flow state | B (begin), C (continuing), E (end) |

### Example flow tuple (v2)

```
1636479326,10.0.0.4,10.1.0.4,49152,443,T,I,A,B,12,1440,8,960
```

This means: at timestamp 1636479326, TCP traffic from 10.0.0.4:49152 to 10.1.0.4:443 was inbound, allowed, and this is the begin of the flow. 12 packets (1440 bytes) were sent source-to-dest, and 8 packets (960 bytes) were sent dest-to-source.

## Common Log Analytics Queries

### Top 10 talking IP pairs

```kusto
AzureNetworkAnalytics_CL
| where SubType_s == "FlowLog"
| where FlowType_s == "IntraVNet" or FlowType_s == "InterVNet"
| summarize TotalBytes = sum(InboundBytes_d + OutboundBytes_d) by SrcIP_s, DestIP_s
| top 10 by TotalBytes desc
```

### Denied flows by NSG rule

```kusto
AzureNetworkAnalytics_CL
| where SubType_s == "FlowLog"
| where FlowStatus_s == "D"
| summarize Count = count() by NSGRule_s, SrcIP_s, DestPort_d
| order by Count desc
| take 20
```

### Traffic volume over time

```kusto
AzureNetworkAnalytics_CL
| where SubType_s == "FlowLog"
| summarize TotalMB = sum(InboundBytes_d + OutboundBytes_d) / 1048576 by bin(TimeGenerated, 1h)
| render timechart
```

### Flows from a specific source IP

```kusto
AzureNetworkAnalytics_CL
| where SubType_s == "FlowLog"
| where SrcIP_s == "10.0.0.4"
| project TimeGenerated, SrcIP_s, DestIP_s, DestPort_d, L7Protocol_s, FlowStatus_s, NSGRule_s
| order by TimeGenerated desc
| take 100
```

### Identify allowed traffic to sensitive ports

```kusto
AzureNetworkAnalytics_CL
| where SubType_s == "FlowLog"
| where FlowStatus_s == "A"
| where DestPort_d in (22, 3389, 1433, 3306, 5432)
| summarize Count = count() by DestPort_d, SrcIP_s, DestIP_s
| order by Count desc
```

### Cross-region traffic (cost analysis)

```kusto
AzureNetworkAnalytics_CL
| where SubType_s == "FlowLog"
| where FlowType_s == "InterVNet"
| where SrcRegion_s != DestRegion_s
| summarize CrossRegionGB = sum(InboundBytes_d + OutboundBytes_d) / 1073741824 by SrcRegion_s, DestRegion_s
| order by CrossRegionGB desc
```

## Managing Flow Logs

```bash
# List all flow logs in a region
az network watcher flow-log list --location eastus --output table

# Show a specific flow log
az network watcher flow-log show --location eastus --name myFlowLog

# Update flow log settings
az network watcher flow-log update \
  --resource-group myRG \
  --name myFlowLog \
  --retention 180

# Disable a flow log
az network watcher flow-log update \
  --resource-group myRG \
  --name myFlowLog \
  --enabled false

# Delete a flow log
az network watcher flow-log delete --location eastus --name myFlowLog
```

## Traffic Analytics Insights

Traffic Analytics processes flow logs and provides:

- **Flow visualization** — geographic map of traffic flows
- **Top talkers** — VMs and IPs generating the most traffic
- **Security insights** — open ports, flows from malicious IPs, NSG rule hit counts
- **Bandwidth utilization** — VNet and subnet throughput trends
- **Geo-mapping** — origin countries/regions for internet-bound traffic

Access Traffic Analytics in the Azure portal under **Network Watcher > Traffic Analytics**.

## Cost Considerations

| Component | Cost Factor |
|-----------|-------------|
| NSG flow logs | Per GB of flow log data collected |
| Storage account | Standard blob storage rates for flow log files |
| Log Analytics workspace | Per GB of data ingested (when Traffic Analytics is enabled) |
| Traffic Analytics | Per GB of flow log data processed |

Use retention policies and processing intervals to manage costs. A 60-minute processing interval is cheaper than 10-minute.

## Learn More

- [NSG flow logs overview — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/nsg-flow-logs-overview)
- [Traffic Analytics — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/traffic-analytics)
- [VNet flow logs — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/vnet-flow-logs-overview)
- [Log Analytics query examples — Microsoft Learn](https://learn.microsoft.com/azure/network-watcher/traffic-analytics-schema)
