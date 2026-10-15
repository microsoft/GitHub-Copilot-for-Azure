# Hosted Voice Bridge `1.0` Reference

Architecture and WebSocket protocol contract for **Hosted Voice Agents**, which pair a custom `kind: hosted` target agent with a managed `kind: voice` wrapper agent.

## Two-Agent Ownership Model

| Concern | `kind: hosted` Target Agent | `kind: voice` Wrapper Agent |
|---|---|---|
| **Role** | Reasoning, tools, orchestration, model calls | Audio pipeline (VAD, STT, TTS, noise/echo cancellation), greeting, managed `voice` WebSocket endpoint |
| **Protocol** | `invocations_ws` (`version: 1.0.0`) + Voice Live Bridge `1.0` JSON events | Foundry `voice` protocol (`?api-version=v1`) |
| **Required metadata / link** | `metadata: { voiceLiveCompatible: "true", bridgeProtocolVersion: "1.0" }` | `uses: [ai-project, <target>]` and `conversationEngine: { type: hosted_agent, name: <target> }` |
| **Model & instructions** | Configured in target (`deployments:` + container code) | **Omitted** on wrapper |
| **Agent name** | Distinct `<target-name>` | Distinct `<wrapper-name>` |

---

## Voice Live Bridge `1.0` Event Flow

The `kind: voice` wrapper connects to the `kind: hosted` target over `invocations_ws` (`ws://localhost:8088/invocations` in the container) and exchanges JSON text/control events conforming to `bridgeProtocolVersion: "1.0"`. The target container **never** processes raw audio frames when used through the Voice wrapper — the wrapper handles audio transcription and speech synthesis.

```
Voice Wrapper (`kind: voice`)                    Hosted Target (`kind: hosted`)
            |                                                  |
            |--- 1. session.Initialize ----------------------->|
            |<-- 2. session.Initialized -----------------------|
            |                                                  |
            |--- 3. conversation.Message (user transcript) --->|
            |--- 4. response.Create -------------------------->|
            |<-- 5. response.TextDelta (streamed chunks) ------|
            |<-- 6. response.Done -----------------------------|
            |                                                  |
            |--- (on barge-in) conversation.Cancel ----------->|
```

### Inbound Events (Wrapper -> Target)

1. **`session.Initialize`**:
   Sent once after WebSocket upgrade to initialize session state and pass optional structured inputs or metadata.
   ```json
   {
     "type": "session.Initialize",
     "sessionId": "sess_01",
     " bridgeProtocolVersion": "1.0"
   }
   ```
   *(Target should inspect `"type": "session.Initialize"` and reply with `session.Initialized`.)*

2. **`conversation.Message`**:
   Delivers a user turn (transcribed speech or text input) to the target's conversation history.
   ```json
   {
     "type": "conversation.Message",
     "role": "user",
     "content": "What flights are available to Seattle tomorrow?"
   }
   ```

3. **`response.Create`**:
   Instructs the target to run its model/agent logic and stream back a response for the current conversation state.
   ```json
   {
     "type": "response.Create",
     "responseId": "resp_01"
   }
   ```

4. **`conversation.Cancel`**:
   Sent when the caller barges in / interrupts while a response is still streaming. The target should cancel in-flight generation for the active response.
   ```json
   {
     "type": "conversation.Cancel",
     "responseId": "resp_01"
   }
   ```

### Outbound Events (Target -> Wrapper)

1. **`session.Initialized`**:
   Acknowledges `session.Initialize`. Must be sent before turn processing begins.
   ```json
   {
     "type": "session.Initialized",
     "bridgeProtocolVersion": "1.0"
   }
   ```

2. **`response.TextDelta`**:
   Streams speakable text tokens/chunks back to the Voice wrapper for low-latency TTS synthesis.
   ```json
   {
     "type": "response.TextDelta",
     "responseId": "resp_01",
     "delta": "There are three direct flights to Seattle tomorrow morning."
   }
   ```

3. **`response.Done`**:
   Signals that the current response turn is complete.
   ```json
   {
     "type": "response.Done",
     "responseId": "resp_01"
   }
   ```

4. **`error`** (when an unrecoverable turn error occurs):
   ```json
   {
     "type": "error",
     "code": "target_execution_error",
     "message": "Failed to query flight inventory."
   }
   ```

---

## Diagnostic `/help` Sequence and Local Testing

Hosted Voice target templates support a deterministic `/help` diagnostic message over Bridge `1.0` so you can verify the target container before testing the full audio wrapper:

1. Start the target container locally on port `8088` (`ws://localhost:8088/invocations`).
2. Connect with a WebSocket client and send:
   - `{"type": "session.Initialize", "sessionId": "local-test"}` -> verify `{"type": "session.Initialized", ...}`
   - `{"type": "conversation.Message", "role": "user", "content": "/help"}`
   - `{"type": "response.Create", "responseId": "help-1"}`
3. Verify the target emits one or more `response.TextDelta` events followed by `response.Done`.

> **Important**: Testing the Hosted target directly over `invocations_ws` validates only the target's Bridge `1.0` handler. To validate the deployed Hosted Voice Agent end-to-end, you **must** also smoke-test the `kind: voice` wrapper over its `voice` protocol endpoint (see [voice-agent-smoke-test.md](voice-agent-smoke-test.md)).

---

## Common Hosted Voice Failure Modes

| Symptom / Error | Cause | Fix |
|---|---|---|
| `protocol_mismatch` during wrapper session start | Target `azure.yaml` is missing `protocols: [{ protocol: invocations_ws, version: 1.0.0 }]`, missing `metadata.voiceLiveCompatible: "true"` / `bridgeProtocolVersion: "1.0"`, or target code does not reply with `session.Initialized`. | Verify both `azure.yaml` metadata/protocols and the target's `session.Initialize` -> `session.Initialized` handshake. |
| Wrapper deploys, but connecting to `voice` endpoint fails immediately | `conversationEngine.name` in the `kind: voice` wrapper does not match the deployed `kind: hosted` target's `config.name`, or the target container is not running. | Match `conversationEngine.name` to the target's `config.name`, deploy the target first, and check target logs with `azd ai agent monitor`. |
| Wrapper and target overwrite each other in Foundry | Both services share the same `config.name` in `azure.yaml`. | Give the `kind: hosted` target and `kind: voice` wrapper distinct `config.name` values and distinct service keys. |
