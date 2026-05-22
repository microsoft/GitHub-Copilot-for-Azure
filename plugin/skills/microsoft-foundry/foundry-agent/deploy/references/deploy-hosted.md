# Hosted Agent Deployment Workflow

Part of the [deploy skill](../deploy.md).

This reference covers the hosted-agent deployment flow from project detection through verification.

## Workflow

### Step 1: Detect and Scan Project

Get the project path from the selected agent root in the project context (see Common: Project Context Resolution). Detect the project type, collect environment variables, and prepare the container build by following [Containerize and Build](containerize-and-build.md#step-1-detect-and-scan-project).

### Step 2: Collect and Confirm Environment Variables

Follow [Containerize and Build](containerize-and-build.md#step-2-collect-and-confirm-environment-variables).

### Step 3: Generate Dockerfile and Build Image

Follow [Containerize and Build](containerize-and-build.md#step-3-generate-dockerfile-and-build-image).

### Step 4: Collect Agent Configuration

Use the project endpoint and ACR name from the project context. Ask the user only for values not already resolved:
- **Agent name** -- Unique name for the agent
- **Model deployment** -- Model deployment name (e.g., `gpt-4o`)

### Step 5: Get Agent Definition Schema

Use `agent_definition_schema_get` with `schemaType: hosted` to retrieve the current schema and validate required fields.

### Step 6: Create the Agent

Use `agent_update` with the agent definition:

> **Protocol version source of truth:** Do NOT copy the protocol version from `agent_definition_schema_get` examples. Use the protocol version declared by the agent source itself (for example, `agent.yaml` or `agent.manifest.yaml`).

```json
{
  "command": "agent_update",
  "intent": "Update a hosted agent with a new docker image",
  "parameters": {
    "projectEndpoint": "<project-endpoint>",
    "agentName": "<agent-name>",
    "agentDefinition": {
      "kind": "hosted",
      "image": "<acr-name>.azurecr.io/<repository>:<tag>",
      "cpu": "<cpu-cores>",
      "memory": "<memory>",
      "container_protocol_versions": [
        { "protocol": "<protocol>", "version": "<version>" }
      ],
      "environment_variables": { "<var>": "<value>" }
    }
  }
}
```

Capture the per-agent identity from the agent creation response, then retrieve the project-level agent identity from the project resource after creation. You will need both identities to assign the minimum RBAC required for invocation before running invoke tests.

### Step 7: Test the Agent

Follow [RBAC and Invocation Verification](rbac-and-verify.md) for the minimum RBAC checks and hosted-agent verification flow.

> **DO NOT stop here.** After a successful deployment, continue with [Display and document deployment context](post-deploy.md) and [Auto-Setup Evaluators & Dataset](../../observe/references/deploy-and-setup.md). These steps are mandatory after every successful deployment.

## Agent Definition Schema

### Hosted Agent

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `kind` | string | Yes | Must be `"hosted"` |
| `image` | string | Yes | Container image URL |
| `cpu` | string | Yes | CPU allocation (e.g., `"0.5"`, `"1"`, `"2"`) |
| `memory` | string | Yes | Memory allocation (e.g., `"1Gi"`, `"2Gi"`) |
| `container_protocol_versions` | array | Yes | Protocol and version pairs |
| `environment_variables` | object | | Key-value pairs for container env vars |
| `tools` | array | | Tool configurations |
| `rai_config` | object | | Responsible AI configuration |

### Container Protocols

| Protocol | Description |
|----------|-------------|
| `a2a` | Agent-to-Agent protocol |
| `responses` | OpenAI Responses API |
| `invocations` | Invocation payload protocol for arbitrary request bodies and custom SSE behavior |
| `mcp` | Model Context Protocol |
