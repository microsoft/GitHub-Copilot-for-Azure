# Invoke Foundry Agent

Invoke and test deployed agents in Azure AI Foundry with single-turn and multi-turn conversations.

## Quick Reference

| Property | Value |
|----------|-------|
| Agent types | Prompt (LLM-based), Hosted |
| MCP server | `azure` |
| Key Foundry MCP tools | `agent_invoke`, `agent_get` |
| Conversation support | Single-turn and multi-turn (via `conversationId`) |
| Session support | Sticky sessions for hosted agents (via client-generated `sessionId`) |

## When to Use This Skill

- Send a test message to a deployed agent
- Have multi-turn conversations with an agent
- Test a prompt agent immediately after creation
- Test a hosted agent after deployment
- Verify an agent responds correctly to specific inputs

## MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `agent_invoke` | Send a message to an agent and get a response | `projectEndpoint`, `agentName`, `inputText` (required); `agentVersion`, `conversationId`, `sessionId` |
| `agent_get` | Get agent details to verify existence and type | `projectEndpoint` (required), `agentName` (optional) |

## Workflow

### Step 1: Verify Agent Readiness

Delegate the readiness check to a sub-agent. Provide the project endpoint and agent name, and instruct it to:

**Prompt agents** → Use `agent_get` to verify the agent exists.

**Hosted agents** → Use `agent_get` to verify the agent exists and that the targeted version is available for invocation. If a specific version is supplied, verify that version is `active` before continuing.

### Step 2: Invoke Agent

Use the project endpoint and agent name from the project context (see Common: Project Context Resolution). Ask the user only for values not already resolved.

Use `agent_invoke` to send a message:
- `projectEndpoint` — AI Foundry project endpoint
- `agentName` — Name of the agent to invoke
- `inputText` — The message to send

**Optional parameters:**
- `agentVersion` — Target a specific agent version
- `conversationId` — Continue an existing conversation
- `sessionId` — MANDATORY for hosted agents; include the session ID to maintain sticky sessions with the same compute resource

#### Session Support for Hosted Agents

Hosted agents accept a 25 character alphanumeric `sessionId` parameter. Sessions are **sticky**: they route the request to the same underlying compute resource, so the agent can reuse state stored on that compute across multiple turns.

Rules:
1. You MUST generate a unique `sessionId` before making the first `agent_invoke` call.
2. If you have a session ID, you MUST include it in every subsequent `agent_invoke` call for that conversation.
3. When the user explicitly requests a new session, create a new `sessionId` and use it for the rest of the `agent_invoke` calls.

This is different from `conversationId`, which tracks conversation history. `sessionId` controls which compute instance handles the request.

If invocation fails with a permission-related error, read and follow the [troubleshoot skill](../troubleshoot/troubleshoot.md). Verify that `Cognitive Services User` is assigned to the instance identity at the Azure AI Services resource scope.

### Step 3: Multi-Turn Conversations

For follow-up messages, pass the `conversationId` from the previous response to `agent_invoke`. This maintains conversation context across turns.

Each invocation with the same `conversationId` continues the existing conversation thread.

## Agent Type Differences

| Behavior | Prompt Agent | Hosted Agent |
|----------|--------------|--------------|
| Readiness | Immediate after creation | Ready after deployment once the target version is active |
| Pre-check | `agent_get` to verify existence | `agent_get` to verify existence and active version |
| Routing | Automatic | Sticky routing via required `sessionId` |
| Multi-turn | ✅ via `conversationId` | ✅ via `conversationId` plus sticky `sessionId` |

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Agent not found | Invalid agent name or project endpoint | Use `agent_get` to list available agents and verify name |
| Hosted agent not active | The requested hosted agent version is still provisioning or failed | Use `agent_get` to inspect version status, then follow the troubleshoot skill if it does not become `active` |
| Invocation failed | Model error, timeout, or invalid input | Check agent logs, verify model deployment is active, retry with simpler input |
| Invocation failed with permission error | Missing or incorrect invocation RBAC for the instance identity | Read and follow the troubleshoot skill, verify `Cognitive Services User` on the instance identity at the Azure AI Services resource scope, then retry invocation |
| Conversation ID invalid | Stale or non-existent conversation | Start a new conversation without `conversationId` |
| Rate limit exceeded | Too many requests | Implement backoff and retry, or wait before sending next message |

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Agent Runtime Components](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
