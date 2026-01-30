# Azure Functions Troubleshooting Reference

## Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **func not found** | Command not recognized | Install Azure Functions Core Tools: `npm install -g azure-functions-core-tools@4` |
| **Storage error** | Function app won't start | Verify `AzureWebJobsStorage` connection string is valid |
| **404 on function** | Function not found | Check function is exported correctly and route is configured |
| **Cold start delays** | First request slow | Use Premium plan or implement warm-up triggers |
| **Timeout** | Function exceeds limit | Increase `functionTimeout` in host.json or use Durable Functions |
| **Binding errors** | Extension not loaded | Run `func extensions install` to install required extensions |
| **Deploy fails** | Publish error | Ensure function app exists and CLI is authenticated |
| **Runtime mismatch** | Version conflict | Verify `FUNCTIONS_EXTENSION_VERSION` matches project |
| **Execution limits** | Flex Consumption has 30 min timeout | Use Premium or Dedicated plan for longer executions |
| **Scaling delays** | Cold starts on first request | Flex Consumption supports always-ready instances |

---

## Debug Commands

```bash
func start --verbose                     # Local debugging
func azure functionapp logstream $APP    # Live logs
az functionapp show --name $APP          # App details
az functionapp config show --name $APP   # Configuration
az functionapp list --output table       # List all function apps
```

---

## Azure Resources

| Resource Type | Purpose | API Version |
|--------------|---------|-------------|
| `Microsoft.Web/sites` | Function App | 2023-12-01 |
| `Microsoft.Storage/storageAccounts` | Required storage | 2023-01-01 |
| `Microsoft.Web/serverfarms` | App Service Plan | 2023-12-01 |
| `Microsoft.Insights/components` | Application Insights | 2020-02-02 |

---

## MCP Server Tools

Use MCP tools to **query** existing resources:

- `azure__functionapp` with command `functionapp_list` - List function apps

**If Azure MCP is not enabled:** Run `/azure:setup` or enable via `/mcp`.

---

## Additional Resources

- [Azure Functions Documentation](https://learn.microsoft.com/azure/azure-functions/)
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- [Triggers and Bindings](https://learn.microsoft.com/azure/azure-functions/functions-triggers-bindings)
- [Durable Functions](https://learn.microsoft.com/azure/azure-functions/durable/)
