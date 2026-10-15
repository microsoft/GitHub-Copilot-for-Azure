# Voice Agent WebSocket Smoke-Test Reference

How to verify a deployed Microsoft Foundry Voice Agent (`kind: voice` / `kind: prompt-voice`) — either a **Prompt Voice Agent** or a **Hosted Voice wrapper** — over the managed Foundry `voice` WebSocket endpoint.

> **Why not `azd ai agent invoke`?**
> `azd ai agent invoke` rejects `kind: voice` and `kind: prompt-voice` services (`errVoiceInvocationUnsupported`). Always verify Voice Agents over the managed `voice` WebSocket endpoint or in the Microsoft Foundry portal (`https://ai.azure.com`). You can inspect the deployed endpoint URL with `azd ai agent endpoint show <voice-service>`.

---

## Managed `voice` WebSocket Endpoint Contract

- **URL format**:
  ```text
  wss://<project-host>/api/projects/<project>/agents/<voice-agent-name>/endpoint/protocols/voice?api-version=v1&agent_session_id=<session-id>
  ```
  Derived from `AZURE_AI_PROJECT_ENDPOINT` / `FOUNDRY_PROJECT_ENDPOINT` (`https://<project-host>/api/projects/<project>`).
- **Headers**:
  - `Authorization`: Entra access token for resource `https://ai.azure.com` (`az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv`), formatted dynamically as `"{} {}".format("Bearer", token)`. Never hard-code tokens or API keys in scripts or commits.
  - `Foundry-Features: VoiceAgents=V1Preview`
- **Target agent name**:
  - For **Prompt Voice**: pass the `kind: voice` / `kind: prompt-voice` agent's `name`.
  - For **Hosted Voice**: pass the **`kind: voice` wrapper's** `name` (not the `kind: hosted` target's name) to test the full end-to-end Voice pipeline.

---

## Prerequisites

Install `websockets` in your Python environment and ensure Azure CLI is authenticated (`az login`):

```bash
pip install websockets
```

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

### 2. Live Smoke Test (connect, wait for `session.updated`, send typed turn, verify completed transcript + base64 audio)

**Bash**
```bash
./foundry-agent/create/scripts/smoke-test-voice.sh \
  --endpoint "$AZURE_AI_PROJECT_ENDPOINT" \
  --agent-name "<voice-agent-name>" \
  --text "In one short sentence, introduce yourself." \
  --timeout 180
```

**PowerShell**
```powershell
.\foundry-agent\create\scripts\smoke-test-voice.ps1 `
  -Endpoint $env:AZURE_AI_PROJECT_ENDPOINT `
  -AgentName "<voice-agent-name>" `
  -Text "In one short sentence, introduce yourself." `
  -Timeout 180
```

### Exit Codes

| Exit Code | Meaning |
|---|---|
| `0` | Smoke test passed (`response.done` with `response.status == "completed"`, non-empty `response.output_audio_transcript.delta`/`done`, and non-empty base64 `response.output_audio.delta`) or `--dry-run` / `--help` succeeded |
| `1` | Smoke test failed (authentication error, WebSocket `error` frame, non-`completed` status, empty transcript, zero audio deltas, timeout, or missing `websockets` package) |
| `2` | Usage or argument validation error (missing `--endpoint`/`-Endpoint`, missing `--agent-name`/`-AgentName`, invalid `--timeout`/`-Timeout`, or unknown option) |

---

## Verified Wire Event Sequence

1. **Connect & Authenticate**: Connects to `.../agents/<agent>/endpoint/protocols/voice?api-version=v1&agent_session_id=<id>` with `Foundry-Features: VoiceAgents=V1Preview` and an Entra token for `https://ai.azure.com`.
2. **Wait for `session.updated`**: Waits for the server's `session.updated` event (and any initial greeting `response.done` if a greeting response runs before the user turn) before sending user input.
3. **Send Typed Turn**:
   - Sends `{"type": "conversation.item.create", "item": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "<prompt>"}]}}`
   - Sends `{"type": "response.create"}`
4. **Consume & Verify Output**:
   - Collects transcript text from `response.output_audio_transcript.delta` (`delta`) and `response.output_audio_transcript.done` (`transcript`).
   - Counts base64 audio payload characters from `response.output_audio.delta` (`delta`).
   - Fails immediately on any `error` event or if `response.done` reports `response.status != "completed"`.
   - Requires both a non-empty transcript and `audio_base64_characters > 0` before exiting `0`.
