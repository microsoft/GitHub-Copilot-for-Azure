# Managed Harness Agent Authoring

MHA is an azd-managed Prompt Agent:

```yaml
services:
  assistant:
    host: azure.ai.agent
    kind: prompt
    name: assistant
    model: gpt-5-mini
    instructions: Help the user.
    harness:
      type: github_copilot_preview
```

Use REST field names, normally `snake_case`, inside `tools[]`. azd strictly validates the harness and Copilot toolset; most other nested tool fields pass through to Foundry.

## Toolbox attachment

MHA prefers direct tools. When the user explicitly requests an existing Toolbox, represent its endpoint as a sibling reuse service:

```yaml
services:
  research-tools:
    host: azure.ai.toolbox
    endpoint: ${RESEARCH_TOOLBOX_ENDPOINT}
    env:
      RESEARCH_TOOLBOX_ENDPOINT: ${RESEARCH_TOOLBOX_ENDPOINT}

  assistant:
    host: azure.ai.agent
    uses:
      - research-tools
    kind: prompt
    harness:
      type: github_copilot_preview
    toolbox:
      name: research-tools
```

Set the endpoint outside source control:

```bash
azd env set RESEARCH_TOOLBOX_ENDPOINT "<toolbox-endpoint>"
```

Both `uses` and singular `toolbox` are required. `azd ai agent toolbox add` adds only `uses`; it does not attach the Toolbox to a Prompt Agent.

Optional fields:

```yaml
toolbox:
  name: research-tools
  version: "3"
  projectConnectionId: toolbox-auth
```

Do not use Hosted Agent `TOOLBOX_ENDPOINT` code wiring for MHA.

## Validation

After deploy, read the published definition and verify:

- `kind` remains `prompt`.
- `harness.type` remains `github_copilot_preview`.
- Direct tools retain their authored fields.
- The Toolbox resolves to an injected MCP tool when configured.

MHA, ordinary Prompt Agent, and Hosted Agent are not converted in place.
