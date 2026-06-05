# Log Analytics Tables Reference

## Standard Tables

Standard tables have predefined schemas and are referenced via `Microsoft-*` streams. Data landing in standard tables must match the table schema.

Common standard tables:

| Table | Stream | Use |
|-------|--------|-----|
| Syslog | Microsoft-Syslog | Linux syslog |
| Event | Microsoft-Event | Windows events |
| Perf | Microsoft-Perf | Performance counters |
| InsightsMetrics | Microsoft-InsightsMetrics | Performance metrics |
| W3CIISLog | Microsoft-W3CIISLog | IIS logs |
| CommonSecurityLog | Microsoft-CommonSecurityLog | CEF security logs |

## Custom Tables

Custom tables have user-defined schemas and names ending in `_CL`. They must be created in the LA workspace before data can be ingested.

### Creating a Custom Table via REST API

```
PUT https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.OperationalInsights/workspaces/{workspace}/tables/{tableName}_CL?api-version=2022-10-01
Content-Type: application/json

{
    "properties": {
        "schema": {
            "name": "{tableName}_CL",
            "columns": [
                { "name": "TimeGenerated", "type": "datetime" },
                { "name": "MyColumn", "type": "string" },
                { "name": "Count", "type": "int" }
            ]
        },
        "retentionInDays": 30,
        "totalRetentionInDays": 90,
        "plan": "Analytics"
    }
}
```

### Table Plans

| Plan | Description | Use Case |
|------|-------------|----------|
| `Analytics` | Full query, alerting, dashboards | Primary operational data |
| `Basic` | Limited query, lower cost | High-volume, infrequent access |
| `Auxiliary` | Lowest cost, limited features | Compliance, long retention |

### Column Types

Same as stream declarations: `string`, `int`, `long`, `real`, `boolean`, `dynamic`, `datetime`

### Rules

- `TimeGenerated` (datetime) is required in every custom table
- Table name must end with `_CL`
- Column names are case-sensitive
- Schema changes (adding columns) can be done via PUT with the updated schema
- Removing columns requires recreating the table
- The table schema and the custom stream declaration schema should match

### Getting Table Schema

```powershell
$path = "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.OperationalInsights/workspaces/{workspace}/tables/{tableName}?api-version=2022-10-01"
$response = Invoke-AzRestMethod -Path $path -Method GET
($response.Content | ConvertFrom-Json).properties.schema.columns
```

### PowerShell Helper

Use [create-custom-table.ps1](../scripts/create-custom-table.ps1) and [get-table-schema.ps1](../scripts/get-table-schema.ps1).
