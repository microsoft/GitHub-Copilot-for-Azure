# Direct Ingestion via Log Ingestion API

## Overview

The Log Ingestion API lets you send data directly to a Log Analytics workspace via REST API or client libraries, without an agent. The DCR for direct ingestion uses `"kind": "Direct"` and has no `dataSources` section.

## Architecture

```
Your App/Script → (HTTPS POST) → DCR Logs Ingestion Endpoint → DCR Transform → LA Workspace Table
```

## Required Components

| Component | Purpose |
|-----------|---------|
| **Entra app registration** | Authenticate API calls (client credentials flow) |
| **Custom or standard table** | Destination in LA workspace (custom tables must end with `_CL`) |
| **DCR with `kind: "Direct"`** | Defines input schema, transform, and destination |
| **RBAC assignment** | Grant app the **Monitoring Metrics Publisher** role on the DCR |
| **DCE** (optional) | Required only if using private link; otherwise use DCR's built-in `logsIngestion` endpoint |

## DCR Structure for Direct Ingestion

Direct ingestion DCRs differ from agent-based DCRs:
- Must have `"kind": "Direct"` at top level
- No `dataSources` section
- `streamDeclarations` defines the shape of incoming JSON data (not the destination table)
- `transformKql` maps incoming data to the destination table schema
- DCR auto-generates a `logsIngestion` endpoint when `kind: "Direct"` is set

```jsonc
{
    "location": "{region}",
    "kind": "Direct",
    "properties": {
        "streamDeclarations": {
            "Custom-{StreamName}": {
                "columns": [
                    // Schema of INCOMING data, not the destination table
                ]
            }
        },
        "destinations": {
            "logAnalytics": [
                {
                    "workspaceResourceId": "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.OperationalInsights/workspaces/{ws}",
                    "name": "myworkspace"
                }
            ]
        },
        "dataFlows": [
            {
                "streams": ["Custom-{StreamName}"],
                "destinations": ["myworkspace"],
                "transformKql": "source | ...",
                "outputStream": "Custom-{TableName}_CL"
            }
        ]
    }
}
```

## API Endpoint

After DCR creation, retrieve the logs ingestion endpoint from the DCR resource:

```
GET /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Insights/dataCollectionRules/{name}?api-version=2023-03-11
```

The endpoint is in `properties.endpoints.logsIngestion`.

## Sending Data

### REST API Call

```
POST {logsIngestionEndpoint}/dataCollectionRules/{dcrImmutableId}/streams/{streamName}?api-version=2023-01-01
Authorization: Bearer {token}
Content-Type: application/json

[
    {
        "TimeGenerated": "2026-04-27T12:00:00Z",
        "Column1": "value1",
        "Column2": 42
    }
]
```

- Body must be a JSON array
- Each object must match the stream declaration schema
- UTF-8 encoded
- Max 1 MB per call
- Supports `Content-Encoding: gzip`

### Authentication

Token audience (scope): `https://monitor.azure.com/.default`

```powershell
$scope = [System.Web.HttpUtility]::UrlEncode("https://monitor.azure.com//.default")
$body = "client_id=$appId&scope=$scope&client_secret=$appSecret&grant_type=client_credentials"
$headers = @{ "Content-Type" = "application/x-www-form-urlencoded" }
$uri = "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token"
$bearerToken = (Invoke-RestMethod -Uri $uri -Method Post -Body $body -Headers $headers).access_token
```

### Client Libraries

| Language | Package |
|----------|---------|
| .NET | `Azure.Monitor.Ingestion` |
| Python | `azure-monitor-ingestion` |
| Java | `azure-monitor-ingestion` |
| JavaScript | `@azure/monitor-ingestion` |
| Go | `azlogs` |

## Setup Procedure

1. **Create Entra app registration** with a client secret
2. **Create custom table** in LA workspace (if not using an existing table)
3. **Create DCR** with `kind: "Direct"`, stream declarations matching incoming data, and `transformKql` mapping to destination table
4. **Assign RBAC**: grant the app **Monitoring Metrics Publisher** role on the DCR
5. **Retrieve endpoint**: get `logsIngestion` URI and `immutableId` from the DCR
6. **Send data**: POST JSON array to the endpoint

## Key Differences from Agent-Based DCRs

| Aspect | Agent-based | Direct |
|--------|------------|--------|
| `kind` | `"Linux"` / `"Windows"` | `"Direct"` |
| `dataSources` | required | absent |
| `streamDeclarations` | raw/post-transform data | incoming API payload shape |
| `transformations` | supported (multi-stage) | not applicable (use `transformKql`) |

For limits (payload size, rate limits), see [limits.md](./limits.md).
