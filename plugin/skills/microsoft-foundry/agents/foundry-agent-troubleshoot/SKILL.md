---
name: foundry-agent-troubleshoot
description: |
  Troubleshoot and debug agents in Azure AI Foundry. Retrieves container logs for hosted agents, discovers Application Insights connections in the project, and queries telemetry using KQL to diagnose errors, failures, and performance issues.
  USE FOR: troubleshoot agent, debug agent, agent logs, agent errors, agent not responding, agent failing, container logs, diagnose agent, agent telemetry, agent traces, agent exceptions.
  DO NOT USE FOR: deploying or creating agents (use foundry-agent-deploy), invoking or testing agents (use foundry-agent-run), containerizing projects (use foundry-agent-package), Azure Functions (use azure-functions).
---

# Foundry Agent Troubleshoot

Troubleshoot and debug Foundry agents by collecting container logs, discovering observability connections, and querying Application Insights telemetry.

## Quick Reference

| Property | Value |
|----------|-------|
| Agent types | Prompt (LLM-based), Hosted (container-based) |
| MCP servers | `foundry-agent`, `azure__kusto` |
| Key MCP tools | `agent_get`, `agent_container_status_get`, `kusto_query` |
| CLI references | `az cognitiveservices agent logs`, `az cognitiveservices account connection` |

## When to Use This Skill

- Agent is not responding or returning errors
- Hosted agent container is failing to start
- Need to view container logs for a hosted agent
- Diagnose latency or timeout issues
- Query Application Insights for agent traces and exceptions
- Investigate agent runtime failures

## MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `agent_get` | Get agent details to determine type (prompt/hosted) | `projectEndpoint` (required), `agentName` (optional) |
| `agent_container_status_get` | Check hosted agent container status | `projectEndpoint`, `agentName` (required); `agentVersion` |
| `kusto_query` | Execute KQL queries against Application Insights | `subscription`, `cluster`, `database`, `query` (all required) |
| `kusto_table_schema_get` | Get table schema for KQL query building | `subscription`, `cluster`, `database`, `table` (all required) |

## Workflow

### Step 1: Collect Agent Information

If an `azure.yaml` exists in the project root, run `azd env get-values` and look for:
- `AZURE_AI_PROJECT_ENDPOINT` or `AZURE_AIPROJECT_ENDPOINT` → pre-fill **Project endpoint**
- `AZURE_SUBSCRIPTION_ID` → pre-fill subscription for Kusto queries

Use the `ask_user` or `askQuestions` tool for any values not resolved from azd:
- **Project endpoint** — AI Foundry project endpoint URL
- **Agent name** — Name of the agent to troubleshoot

### Step 2: Determine Agent Type

Use `agent_get` with `projectEndpoint` and `agentName` to retrieve the agent definition. Check the `kind` field:
- `"hosted"` → Proceed to Step 3 (Container Logs)
- `"prompt"` → Skip to Step 4 (Discover Observability Connections)

### Step 3: Retrieve Container Logs (Hosted Agents Only)

First check the container status using `agent_container_status_get`. Report the current status to the user.

Retrieve container logs using the Azure CLI command documented at:
[az cognitiveservices agent logs show](https://learn.microsoft.com/en-us/cli/azure/cognitiveservices/agent/logs?view=azure-cli-latest#az-cognitiveservices-agent-logs-show)

Refer to the documentation above for the exact command syntax and parameters. Present the logs to the user and highlight any errors or warnings found.

### Step 4: Discover Observability Connections

List the project connections to find Application Insights or Azure Monitor resources using the Azure CLI command documented at:
[az cognitiveservices account connection](https://learn.microsoft.com/en-us/cli/azure/cognitiveservices/account/connection?view=azure-cli-latest)

Refer to the documentation above for the exact command syntax and parameters. Look for connections of type `ApplicationInsights` or `AzureMonitor` in the output.

If no observability connection is found, inform the user and suggest setting up Application Insights for the project. Use the `ask_user` or `askQuestions` tool to ask if they want to proceed without telemetry data.

### Step 5: Query Application Insights Telemetry

Delegate the KQL query execution to a `task` or `runSubagent` sub-agent (type: `task`). Provide it the subscription, Application Insights cluster and database details, and the appropriate KQL query from the table below.

Use the `kusto_query` MCP tool to query Application Insights. Start with the diagnostic query most relevant to the user's reported issue:

| Issue | KQL Query Target | Table |
|-------|-----------------|-------|
| Agent errors/exceptions | Recent exceptions with stack traces | `AppExceptions` |
| Failed requests | Requests with non-success status codes | `AppRequests` |
| Slow responses / latency | Request duration percentiles | `AppRequests` |
| Agent traces / debug logs | Recent trace messages | `AppTraces` |
| Dependency failures | Failed outbound calls (model, tools) | `AppDependencies` |

**Suggested initial diagnostic query (AppExceptions):**

```kql
AppExceptions
| where TimeGenerated > ago(1h)
| where AppRoleName contains "<agent-name>"
| project TimeGenerated, ProblemId, ExceptionType, OuterMessage, InnermostMessage
| order by TimeGenerated desc
| take 20
```

**Suggested latency query (AppRequests):**

```kql
AppRequests
| where TimeGenerated > ago(1h)
| where AppRoleName contains "<agent-name>"
| summarize avg(DurationMs), percentile(DurationMs, 95), count() by bin(TimeGenerated, 5m)
| order by TimeGenerated desc
```

Use `kusto_table_schema_get` to discover available columns if the initial queries need adjustment.

### Step 6: Summarize Findings

Present a summary to the user including:
- **Agent type and status** — hosted/prompt, container status (if hosted)
- **Container log errors** — key errors from logs (hosted only)
- **Telemetry insights** — exceptions, failed requests, latency trends
- **Recommended actions** — specific steps to resolve identified issues

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Agent not found | Invalid agent name or project endpoint | Use `agent_get` to list available agents and verify name |
| Container logs unavailable | Agent is a prompt agent or container never started | Prompt agents don't have container logs — skip to telemetry |
| No observability connection | Application Insights not configured for the project | Suggest configuring Application Insights for the Foundry project |
| Kusto query failed | Invalid cluster/database or insufficient permissions | Verify Application Insights resource details and reader permissions |
| No telemetry data | Agent not instrumented or too recent | Check if Application Insights SDK is configured; data may take a few minutes to appear |

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Agent Logs CLI Reference](https://learn.microsoft.com/en-us/cli/azure/cognitiveservices/agent/logs?view=azure-cli-latest)
- [Account Connection CLI Reference](https://learn.microsoft.com/en-us/cli/azure/cognitiveservices/account/connection?view=azure-cli-latest)
- [KQL Quick Reference](https://learn.microsoft.com/azure/data-explorer/kusto/query/kql-quick-reference)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
