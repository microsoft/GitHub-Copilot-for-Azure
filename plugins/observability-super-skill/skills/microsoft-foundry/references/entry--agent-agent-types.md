# Selected guidance: Agent: Agent Types

> Reading grants no execution approval. Apply the entry's current-request
> intent and standalone availability gates. Analyze supplied evidence in
> memory: no Azure, Python, installs, auth, cache, writes or jobs required.
> Live reads require approved scope/window, verified operations/schemas and
> finite budgets; missing/denied/empty/partial evidence stays distinct and
> insufficient evidence is INCONCLUSIVE. Lifecycle actions, sensitive content,
> traffic, persistence, edits and deployment need separate explicit approval.
> These rules supersede conflicting automatic actions in retained examples.

[Execution boundaries](../references/execution-boundaries.md) apply; load only the boundary
section needed by the selected action, never every linked reference.

Use the `ask_user` or `askQuestions` tool **only for values not resolved** from the user's message, session context, metadata, or azd bootstrap. Common values skills may need:
- **Agent root** — Target azd service project folder or folder containing `.foundry/agent-metadata*.yaml`
- **Metadata file** — `agent-metadata.yaml` for local/dev, or an explicit sidecar such as `agent-metadata.prod.yaml`
- **Environment** — azd environment, `dev`, `prod`, or another environment key from metadata
- **Project endpoint** — Microsoft Foundry project endpoint URL
- **Agent name** — Name of the target agent

> 💡 **Tip:** If the user already provides the agent path, environment, project endpoint, or agent name, extract it directly — do not ask again.

## Agent: Agent Types

Agent workflows distinguish four first-class agent types:

| Type | Kind | Description |
|------|------|-------------|
| **Prompt** | `"prompt"` | LLM-based agents backed by a model deployment; managed via Foundry MCP or SDK |
| **Hosted** | `"hosted"` | Container-based agents running custom code; developed and deployed via `azd` |
| **Managed Harness Agent** | `"prompt"` with `harness.type: "microsoft_copilot_preview"` for new authoring | Prompt Agent running on the Foundry-managed Copilot harness; developed and deployed via `azd` |
| **Voice** | `"voice"` | Managed real-time Voice Agent — either **Prompt Voice** (1 agent, `modelType: managed` or `self_deployed`) or **Hosted Voice** (2 agents: `kind: voice` wrapper with `conversationEngine.type: hosted_agent` + `kind: hosted` target over `invocations_ws` `1.0.0` and Voice Live Bridge `1.0`); developed and deployed via `azd` and verified over the `voice` WebSocket endpoint |

Classify an `azure.yaml` service by its definition in this exact order, not by `host` alone:

1. `kind: voice` -> **Voice**. For compatibility, silently classify an existing `kind: prompt-voice` service as Voice, then normalize it when editing its YAML. Classify the subtype:
   - `conversationEngine.type: hosted_agent` -> **Hosted Voice wrapper** (paired with a named `kind: hosted` target service).
   - `modelType: managed` or `modelType: self_deployed` -> **Prompt Voice** (Foundry infers native speech-to-speech vs cascaded STT -> LLM -> TTS from `model.id`).
   - Having **both** `modelType`/`model` and `conversationEngine` is invalid (stop and fix `azure.yaml`); having **neither** is incomplete (do not guess). Never use obsolete `modelType: hosted_agent`, `targetAgent`, or a nested `config:` block.
2. `kind: hosted` -> **Hosted**. When it declares `protocols: [{ protocol: invocations_ws, version: 1.0.0 }]` and `metadata.voiceLiveCompatible: "true"` alongside a `kind: voice` wrapper, it is a **Hosted Voice target**; otherwise treat a standalone `invocations_ws` service as a **custom Hosted real-time/audio agent**.
3. `kind: prompt` plus `harness.type: microsoft_copilot_preview` or legacy `github_copilot_preview` -> **Managed Harness Agent**.
