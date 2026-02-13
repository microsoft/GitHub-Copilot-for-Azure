---
name: invoke
description: |
  Invoke and test deployed agents in Azure AI Foundry. Send messages to prompt and hosted agents, support single-turn and multi-turn conversations, and verify agent readiness.
  USE FOR: invoke agent, test agent, send message, run agent, conversation with agent, chat with agent, agent response, try agent, talk to agent.
  DO NOT USE FOR: deploying or creating agents (use deploy skill), containerizing projects or building Docker images (use package skill), Azure Functions (use azure-functions).
---

# Foundry Agent Run

Invoke and test deployed agents in Azure AI Foundry with single-turn and multi-turn conversations.

## Quick Reference

| Property | Value |
|----------|-------|
| Agent types | Prompt (LLM-based), Hosted (container-based) |
| MCP server | `foundry-agent` |
| Key MCP tools | `agent_invoke`, `agent_container_status_get`, `agent_get` |
| Conversation support | Single-turn and multi-turn (via `conversationId`) |

## When to Use This Skill

- Send a test message to a deployed agent
- Have multi-turn conversations with an agent
- Test a prompt agent immediately after creation
- Test a hosted agent after its container is running
- Verify an agent responds correctly to specific inputs

## MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `agent_invoke` | Send a message to an agent and get a response | `projectEndpoint`, `agentName`, `inputText` (required); `agentVersion`, `conversationId`, `containerEndpoint` |
| `agent_container_status_get` | Check container running status (hosted agents) | `projectEndpoint`, `agentName` (required); `agentVersion` |
| `agent_get` | Get agent details to verify existence and type | `projectEndpoint` (required), `agentName` (optional) |

## Workflow

### Step 1: Verify Agent Readiness

Delegate the readiness check to a sub-agent. Provide the project endpoint and agent name, and instruct it to:

**Prompt agents** → Use `agent_get` to verify the agent exists.

**Hosted agents** → Use `agent_container_status_get` to check:
- Status `Running` ✅ → Proceed to Step 2
- Status `Starting` → Wait and re-check
- Status `Stopped` or `Failed` ❌ → Warn the user and suggest using the deploy skill to start the container

### Step 2: Invoke Agent

Use the project endpoint and agent name from the project context (see Common: Project Context Resolution). Ask the user only for values not already resolved.

Use `agent_invoke` to send a message:
- `projectEndpoint` — AI Foundry project endpoint
- `agentName` — Name of the agent to invoke
- `inputText` — The message to send

**Optional parameters:**
- `agentVersion` — Target a specific agent version
- `containerEndpoint` — Route to a specific container endpoint (hosted agents only)

### Step 3: Multi-Turn Conversations

For follow-up messages, pass the `conversationId` from the previous response to `agent_invoke`. This maintains conversation context across turns.

Each invocation with the same `conversationId` continues the existing conversation thread.

## Agent Type Differences

| Behavior | Prompt Agent | Hosted Agent |
|----------|-------------|--------------|
| Readiness | Immediate after creation | Requires running container |
| Pre-check | `agent_get` to verify exists | `agent_container_status_get` for `Running` status |
| Routing | Automatic | Optional `containerEndpoint` parameter |
| Multi-turn | ✅ via `conversationId` | ✅ via `conversationId` |

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Agent not found | Invalid agent name or project endpoint | Use `agent_get` to list available agents and verify name |
| Container not running | Hosted agent container is stopped or failed | Use deploy skill to start the container with `agent_container_control` |
| Invocation failed | Model error, timeout, or invalid input | Check agent logs, verify model deployment is active, retry with simpler input |
| Conversation ID invalid | Stale or non-existent conversation | Start a new conversation without `conversationId` |
| Rate limit exceeded | Too many requests | Implement backoff and retry, or wait before sending next message |

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Agent Runtime Components](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
