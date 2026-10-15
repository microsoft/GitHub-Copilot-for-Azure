# Create a Microsoft Foundry Voice Agent

Use this workflow to create, configure, or extend a **Microsoft Foundry Voice Agent** (`kind: voice` or CLI alias `kind: prompt-voice`) — either a single-agent **Prompt Voice Agent** or a two-agent **Hosted Voice Agent** (`kind: hosted` target + `kind: voice` wrapper).

> **Need a custom Hosted WebSocket agent with your own frame schema instead of the managed Foundry Voice pipeline?** Do **not** use `kind: voice`. Route to [../invocations-ws/invocations-ws.md](../invocations-ws/invocations-ws.md) to build a **custom Hosted real-time/audio agent** over raw `invocations_ws`.

## Core Rule — Model First

Before generating `azure.yaml`, running `azd ai agent init`, or scaffolding code, determine the **model and conversation engine strategy**.

When the user has not already specified the Voice architecture or model path:
- **Interactive mode**: Ask the user to choose first using `ask_user` / `askQuestions`:
  1. **Prompt Voice — Managed real-time speech model (Recommended)** (`modelType: managed`, default `model.id: gpt-realtime`; native speech-to-speech, no project model deployment required)
  2. **Prompt Voice — Project model deployment** (`modelType: self_deployed`; uses a model deployed in `services.ai-project.deployments` — Foundry infers native speech-to-speech vs cascaded STT -> LLM -> TTS from `model.id`)
  3. **Hosted Voice — Custom code / AgentServer Voice Live Bridge** (`conversationEngine.type: hosted_agent` in a `kind: voice` wrapper paired with a `kind: hosted` target agent over `invocations_ws` `1.0.0` + Voice Live Bridge `1.0`)
  4. **Custom Hosted real-time/audio agent (not a managed Voice Agent)** (raw `invocations_ws` container endpoint with custom frames -> route to [../invocations-ws/invocations-ws.md](../invocations-ws/invocations-ws.md))
- **Planning / explanation / comparison requests**: Present the model-first options, trade-offs, and `azure.yaml` structure **without** creating files or running `azd`.
- **Ambiguous subtype**: If the user has not chosen between Prompt Voice and Hosted Voice, stop and ask rather than guessing.
- **Non-interactive Prompt Voice defaults**: When the user explicitly requests a Prompt Voice Agent in a non-interactive context without specifying a model or voice, default to `modelType: managed`, `model: { id: gpt-realtime }`, output voice `en-US-Ava:DragonHDLatestNeural` (or `en-US-AvaNeural`), and `store: false`, and state those defaults clearly.
- **Self-deployed model requirement**: If the user selects `modelType: self_deployed` without naming a model or deployment, inspect existing project model deployments first or ask before writing `services.ai-project.deployments` and `model.id`.

---

## Architecture Comparison

| Capability | Prompt Voice (`modelType: managed` / `self_deployed`) | Hosted Voice (`conversationEngine.type: hosted_agent`) | Custom Hosted `invocations_ws` (Not a Voice Agent) |
|---|---|---|---|
| **Foundry agents created** | **1 agent** (`kind: voice` / `prompt-voice`) | **2 agents** (`kind: hosted` target + `kind: voice` wrapper) | **1 agent** (`kind: hosted`) |
| **Client endpoint** | Managed `voice` protocol WebSocket | Managed `voice` protocol WebSocket (on wrapper) | `invocations_ws` WebSocket |
| **Who owns audio / VAD / TTS / avatar / telephony** | Foundry Voice service (`kind: voice`) | Foundry Voice wrapper (`kind: voice`) | Your container code |
| **Who owns reasoning, model, instructions, and tools** | Foundry Voice service (`kind: voice`) | Hosted target container (`kind: hosted`) | Your container code |
| **Native vs cascaded speech** | Inferred by Foundry from `model.id` (real-time vs text/chat model) | Wrapper handles audio; target exchanges text/control events via Bridge `1.0` | Custom developer-defined protocol |

---

## Step 1: Select Subtype and Load Reference

1. Always read [references/voice-agent-yaml.md](references/voice-agent-yaml.md) for the exact `azure.yaml` service shapes, schema invariants, and audio/turn-detection/telephony options.
2. If building or modifying a **Hosted Voice Agent**, also read [references/voice-agent-hosted-bridge.md](references/voice-agent-hosted-bridge.md) for the two-agent contract and Voice Live Bridge `1.0` protocol.

### Critical Schema Invariants

- **Direct service-level properties**: Place `kind`, `name`, `modelType`, `model`, `conversationEngine`, `instructions`, `voice`, `audio`, `greeting`, `store`, `outputModalities`, and `telephony` **directly under `services.<service-key>`** — never under a deprecated `config:` block.
- **Canonical kind**: `kind: voice` or `kind: prompt-voice` in `azure.yaml` (`azd ai agent init --kind prompt-voice` writes `kind: prompt-voice`, which `azd` maps to service kind `voice`).
- **Mutually exclusive engine configuration**:
  - A `kind: voice` / `prompt-voice` service must declare **either** `model: { id: <model-or-deployment> }` (with `modelType: managed` or `self_deployed`) **or** `conversationEngine: { type: hosted_agent, name: <target-service> }`.
  - Declaring **both** `modelType`/`model` and `conversationEngine` is invalid — stop and fix `azure.yaml`.
  - Declaring **neither** is incomplete — do not guess.
- **Never use obsolete fields**: `modelType: hosted_agent`, `targetAgent`, and `config:` are unsupported. Always use `conversationEngine.type: hosted_agent` and `conversationEngine.name`.
- **Distinct names in Hosted Voice**: The `kind: hosted` target and `kind: voice` wrapper must have different service keys and different `name` values.
- **Privacy default**: Set `store: false` by default unless the user explicitly requests conversation/audio storage and confirms retention requirements.

---

## Step 2: Initialize or Author the Project

### Path A: Managed Prompt Voice (`modelType: managed`)

Initialize a declarative Prompt Voice project with `azd ai agent init`:

```bash
azd ai agent init --kind prompt-voice --agent-name <agent-name> \
  --model gpt-realtime --voice en-US-Ava:DragonHDLatestNeural
```

- **Supported flags on `--kind prompt-voice`**: `--agent-name`, `--model` (defaults to `gpt-realtime`), `--voice` (e.g., `en-US-Ava:DragonHDLatestNeural`, `en-US-AvaNeural`, or `alloy`), `--project-id`, `--environment`, `--force`, `--no-prompt`.
- **Rejected flags on `--kind prompt-voice`**: Do **not** pass `--src` (or a positional source directory), `--protocol`, `--deploy-mode`, `--runtime`, `--entry-point`, `--dep-resolution`, `--model-deployment`, `--description`, `--rai-policy`, `--acr-connection`, `--registry-connection`, `--harness`, `--instructions`, or `--image`.
- **Authoring instructions and settings**: Do not pass `--instructions` to `azd ai agent init --kind prompt-voice`. Edit the generated `azure.yaml` service block directly to configure `instructions`, `greeting`, `store: false`, `audio`, `tools`, `handoff`, `structuredInputs`, and `telephony` per [references/voice-agent-yaml.md](references/voice-agent-yaml.md).
- **No model deployment needed**: `modelType: managed` uses Foundry's service-hosted real-time model and does not require a deployment entry under `services.ai-project.deployments`.

### Path B: Self-Deployed Prompt Voice (`modelType: self_deployed`)

Use `modelType: self_deployed` when the Voice Agent must use a specific project model deployment in `services.ai-project.deployments` (either a deployed real-time model or a text/chat model where Foundry runs cascaded STT -> LLM -> TTS):

1. Initialize with `azd ai agent init --kind prompt-voice --agent-name <agent-name>` or update `azure.yaml`.
2. Add the model deployment under `services.ai-project.deployments` (for example, `gpt-4o-mini` or a project-deployed realtime model) if provisioning a new deployment, or reference an existing project deployment name.
3. On the `kind: prompt-voice` / `kind: voice` service block (directly under the service, not under `config:`), set:
   - `modelType: self_deployed`
   - `model: { id: <deployment-name> }`
   - `store: false`
   - `instructions`, `voice`, `greeting`, and `audio` as needed (see [references/voice-agent-yaml.md](references/voice-agent-yaml.md)).

### Path C: Hosted Voice (`conversationEngine.type: hosted_agent`)

Hosted Voice pairs a custom code/container target (`kind: hosted`) with a managed Voice wrapper (`kind: voice`):

1. **Initialize**:
   - Adopt the official Hosted Voice sample manifest when starting from the sample:
     ```bash
     azd ai agent init -m https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/bring-your-own/voice-agent-target-agent/basic/azure.yaml
     ```
   - Or scaffold/configure the `kind: hosted` target service in `src/<target-agent>/` (see [create-hosted.md](create-hosted.md)) and add the `kind: voice` wrapper service to `azure.yaml`.
2. **Configure the Hosted target (`kind: hosted`)**:
   - Must expose `protocols: [{ protocol: invocations_ws, version: 1.0.0 }]` on `/invocations_ws` (port `8088` + `GET /readiness`).
   - Must declare `metadata: { voiceLiveCompatible: "true", bridgeProtocolVersion: "1.0" }` directly on the service block.
   - Owns model inference (e.g., `env: { AZURE_AI_MODEL_DEPLOYMENT_NAME: ${AZURE_AI_MODEL_DEPLOYMENT_NAME} }`), bounded conversation history, tools, and Voice Live Bridge `1.0` callbacks (`session.start` -> `session.ready`, `user.message` -> `response.created` -> `response.output_text.delta` -> `response.output_text.done` -> `response.done`, `barge_in`, `session.end`). See [references/voice-agent-hosted-bridge.md](references/voice-agent-hosted-bridge.md).
3. **Configure the Voice wrapper (`kind: voice`)**:
   - Declare `uses: [ai-project, <target-service-key>]`.
   - Declare `conversationEngine: { type: hosted_agent, name: <target-service-name> }`.
   - Configure `store: false`, `greeting: { type: template, text: ... }`, `audio`, and `outputModalities: [audio]` directly on the service block.
   - **Omit** `modelType`, `model`, `instructions`, `tools`, `protocols`, and `codeConfiguration` on the wrapper (those are forbidden by schema when `conversationEngine` is set).

---

## Step 3: Local Validation (Hosted Voice Target Only)

- **Prompt Voice**: Runs entirely in the Foundry cloud service; there is no local container to start. Proceed directly to Step 4.
- **Hosted Voice**: Before deploying to Azure, test the `kind: hosted` target server locally on `ws://127.0.0.1:8088/invocations_ws` using the Bridge `1.0` `/help` smoke test (`uv run --no-sync python scripts/smoke_test.py`: sends `session.start` with `protocol_version: "1.0"`, expects `session.ready`, sends `user.message` with `"/help"`, and verifies `response.created` -> `response.output_text.done` -> `response.done`). Follow [references/voice-agent-hosted-bridge.md](references/voice-agent-hosted-bridge.md) and [references/local-run.md](references/local-run.md).

---

## Step 4: Provision and Deploy

Follow [../deploy/deploy.md](../deploy/deploy.md) to provision and deploy:

```bash
azd provision --no-prompt
azd deploy --no-prompt
```

- **Prompt Voice**: Deploys a single Foundry Voice Agent (`kind: voice`).
- **Hosted Voice**: Deploys **both** the `kind: hosted` target and the `kind: voice` wrapper (deploy the target first or deploy all services together). Report the deployment status and active version of each service separately.

---

## Step 5: Smoke-Test Over the Voice WebSocket

> **Important**: `azd ai agent invoke` does **not** support Voice Agents (`kind: voice` or `kind: prompt-voice`), including Hosted Voice wrappers. Do not use `azd ai agent invoke` or `azd ai agent eval generate` to verify a Voice Agent.

Read [references/voice-agent-smoke-test.md](references/voice-agent-smoke-test.md) and verify the deployed Voice Agent over its managed `voice` WebSocket endpoint (`wss://<project-host>/api/projects/<project>/agents/<voice-agent>/endpoint/protocols/voice?api-version=v1`).

Run the paired smoke-test helper from the `microsoft-foundry` skill root (`plugins/azure-skills/skills/microsoft-foundry`):

**Bash**
```bash
./foundry-agent/create/scripts/smoke-test-voice.sh \
  --endpoint "$AZURE_AI_PROJECT_ENDPOINT" \
  --agent-name "<voice-agent-name>" \
  --text "Hello, briefly introduce yourself."
```

**PowerShell**
```powershell
.\foundry-agent\create\scripts\smoke-test-voice.ps1 `
  -Endpoint $env:AZURE_AI_PROJECT_ENDPOINT `
  -AgentName "<voice-agent-name>" `
  -Text "Hello, briefly introduce yourself."
```

See [scripts/smoke-test-voice.sh](scripts/smoke-test-voice.sh), [scripts/smoke-test-voice.ps1](scripts/smoke-test-voice.ps1), and [../invoke/invoke.md](../invoke/invoke.md) for full invocation and troubleshooting details.
