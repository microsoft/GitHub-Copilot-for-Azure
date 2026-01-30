# Azure Functions

## Quick Reference

| Property | Value |
|----------|-------|
| Deployment tool | `azd` (Azure Developer CLI) |
| Local dev tool | Azure Functions Core Tools (`func`) |
| Best for | Serverless APIs, event-driven, scheduled tasks |

## Deploy with azd (Required)

```bash
azd up --no-prompt                    # Deploy everything
azd provision --no-prompt             # Create resources
azd deploy --no-prompt                # Deploy code
azd down --force --purge              # Clean up
```

## Prerequisites

```bash
# Install azd
brew tap azure/azure-dev && brew install azd  # macOS
winget install Microsoft.Azd                   # Windows

# Install func
npm install -g azure-functions-core-tools@4 --unsafe-perm true
# Or: winget install Microsoft.AzureFunctionsCoreTools

# Auth
azd auth login
```

## Initialize Project

```bash
func init MyFunctionApp --worker-runtime node --model V4
cd MyFunctionApp
func new --name HttpTrigger --template "HTTP trigger"
```

**Runtimes:** `node`, `python`, `dotnet`, `dotnet-isolated`, `java`, `powershell`

## Local Development

```bash
func start                # Start local server (port 7071)
func start --port 7072    # Custom port
```

Test: `http://localhost:7071/api/{functionName}`

## Example Functions

**HTTP Trigger (Node.js v4):**
```javascript
const { app } = require('@azure/functions');
app.http('HttpTrigger', {
    methods: ['GET', 'POST'], authLevel: 'anonymous',
    handler: async (request) => {
        const name = request.query.get('name') || 'World';
        return { body: `Hello, ${name}!` };
    }
});
```

**Timer Trigger:**
```javascript
app.timer('TimerTrigger', {
    schedule: '0 */5 * * * *',  // Every 5 minutes
    handler: async (myTimer, context) => { context.log('Timer executed'); }
});
```

**Queue Trigger:**
```javascript
app.storageQueue('QueueTrigger', {
    queueName: 'myqueue', connection: 'AzureWebJobsStorage',
    handler: async (message, context) => { context.log('Message:', message); }
});
```

## Hosting Plans

| Plan | Use Case | Pricing |
|------|----------|---------|
| Consumption | Event-driven, variable load | Pay per execution |
| Premium | Enhanced perf, VNet | Fixed hourly |
| Dedicated | Predictable workloads | App Service Plan |

## Configuration

**local.settings.json:**
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true"
  }
}
```

```bash
azd env set MY_SETTING "value"    # Set env var
func azure functionapp publish $APP --publish-local-settings  # Sync settings
```

## Monitoring

```bash
azd monitor --logs                                # View logs
func azure functionapp logstream $FUNCTION_APP    # Stream logs
```

**Kusto query:**
```kusto
requests | where timestamp > ago(1h) | project timestamp, name, duration, resultCode
```

## Deployment Slots (Premium/Dedicated)

```bash
func azure functionapp publish <app> --slot staging
az functionapp deployment slot swap -n <app> -g <rg> --slot staging
```

## Common Triggers

| Trigger | Use Case |
|---------|----------|
| HTTP | REST APIs, webhooks |
| Timer | Scheduled jobs (cron) |
| Queue | Async processing |
| Blob | File processing |
| Event Grid | Event-driven |
| Cosmos DB | Change feed |

## Best Practices

- Use managed identity over connection strings
- Set `functionTimeout` in host.json
- Enable Application Insights
- Use `authLevel: 'function'` for non-public endpoints
- Design functions for idempotency
- Use Durable Functions for long-running workflows

## Troubleshooting

| Issue | Solution |
|-------|----------|
| func not found | `npm install -g azure-functions-core-tools@4 --unsafe-perm true` |
| Storage error | Verify `AzureWebJobsStorage` connection string |
| Cold start delays | Use Premium plan with pre-warmed instances |
| Timeout | Increase `functionTimeout` in host.json (max 10 min Consumption) |
| Deploy fails | Check auth and storage account access |
