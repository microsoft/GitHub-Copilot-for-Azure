# Use Skills in a Hosted Agent

How to consume Foundry **skills** (reusable behavioral guidelines) from hosted agent code. Two approaches:

1. **Direct download** — agent downloads skill ZIPs at startup via the Skills API, wires `SkillsProvider` (Python) or `AgentSkillsProvider` (C#).
2. **Via Toolbox MCP** — agent connects to a toolbox MCP endpoint that exposes skills as resources, wires `AgentSkillsProviderBuilder.UseMcpSkills` (C#) or `MCPStreamableHTTPTool` (Python).

> 📘 For skill resource CRUD (`azd ai skill create/update/list/download/delete`), see [skill-management.md](skill-management.md).
>
> 📘 For attaching skills to a toolbox (`azd ai toolbox skill add/remove/list`) and the raw MCP protocol, see [skill-toolbox.md](skill-toolbox.md).

## How progressive disclosure works

The Agent Framework SDK provides **progressive disclosure** so the model only loads skill content when needed:

1. **Advertise** — At agent startup, skill names and descriptions (~100 tokens each) are injected into the system prompt. The model sees *what skills exist* and *when to use them*.
2. **Load on demand** — The SDK synthesizes a `load_skill` tool. When the model determines a skill is relevant, it calls `load_skill(skill_name)` to retrieve the full `SKILL.md` body.
3. **Follow** — The model incorporates the loaded skill instructions into its behavior for the remainder of the conversation turn.

This keeps context usage low — only skills relevant to the current query consume tokens.

## Choosing an approach

| | Direct Download | Via Toolbox MCP |
|--|---|---|
| How it works | Agent downloads skill ZIPs at startup, extracts to disk, builds provider from local files | Agent connects to toolbox MCP endpoint; SDK reads `resources/list` and wraps into `load_skill` |
| Provider | `SkillsProvider.from_paths()` (Python) / `AgentSkillsProvider(dir)` (C#) | `MCPStreamableHTTPTool` (Python) / `AgentSkillsProviderBuilder().UseMcpSkills(mcpClient).Build()` (C#) |
| When skills update | Redeploy agent to pick up new versions | Consumer endpoint picks up new default version automatically (no redeploy) |
| Feature header | `Foundry-Features: Skills=V1Preview` | `Foundry-Features: Toolboxes=V1Preview` |
| When to use | Need explicit version control at startup, no toolbox in the project | Agents already consuming a toolbox; want dynamic skill updates without redeployment |

---

## Approach 1: Direct Download

The agent downloads skill ZIPs at startup via the Skills API, extracts them to disk, and builds a `SkillsProvider` / `AgentSkillsProvider` over the extracted files. The SDK then synthesizes `load_skill` for the model.

### Env vars

| Variable | Purpose |
|----------|---------|
| `FOUNDRY_PROJECT_ENDPOINT` | Project endpoint for SDK calls |
| `AZURE_AI_MODEL_DEPLOYMENT_NAME` | Model deployment for the agent |
| `SKILL_NAMES` | Comma-separated skill names to download |

### Python

The sample downloads each skill via `project.beta.skills.download()`, extracts the ZIP (with zip-slip guard), and attaches a `SkillsProvider` to the agent as a `context_providers` entry.

**Key classes:** `SkillsProvider.from_paths()`, `AIProjectClient` (with `allow_preview=True`).

Full working sample: [12-foundry-skills (Python)](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/agent-framework/responses/12-foundry-skills)

### C#

The sample uses `AgentAdministrationClient` (with `FoundryFeaturesPolicy` for the `Skills=V1Preview` header) to download skills via `ProjectAgentSkills.DownloadSkillAsync()`, extracts ZIPs, and attaches an `AgentSkillsProvider` via `AIContextProviders`.

**Key classes:** `AgentSkillsProvider`, `ProjectAgentSkills`, `AgentAdministrationClient`.

Full working sample: [agent-skills (C#)](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/hosted-agents/agent-framework/agent-skills)

---

## Approach 2: Via Toolbox MCP

Skills attached to a toolbox are discovered dynamically at runtime through the MCP endpoint. The agent connects to the toolbox, and the SDK reads `resources/list` to discover skills, then wraps them into the `load_skill` progressive disclosure pattern.

**Under the hood:** The toolbox MCP endpoint exposes skills via `resources/list` and `resources/read` with `skill://` URIs (standard MCP resources protocol). See [skill-toolbox.md § How skills appear at runtime](skill-toolbox.md) for raw MCP protocol details.

### Env vars

| Variable | Purpose |
|----------|---------|
| `FOUNDRY_PROJECT_ENDPOINT` | Project endpoint for SDK calls |
| `AZURE_AI_MODEL_DEPLOYMENT_NAME` | Model deployment for the agent |
| `TOOLBOX_ENDPOINT` | Full toolbox MCP endpoint URL (Python preferred) |
| `TOOLBOX_NAME` | Toolbox name — SDK constructs endpoint from project endpoint (C# preferred) |

### C#

The sample creates an `McpClient` using `HttpClientTransport` with `StreamableHttp` mode, then builds a skills provider via `AgentSkillsProviderBuilder().UseMcpSkills(mcpClient).Build()`. The framework handles the advertise → load → read lifecycle automatically.

**Key classes:** `AgentSkillsProviderBuilder`, `McpClient`, `BearerTokenHandler` (custom `HttpClientHandler` for token injection).

Full working sample: [foundry-toolbox-mcp-skills (C#)](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/hosted-agents/agent-framework/foundry-toolbox-mcp-skills)

---

## Deployment

### Provision skills before deploy

Skills must exist in the **same project** the deployed agent connects to:

```bash
azd ai skill create support-style --file ./skills/support-style/ --force
azd ai skill create escalation-policy --file ./skills/escalation-policy/ --force
```

### Wire env vars

```bash
# Direct download approach
azd env set SKILL_NAMES "support-style,escalation-policy"

# OR toolbox approach (skills already attached to toolbox)
azd env set TOOLBOX_NAME "agent-tools"
```

Add to `<service-dir>/agent.yaml`:

```yaml
environment_variables:
  - name: SKILL_NAMES
    value: ${SKILL_NAMES}
```

Then `azd deploy`.

### RBAC

The deployed agent's managed identity needs **Foundry User** on the project:

```bash
az role assignment create \
  --assignee <managed-identity-object-id> \
  --role "Foundry User" \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/projects/<project>
```

## Verify end-to-end

```bash
azd ai agent run
azd ai agent invoke --local "Hi, can I return my tent within 30 days?"
```

## Samples

| Language | Approach | Sample |
|----------|----------|--------|
| Python | Direct download | [12-foundry-skills](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/agent-framework/responses/12-foundry-skills) |
| Python | Via Toolbox | [04-foundry-toolbox](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/agent-framework/responses/04-foundry-toolbox) |
| C# | Direct download | [agent-skills](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/hosted-agents/agent-framework/agent-skills) |
| C# | Via Toolbox MCP | [foundry-toolbox-mcp-skills](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/hosted-agents/agent-framework/foundry-toolbox-mcp-skills) |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|------------|-----|
| `SKILL.md not found` after download | ZIP doesn't contain `SKILL.md` at root | Ensure skill was created from directory with `SKILL.md` at root |
| `403` on `beta.skills.download` | Identity missing RBAC | Grant **Foundry User** on the project scope |
| Agent ignores skills | Skill descriptions don't match user queries | Improve `description` in SKILL.md front matter |
| Skills load but agent doesn't follow them | Instructions vague or conflicting with system prompt | Refine skill body; test with canary tokens |
| `asyncio.TimeoutError` (Python) | Slow network or large skill packages | Increase timeout (default 60s) |
| `allow_preview` error (Python) | SDK client missing preview flag | `AIProjectClient(allow_preview=True)` |
| HTTP 500 on skill download (C#) | Missing `Foundry-Features: Skills=V1Preview` header | Register `FoundryFeaturesPolicy` on the client |
| `SKILL_NAMES` not set in deployed agent | Env var missing from `agent.yaml` | Add to `environment_variables[]`, then `azd deploy` |
| MCP client timeout (Toolbox) | Auth token expired or wrong scope | Use `https://ai.azure.com/.default` scope |
| Skills not discovered from toolbox | Toolbox version without skills is the default | Run `azd ai toolbox publish <toolbox> <version>` |
| `Invalid skill name 'xxx:download'` (Python) | SDK `v2.1.0` uses `:download` action syntax not supported by all server versions | Use `agent-framework-foundry` package (wraps the download correctly), or pin `azure-ai-projects>=2.1.0-beta.2` which matches the sample |
