# Timer Recipe - Python Eval

## MCP Template Validation

| Criteria | Expected | Status |
|----------|----------|--------|
| Template discovery | driver discovers templates for language python | ✅ PASS |
| Filter by resource | `resource == "timer"` finds matches | ✅ PASS |
| Template scaffolded | `timer-trigger-python-azd` | ✅ PASS |
| Has trigger code | `@app.timer_trigger` decorator in output | ✅ PASS |
| Has IaC | `projectFiles[]` includes Bicep | ✅ PASS |

## Agent Behavior Validation

```text
1. Driver discovers templates for language python
2. Agent scans templateList.triggers[] descriptions and resource field
3. Agent selects: template where resource == "timer" → timer-trigger-python-azd
4. Driver fetches template `timer-trigger-python-azd`
5. Agent writes: functionFiles[] + projectFiles[]
```

## Code Indicators Verified

- `@app.timer_trigger` with schedule parameter
- `TIMER_SCHEDULE` app setting reference (`%TIMER_SCHEDULE%`)
- 6-part cron expression (with seconds)

## Test Date

2026-04-22

## Verdict

**PASS** - MCP template provides complete timer trigger with configurable schedule and IaC.
