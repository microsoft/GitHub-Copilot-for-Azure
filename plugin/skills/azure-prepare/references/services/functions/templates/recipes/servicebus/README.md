# Service Bus Recipe

Service Bus queue/topic trigger with managed identity authentication.

## Template Selection

Resource filter: `servicebus`  
Discover templates via MCP or CDN manifest where `resource == "servicebus"` and `language` matches user request.

## Troubleshooting

### 500 Error on First Request

**Cause:** RBAC role assignment hasn't propagated to Service Bus data plane.  
**Solution:** Wait 30-60 seconds after provisioning, or restart the function app.

### "Unauthorized" or "Forbidden" Errors

**Cause:** Missing UAMI credential settings.  
**Solution:** Ensure all three settings are present in app configuration:

- `ServiceBusConnection__fullyQualifiedNamespace`
- `ServiceBusConnection__credential` (value: `managedidentity`)
- `ServiceBusConnection__clientId`

## Eval

| Path | Description |
|------|-------------|
| [eval/summary.md](eval/summary.md) | Evaluation summary |
| [eval/python.md](eval/python.md) | Python evaluation results |
