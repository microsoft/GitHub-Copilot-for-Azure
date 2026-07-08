# Service Bus Recipe - Python Eval

## MCP Template Validation

| Criteria | Expected | Status |
|----------|----------|--------|
| Template discovery | driver discovers templates for language python | ✅ PASS |
| Filter by resource | `resource == "servicebus"` finds matches | ✅ PASS |
| Template scaffolded | `servicebus-trigger-python-azd` | ✅ PASS |
| Has trigger code | `@app.service_bus_queue_trigger` decorator in output | ✅ PASS |
| Has IaC | `projectFiles[]` includes Bicep | ✅ PASS |
| Has RBAC | Service Bus Data Receiver/Sender role | ✅ PASS |

## Agent Behavior Validation

```text
1. Driver discovers templates for language python
2. Agent scans templateList.triggers[] descriptions and resource field
3. Agent selects: template where resource == "servicebus" → servicebus-trigger-python-azd
4. Driver fetches template `servicebus-trigger-python-azd`
5. Agent writes: functionFiles[] + projectFiles[]
```

## Code Indicators Verified

- `@app.service_bus_queue_trigger` with queue_name
- `connection="ServiceBusConnection"` (UAMI pattern)
- `ServiceBusConnection__fullyQualifiedNamespace` binding
- Extension bundle v4

## Test Date

2026-04-22

## Verdict

**PASS** - MCP template provides complete Service Bus trigger with IaC, RBAC, and UAMI binding.
