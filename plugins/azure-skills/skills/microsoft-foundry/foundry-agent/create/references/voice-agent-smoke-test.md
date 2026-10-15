# Voice Agent WebSocket Smoke-Test Reference

How to verify a deployed Microsoft Foundry Voice Agent (`kind: voice` / `kind: prompt-voice`) — either a **Prompt Voice Agent** or a **Hosted Voice wrapper** — over the managed Foundry `voice` WebSocket endpoint.

> **Why not `azd ai agent invoke`?**
> `azd ai agent invoke` supports Responses (`responses`) and standard Hosted HTTP invocations, **not** the `voice` WebSocket protocol. Always verify Voice Agents with the Foundry Voice WebSocket client or the Foundry portal Voice playground.

---

## Managed `voice` WebSocket Endpoint Contract

- **URL format**:
  ```text
  wss://<project-host>/api/projects/<project>/agents/<voice-agent-name>/endpoint/protocols/voice?api-version=v1
  ```
  Derived from `AZURE_AI_PROJECT_ENDPOINT` (`https://<project-host>/api/projects/<project>`).
- **Authentication**:
  Bearer token via `DefaultAzureCredential` with scope `https://ai.azure.com/.default` (`Authorization: Bearer <token>`). Never hard-code tokens or API keys in scripts or commits.
- **Target agent name**:
  - For **Prompt Voice**: pass the `kind: voice` agent's `config.name`.
  - For **Hosted Voice**: pass the **`kind: voice` wrapper's** `config.name` (not the `kind: hosted` target's name) to test the full end-to-end Voice pipeline.

---

## Prerequisites

Install the Azure AI Projects Voice SDK extra and Azure Identity in your Python environment:

```bash
pip install "azure-ai-projects[voice]" azure-identity
```

Ensure you are signed in (`az login`) and your identity has **Azure AI User** (or **Azure AI Developer**) on the Foundry project.

---

## Running the Smoke-Test Helper Scripts

Run the paired helper scripts from the `microsoft-foundry` skill root (`plugins/azure-skills/skills/microsoft-foundry`):
- Bash: [../scripts/smoke-test-voice.sh](../scripts/smoke-test-voice.sh)
- PowerShell: [../scripts/smoke-test-voice.ps1](../scripts/smoke-test-voice.ps1)

Note that PowerShell uses PascalCase parameter names (`-Endpoint`, `-AgentName`, `-Text`, `-Timeout`, `-OutputAudio`, `-DryRun`, `-Help`), whereas Bash uses kebab-case flags (`--endpoint`, `--agent-name`, `--text`, `--timeout`, `--output-audio`, `--dry-run`, `--help`).

### 1. Preview / Dry Run (no network connection)

**Bash**
```bash
./foundry-agent/create/scripts/smoke-test-voice.sh \
  --endpoint "https://<account>.services.ai.azure.com/api/projects/<project>" \
  --agent-name "<voice-agent-name>" \
  --dry-run
```

**PowerShell**
```powershell
.\foundry-agent\create\scripts\smoke-test-voice.ps1 `
  -Endpoint "https://<account>.services.ai.azure.com/api/projects/<project>" `
  -AgentName "<voice-agent-name>" `
  -DryRun
```

### 2. Live Smoke Test (connect, receive greeting/session events, send text prompt, verify audio/text response)

**Bash**
```bash
./foundry-agent/create/scripts/smoke-test-voice.sh \
  --endpoint "$AZURE_AI_PROJECT_ENDPOINT" \
  --agent-name "<voice-agent-name>" \
  --text "Hello, can you hear me?" \
  --timeout 30
```

**PowerShell**
```powershell
.\foundry-agent\create\scripts\smoke-test-voice.ps1 `
  -Endpoint $env:AZURE_AI_PROJECT_ENDPOINT `
  -AgentName "<voice-agent-name>" `
  -Text "Hello, can you hear me?" `
  -Timeout 30
```

### Exit Codes

| Exit Code | Meaning |
|---|---|
| `0` | Smoke test passed (WebSocket connected, session initialized, and greeting or response events received) or `--dry-run` / `--help` succeeded |
| `1` | Smoke test failed (authentication error, WebSocket handshake/session error, timeout, or missing Python packages) |
| `2` | Usage or argument validation error (missing `--endpoint`/`-Endpoint`, missing `--agent-name`/`-AgentName`, invalid `--timeout`/`-Timeout`, or unknown option) |

---

## What a Passing Smoke Test Verifies

1. **Authentication & WebSocket Upgrade**: Acquires an Entra token (`https://ai.azure.com/.default`) and establishes the `voice` protocol WebSocket session.
2. **Session Readiness / Greeting**: Receives session initialization (`session.created` / `session.updated`) and any configured `greeting` output.
3. **Turn Processing**: Sends a text turn (`conversation.item.create` + `response.create`) and verifies streamed assistant transcript deltas (`response.audio_transcript.delta` / `response.text.delta`) or audio chunks (`response.audio.delta`) through `response.done`, then closes the socket cleanly.
