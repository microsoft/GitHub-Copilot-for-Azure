# Azure Functions Code Examples

## Project Structure

```
MyFunctionApp/
├── host.json, local.settings.json, package.json
└── src/functions/HttpTrigger.js
```

---

## HTTP Function (Node.js v4)

```javascript
const { app } = require('@azure/functions');
app.http('HttpTrigger', {
    methods: ['GET', 'POST'], authLevel: 'anonymous',
    handler: async (request, context) => {
        const name = request.query.get('name') || 'World';
        return { body: `Hello, ${name}!` };
    }
});
```

## Timer Function

```javascript
app.timer('TimerTrigger', {
    schedule: '0 */5 * * * *',
    handler: async (myTimer, context) => { context.log('Timer executed:', new Date().toISOString()); }
});
```

## local.settings.json

```json
{"IsEncrypted": false, "Values": {"FUNCTIONS_WORKER_RUNTIME": "node", "AzureWebJobsStorage": "UseDevelopmentStorage=true"}}
```

---

## Durable Functions

```javascript
const df = require('durable-functions');
module.exports = df.orchestrator(function* (context) {
    return yield context.df.callActivity('Step1', input);
});
```

**Patterns:** Function chaining, Fan-out/fan-in, Async HTTP APIs, Human interaction

---

## CI/CD with GitHub Actions

> Get guidance with `deploy_pipeline_guidance_get` first.

```yaml
# .github/workflows/azure-functions.yml
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.x' }
      - run: npm ci && npm run build --if-present
      - uses: azure/login@v2
        with: { creds: '${{ secrets.AZURE_CREDENTIALS }}' }
      - uses: Azure/functions-action@v1
        with: { app-name: myFunctionApp, package: '.' }
```

**Create credentials:** `az ad sp create-for-rbac --name "github-sp" --role contributor --scopes /subscriptions/{sub}/resourceGroups/{rg} --sdk-auth`

---

## Best Practices

| Practice | Description |
|----------|-------------|
| Keep functions small | Single-purpose, easier to test |
| Implement idempotency | At-least-once triggers may repeat |
| Use managed identity | Prefer over connection strings |
| Configure timeout | Set `functionTimeout` in host.json |
| Use Application Insights | For monitoring and diagnostics |
| Secure HTTP functions | Use `authLevel: 'function'` |
| Use Key Vault | Store secrets securely |

---

## Quick Start Checklist

**Setup:** Azure subscription, CLI installed/authenticated, Functions Core Tools, runtime (Node.js/Python/.NET)

**Development:** `func init` → `func new` → configure host.json → `func start`

**Deployment:** Create resource group → storage → Function App → `func azure functionapp publish` → configure settings

**Monitoring:** Enable Application Insights, stream logs, set up alerts
