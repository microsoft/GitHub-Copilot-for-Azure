# Service Bus Recipe - TypeScript Eval

## MCP Template Validation

| Criteria | Expected | Status |
|----------|----------|--------|
| Template discovery | driver discovers templates for language typescript | ✅ PASS |
| Filter by resource | `resource == "servicebus"` finds matches | ✅ PASS |
| Template scaffolded | `servicebus-trigger-typescript-azd` | ✅ PASS |
| Has trigger code | `app.serviceBusQueue` trigger binding in output | ✅ PASS |
| Has IaC | `projectFiles[]` includes Bicep | ✅ PASS |
| Has RBAC | Service Bus Data Receiver/Sender role | ✅ PASS |

## Agent Behavior Validation

```text
1. Driver discovers templates for language typescript
2. Agent scans templateList.triggers[] descriptions and resource field
3. Agent selects: template where resource == "servicebus" → servicebus-trigger-typescript-azd
4. Driver fetches template `servicebus-trigger-typescript-azd`
5. Agent writes: functionFiles[] + projectFiles[]
```

## Code Indicators Verified

- `app.serviceBusQueue` trigger binding (V4 model)
- TypeScript compilation successful (`npm install` + `tsc`)
- Service Bus namespace with managed identity RBAC
- VNet integration and Flex Consumption plan

## Test Date

2026-04-22

## Verdict

**PASS** - MCP template provides complete TypeScript Service Bus trigger with IaC, RBAC, and UAMI binding.
