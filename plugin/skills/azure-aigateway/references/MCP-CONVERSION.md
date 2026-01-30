# Convert API to MCP Server

Convert existing APIM API operations into an MCP server for AI agent tools.

## Prerequisites

- APIM instance with Basicv2 SKU or higher
- Existing API imported into APIM

## Step 1: List Existing APIs

```bash
az apim api list -g <apim-rg> --service-name <apim> --query "[].{id:name, displayName:displayName, path:path}" -o table
```

## Step 2: Ask User Which API to Convert

After listing APIs, **use the ask_user tool** to let the user select which API to convert.

## Step 3: List API Operations

```bash
az apim api operation list -g <apim-rg> --service-name <apim> --api-id <api-id> \
  --query "[].{operationId:name, method:method, urlTemplate:urlTemplate}" -o table
```

## Step 4: Ask User Which Operations to Expose

After listing operations, **use the ask_user tool** to select which operations to expose as MCP tools.

## Step 5: Configure MCP Endpoint Policy

```xml
<inbound>
    <choose>
        <when condition="@(context.Request.Url.Path.EndsWith("/mcp/tools/list"))">
            <return-response>
                <set-status code="200" />
                <set-header name="Content-Type"><value>application/json</value></set-header>
                <set-body>@{
                    var tools = new JArray();
                    tools.Add(new JObject(new JProperty("name", "operation_name"),
                        new JProperty("description", "Description"),
                        new JProperty("inputSchema", new JObject(new JProperty("type", "object")))));
                    return new JObject(new JProperty("tools", tools)).ToString();
                }</set-body>
            </return-response>
        </when>
    </choose>
</inbound>
```

## Step 6: Bicep for MCP-Enabled API

```bicep
resource api 'Microsoft.ApiManagement/service/apis@2024-06-01-preview' = {
  parent: apimService
  name: apiId
  properties: { displayName: apiDisplayName, path: apiPath, protocols: ['https'], serviceUrl: backendUrl }
}

resource mcpToolsList 'Microsoft.ApiManagement/service/apis/operations@2024-06-01-preview' = {
  parent: api
  name: 'mcp-tools-list'
  properties: { displayName: 'MCP Tools List', method: 'POST', urlTemplate: '/mcp/tools/list' }
}

resource mcpToolsCall 'Microsoft.ApiManagement/service/apis/operations@2024-06-01-preview' = {
  parent: api
  name: 'mcp-tools-call'
  properties: { displayName: 'MCP Tools Call', method: 'POST', urlTemplate: '/mcp/tools/call' }
}
```

## Step 7: Test MCP Endpoint

```bash
GATEWAY_URL=$(az apim show --name <apim> -g <apim-rg> --query "gatewayUrl" -o tsv)
curl -X POST "${GATEWAY_URL}/<api-path>/mcp/tools/list" -H "Content-Type: application/json" -H "Ocp-Apim-Subscription-Key: <key>" -d '{}'
```

## MCP Tool Schema

```json
{"tools": [{"name": "get_weather", "description": "Get weather", "inputSchema": {"type": "object", "properties": {"location": {"type": "string"}}, "required": ["location"]}}]}
```

## References

- [MCP Server Overview](https://learn.microsoft.com/azure/api-management/mcp-server-overview)
- [MCP from API Lab](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/mcp-from-api)
