# Use Toolbox in a Hosted Agent

Hosted agents access Foundry-managed tools through a **Toolbox MCP endpoint**. Unlike prompt agents that wire tools directly, hosted agents connect to a single MCP-compatible endpoint that exposes all configured tools. The platform handles credential injection, token refresh, and policy enforcement.

> 📘 For endpoint format, MCP protocol details, auth, OAuth consent handling, testing, citation pattern, and troubleshooting, see [toolbox-reference.md](toolbox-reference.md).
>
> 📘 For wiring a remote tool (catalog tile or generic MCP server) into a project connection that a toolbox can attach to, see [foundry-tool-catalog.md](foundry-tool-catalog.md).

## Quick Reference

| Property | Value |
|----------|-------|
| **Toolbox Docs** | https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox |
| **Tool Catalog Docs** | https://learn.microsoft.com/azure/ai-foundry/agents/concepts/tool-catalog?view=foundry |
| **Default Sample (Python)** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/toolbox/maf |
| **Python Hosted Agent — `responses`** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses |
| **Python Hosted Agent — `invocations`** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/invocations |
| **C# (.NET) Samples** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/toolbox |
| **Supported Tool Types & Auth** | https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/SUPPORTED_TOOLBOX_TOOLS.md |

## Resolve Toolbox Endpoint

If the user provides a toolbox name or endpoint URL, or the project already references a toolbox (e.g., in `.env` or `agent.manifest.yaml`) → use it directly.

Otherwise, ask one question:

> _"Would you like to provide your toolbox endpoint? (you can create one with the [Foundry Toolkit in VS Code](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) or the [Foundry Portal](https://ai.azure.com/))"_

Once the user supplies the toolbox name/endpoint — either an existing one or a new one they create via the Foundry Toolkit or Foundry Portal — set it on the agent (e.g., `TOOLBOX_ENDPOINT` in `.env`) and continue with verification.

> **When asking the question, always include the doc links inline** for the manual options — the [Foundry Toolkit in VS Code](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) and the [Foundry Portal](https://ai.azure.com/) — so the user knows where to go to create a tool/toolbox themselves. Don't just name the options; render them as clickable links every time.

> **Before printing out any step-by-step guidance** for the Foundry Toolkit (VS Code) path, fetch and read [Use Tool Catalog to connect tools and Toolboxes in Foundry Toolkit](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) first, then summarize the relevant steps for them. Don't paraphrase from memory — the Toolkit UI changes; quote the current doc.

> **Available tool types** (for context when discussing what the toolbox will contain): Web Search, Azure AI Search, Code Interpreter, File Search, MCP Server (third-party MCP servers, e.g. GitHub, and Microsoft first-party MCP servers, e.g. WorkIQ), OpenAPI, Agent-to-Agent (A2A). See [Configure tools](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox#configure-tools).

## Information to Gather Before Building a Toolbox Payload

When the user asks to "add an MCP tool" or similar, **never guess**. Confirm each field before generating any JSON or `azure.yaml` snippet:

| # | Question | Why needed |
|---|----------|------------|
| 1 | **MCP server URL?** | The `server_url` field on the `mcp` tool entry |
| 2 | **Auth type?** `none` / `key` / `oauth` | Determines whether a project connection is required and which shape to create (see [foundry-tool-catalog.md](foundry-tool-catalog.md)) |
| 3 | **Project connection name** (if auth ≠ `none`) | The `project_connection_id` field; must already exist in the Foundry project |
| 4 | **`server_label`** | Short prefix for the tool names exposed by this server (e.g. `myserver`) |
| 5 | **Toolbox name** | The container that will hold the tool entries |
| 6 | **Foundry project endpoint** | Where the toolbox is created — usually `FOUNDRY_PROJECT_ENDPOINT` or `AZURE_AI_PROJECT_ENDPOINT` in `.env` |

### Toolbox payload — MCP with a project connection

```json
{
  "name": "<TOOLBOX_NAME>",
  "description": "MCP server with key or OAuth auth",
  "tools": [
    {
      "type": "mcp",
      "server_label": "<LABEL>",
      "server_url": "<SERVER_URL>",
      "require_approval": "never",
      "project_connection_id": "<CONNECTION_NAME>"
    }
  ]
}
```

### Toolbox payload — public MCP (no auth)

```json
{
  "name": "api-specs",
  "description": "Public MCP server, no connection needed",
  "tools": [
    {
      "type": "mcp",
      "server_label": "api_specs",
      "server_url": "https://gitmcp.io/Azure/azure-rest-api-specs",
      "require_approval": "never"
    }
  ]
}
```

### Declarative path via `azd`

If the project already uses `azd ai agent init`, prefer declaring the toolbox in `azure.yaml` so `azd deploy` provisions it and injects `TOOLBOX_ENDPOINT` automatically:

```yaml
resources:
  - kind: connection
    name: <CONNECTION_NAME>
    target: <MCP_SERVER_URL>
    category: remoteTool
    credentials:
      type: CustomKeys
      keys:
        Authorization: "Bearer {{ github_pat }}"   # use {{ param }} for secrets

  - kind: toolbox
    name: agent-tools
    tools:
      - type: web_search
      - type: mcp
        server_label: <LABEL>
        server_url: <MCP_SERVER_URL>
        project_connection_id: <CONNECTION_NAME>
```

## Code Integration Patterns

The sample repo provides integration patterns for both Python and C#. Read the sample code and adapt it to the user's project.

**Python samples:**

| Sample | Framework | Protocol | When to use |
|--------|-----------|----------|-------------|
| [`toolbox/maf/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/toolbox/maf) — recommended | Agent Framework (MAF) | Responses | **Default choice** |
| [`bring-your-own/responses/langgraph-toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses/langgraph-toolbox) | LangGraph (BYO) | Responses | LangGraph hosted agent with toolbox |
| [`toolbox/copilot-sdk/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/toolbox/copilot-sdk) | GitHub Copilot SDK | Responses | Copilot SDK with toolbox tools |
| [`bring-your-own/responses/bring-your-own-toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses/bring-your-own-toolbox) | Generic MCP (BYO) | Responses | Raw `httpx` MCP client — works with any framework |
| [`bring-your-own/invocations/toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/invocations/toolbox) | Generic MCP (BYO) | Invocations | Toolbox via Invocations protocol |

**C# (.NET) samples:**

| Sample | Description |
|--------|-------------|
| [`csharp/toolbox/maf/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/toolbox/maf) — recommended | Agent Framework agent with toolbox MCP (Responses protocol) |

**Notes:** (apply to all patterns, both Python and C#):
- Auth: Inject a bearer token with scope `https://ai.azure.com/.default` on every request (Python: `httpx.Auth` subclass; C#: `DefaultAzureCredential` + `BearerTokenAuthenticationPolicy`).
- Header: Always include `Foundry-Features: Toolboxes=V1Preview`.
- MCP client: Pass `load_prompts=False` — the toolbox endpoint does not support `prompts/list`.
- Endpoint: Construct from `{project_endpoint}/toolboxes/{toolbox_name}/mcp?api-version=v1`.
- Multi-tool toolboxes: at most one tool per unnamed type, and unique `server_label` per MCP tool (see [toolbox-reference.md](toolbox-reference.md#multi-tool-toolbox-constraint)).

> 💡 **Tip:** If MCP tools have `require_approval: "always"` in `_meta.tool_configuration`, the agent runtime must ask the user for confirmation before invoking. The toolbox endpoint does not enforce this — your agent code is responsible.

## Tracing

All toolbox samples emit OpenTelemetry traces. To export to Azure Monitor, set `APPLICATIONINSIGHTS_CONNECTION_STRING` in `.env` for local development; the platform injects it automatically when the agent is deployed against a Foundry project that is linked to an Application Insights resource. No code changes required — `maf` calls `enable_instrumentation()` in `main.py`, and `langgraph` / `azd` templates auto-instrument via `azure-ai-agentserver-core[tracing]`. View traces in the Azure Portal under **Application Insights → Investigate → Transaction search** or **Application map**.
