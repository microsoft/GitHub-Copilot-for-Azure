# Foundry Agent Troubleshoot

Troubleshoot and debug Foundry agents by collecting container or session logs, discovering observability connections, and querying Application Insights telemetry.

## Quick Reference

| Property | Value |
|----------|-------|
| Agent types | Prompt (LLM-based), Hosted (ACA), Hosted (vNext) |
| MCP servers | `azure` |
| Key MCP tools | `agent_get`, `agent_container_status_get` |
| Related skills | `trace` (telemetry analysis) |
| Preferred query tool | `monitor_resource_log_query` (Azure MCP) — preferred over `azure-kusto` for App Insights |
| CLI references | `az cognitiveservices agent logs`, `az cognitiveservices account connection` |

## When to Use This Skill

- Agent is not responding or returning errors
- Hosted agent container is failing to start (ACA) or agent version is not becoming active (vNext)
- Need to view container logs (ACA) or session logs (vNext) for a hosted agent
- Diagnose latency or timeout issues
- Query Application Insights for agent traces and exceptions
- Investigate agent runtime failures

## MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `agent_get` | Get agent details to determine type (prompt/hosted) and deployment kind (ACA/vNext) | `projectEndpoint` (required), `agentName` (optional) |
| `agent_container_status_get` | Check hosted agent container status (ACA only) | `projectEndpoint`, `agentName` (required); `agentVersion` |

## Workflow

### Step 1: Collect Agent Information

Use the project endpoint and agent name from the project context (see Common: Project Context Resolution). Ask the user only for values not already resolved:
- **Project endpoint** — AI Foundry project endpoint URL
- **Agent name** — Name of the agent to troubleshoot

### Step 2: Determine Agent Type

Use `agent_get` with `projectEndpoint` and `agentName` to retrieve the agent definition. Check the `kind` field:
- `"hosted"` → Check metadata to determine deployment kind, then proceed to Step 3
- `"prompt"` → Skip to Step 4 (Discover Observability Connections)

**Determining ACA vs vNext:** Inspect the agent version metadata. If `metadata.enableVnextExperience` is `"true"`, the agent is a **vNext** deployment. Otherwise it is an **ACA** deployment. This determines which log retrieval path to follow in Step 3.

### Step 3: Retrieve Logs (Hosted Agents Only)

**Hosted agents (ACA)** → Follow [Step 3a: Container Logs](#step-3a-container-logs)

**Hosted agents (vNext)** → Follow [Step 3b: Session Logs (vNext)](#step-3b-session-logs-vnext)

#### Step 3a: Container Logs

First check the container status using `agent_container_status_get`. Report the current status to the user.

Retrieve container logs using the Azure CLI command documented at:
[az cognitiveservices agent logs show](https://learn.microsoft.com/en-us/cli/azure/cognitiveservices/agent/logs?view=azure-cli-latest#az-cognitiveservices-agent-logs-show)

Refer to the documentation above for the exact command syntax and parameters. Present the logs to the user and highlight any errors or warnings found.

#### Step 3b: Session Logs (vNext)

vNext agents do not have containers. Logs are scoped to individual **sessions** (sandbox instances), not containers.

1. **Check agent version status** — Use `agent_get` to verify the agent version status is `active`. If it is not active, the agent may still be provisioning. There is no container to start manually — provisioning is automatic.

2. **List sessions** — vNext logs require a `sessionId`. If the user does not have one, list available sessions:
   ```bash
   az rest --method GET \
     --url "<projectEndpoint>/agents/<agentName>/sessions?api-version=2025-11-15-preview" \
     --headers "Foundry-Features=HostedAgents=V1Preview" \
     --resource "https://ai.azure.com"
   ```

3. **Retrieve session logs** — The log stream endpoint uses Server-Sent Events (SSE). Use `curl` with a timeout:
   ```bash
   TOKEN=$(az account get-access-token --resource "https://ai.azure.com" --query accessToken -o tsv)
   curl -s --max-time 15 \
     -H "Authorization: Bearer $TOKEN" \
     -H "Accept: text/event-stream" \
     -H "Foundry-Features: HostedAgents=V1Preview" \
     "<projectEndpoint>/agents/<agentName>/sessions/<sessionId>:logstream?api-version=2025-11-15-preview"
   ```

   > ⚠️ **404 is expected** if the session sandbox has not been created yet. Advise the user to send a message to the agent first to trigger sandbox creation, then retry.

4. **Interpret the logs** — Each SSE frame is `event: log\ndata: {...}\n\n`:
   - **Preamble** (first event): JSON with `session_state`, `session_id`, `agent`, `version`, `last_accessed`.
   - **Log lines** (subsequent events): JSON with `stream` (`stdout`/`stderr`/`status`), `message`, and `timestamp`.
   - **Error events**: `event: error` frames indicate server-side errors within the session sandbox.
   
   Present the logs to the user and highlight any errors or warnings found.

### Step 4: Discover Observability Connections

List the project connections to find Application Insights or Azure Monitor resources using the Azure CLI command documented at:
[az cognitiveservices account connection](https://learn.microsoft.com/en-us/cli/azure/cognitiveservices/account/connection?view=azure-cli-latest)

Refer to the documentation above for the exact command syntax and parameters. Look for connections of type `ApplicationInsights` or `AzureMonitor` in the output.

If no observability connection is found, inform the user and suggest setting up Application Insights for the project. Ask if they want to proceed without telemetry data.

### Step 5: Query Application Insights Telemetry

Use **`monitor_resource_log_query`** (Azure MCP tool) to run KQL queries against the Application Insights resource discovered in Step 4. This is preferred over delegating to the `azure-kusto` skill. Pass the App Insights resource ID and the KQL query directly.

> ⚠️ **Always pass `subscription` explicitly** to Azure MCP tools like `monitor_resource_log_query` — they don't extract it from resource IDs.

Use `* contains "<response_id>"` or `* contains "<agent_name>"` filters to narrow down results to the specific agent instance.

### Step 6: Summarize Findings

Present a summary to the user including:
- **Agent type and status** — hosted (ACA/vNext) or prompt; container status or agent version status (vNext)
- **Log errors** — key errors from container logs or session logs (vNext)
- **Telemetry insights** — exceptions, failed requests, latency trends
- **Recommended actions** — specific steps to resolve identified issues

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Agent not found | Invalid agent name or project endpoint | Use `agent_get` to list available agents and verify name |
| Container logs unavailable | Agent is a prompt agent or container never started | Prompt agents don't have container logs — skip to telemetry |
| Agent version not active (vNext) | vNext agent is still provisioning or failed | Check that the ACR image was pushed correctly and Agent Identity permissions are assigned; provisioning is automatic — wait and re-check status |
| Session logs 404 (vNext) | Session sandbox has not been created yet | The sandbox is created on first invocation — send a message to the agent to trigger sandbox creation, then retry |
| SSE error event (vNext) | Server-side error within the session sandbox | Check the error event `data` field for details |
| No session ID (vNext) | User does not know which session to troubleshoot | List sessions via REST API (see Step 3b) |
| No observability connection | Application Insights not configured for the project | Suggest configuring Application Insights for the Foundry project |
| Kusto query failed | Invalid cluster/database or insufficient permissions | Verify Application Insights resource details and reader permissions |
| No telemetry data | Agent not instrumented or too recent | Check if Application Insights SDK is configured; data may take a few minutes to appear |

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Agent Logs CLI Reference](https://learn.microsoft.com/en-us/cli/azure/cognitiveservices/agent/logs?view=azure-cli-latest)
- [Account Connection CLI Reference](https://learn.microsoft.com/en-us/cli/azure/cognitiveservices/account/connection?view=azure-cli-latest)
- [KQL Quick Reference](https://learn.microsoft.com/azure/data-explorer/kusto/query/kql-quick-reference)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
