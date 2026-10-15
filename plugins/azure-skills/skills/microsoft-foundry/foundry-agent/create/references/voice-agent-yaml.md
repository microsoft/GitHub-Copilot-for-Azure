# Voice Agent `azure.yaml` Reference

Canonical `azure.yaml` service shapes, configuration fields, and validation rules for Microsoft Foundry Voice Agents (`kind: voice` or CLI alias `kind: prompt-voice`).

## Schema Invariants

1. **Direct service-level properties (no `config:` wrapper)**:
   - Every Voice Agent service sits under `services.<service-key>` with `host: azure.ai.agent` and `kind: voice` (`kind: prompt-voice` is accepted for compatibility and written by `azd ai agent init --kind prompt-voice`).
   - Agent fields (`kind`, `name`, `modelType`, `model`, `conversationEngine`, `instructions`, `voice`, `audio`, `greeting`, `store`, `outputModalities`, `telephony`, etc.) are placed **directly under the service block**, never nested under a `config:` block (`config:` is deprecated and rejected).
   - Project model deployments live under `services.<project-service>.deployments:` (not `models:`).
2. **Engine selection (mutually exclusive)**:
   - **Prompt Voice** sets `modelType: managed` (default when omitted) or `modelType: self_deployed` **and** `model: { id: <model-or-deployment-name> }`.
   - **Hosted Voice wrapper** sets `conversationEngine: { type: hosted_agent, name: <hosted-target-service-name> }` and **must omit** `model`, `modelType`, `targetAgent`, `inputSchema`, `outputSchema`, `codeConfiguration`, `sessionConfiguration`, `environmentVariables`, `policies`, `protocols`, `instructions`, `structuredInputs`, `tools`, `toolChoice`, `parallelToolCalls`, `maxOutputTokens`, `include`, `handoff`, and `toolbox`.
   - Setting **both** `modelType`/`model` and `conversationEngine` is invalid.
   - Setting **neither** `model` nor `conversationEngine` is incomplete.
3. **Deprecated / unsupported fields (never use)**:
   - Do **not** use `modelType: hosted_agent`, `targetAgent`, or a nested `config:` block. Always use `conversationEngine: { type: hosted_agent, name: <target-service-name> }`.
   - Do **not** set `parallelToolCalls: true` on Prompt Voice agents (`parallelToolCalls` is currently rejected by `azd` runtime validation).
4. **Native vs cascaded speech (Prompt Voice)**:
   - There is no separate `cascade` YAML mode. Foundry infers native speech-to-speech vs cascaded speech (`STT -> LLM -> TTS`) from `model.id` (real-time speech models such as `gpt-realtime` vs text/chat deployments such as `gpt-4o-mini`).
5. **Privacy default**:
   - Default `store: false` unless the user explicitly opts in to storing transcripts/audio and confirms retention settings.

---

## 1. Prompt Voice — Managed Model (`modelType: managed`)

Uses a Voice Live-hosted real-time model (`gpt-realtime`). No model deployment entry is required under `services.ai-project.deployments`.

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/Azure/azure-dev/main/schemas/v1.0/azure.yaml.json

name: support-voice-app
services:
  ai-project:
    host: azure.ai.project
    deployments: []

  support-voice:
    project: src/support-voice
    host: azure.ai.agent
    uses:
      - ai-project
    kind: prompt-voice
    name: support-voice
    description: Declarative (managed) voice speech-to-speech agent
    modelType: managed
    model:
      id: gpt-realtime
    instructions: You are a helpful voice assistant. Respond naturally and concisely.
    voice: en-US-Ava:DragonHDLatestNeural
    store: false
infra:
  provider: microsoft.foundry
```

---

## 2. Prompt Voice — Project Model Deployment (`modelType: self_deployed`)

Uses a model deployment declared in `services.ai-project.deployments` (or already deployed in the target Foundry project). Foundry automatically runs native speech-to-speech when `model.id` points to a real-time speech deployment, or cascaded speech (`STT -> LLM -> TTS`) when `model.id` points to a text/chat deployment.

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/Azure/azure-dev/main/schemas/v1.0/azure.yaml.json

name: voice-cascaded-app
services:
  ai-project:
    host: azure.ai.project
    deployments:
      - name: gpt-4o-mini
        model:
          format: OpenAI
          name: gpt-4o-mini
          version: "2024-07-18"
        sku:
          name: GlobalStandard
          capacity: 50

  advisor-voice:
    project: src/advisor-voice
    host: azure.ai.agent
    uses:
      - ai-project
    description: Cascaded voice agent using a self-deployed text model
    kind: prompt-voice
    model:
      id: gpt-4o-mini
    modelType: self_deployed
    name: advisor-voice
    instructions: You are a helpful voice assistant. Respond naturally and concisely.
    voice: en-US-AvaNeural
    store: false
infra:
  provider: microsoft.foundry
```

---

## 3. Hosted Voice — Two-Agent Architecture (`kind: hosted` + `kind: voice`)

Hosted Voice requires **two distinct services** with **different service keys** and **different `name` values**:
1. **Target service (`kind: hosted`)**: Runs custom code/container over `invocations_ws` `1.0.0` with `metadata.voiceLiveCompatible: "true"` and `metadata.bridgeProtocolVersion: "1.0"`. Owns model inference, conversation state, tools, and Bridge `1.0` callbacks.
2. **Wrapper service (`kind: voice`)**: Connects to the target via `conversationEngine: { type: hosted_agent, name: <target-service-name> }`. Owns audio I/O, VAD, transcription, synthesis, greeting, and the managed `voice` WebSocket endpoint.

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/Azure/azure-dev/main/schemas/v1.0/azure.yaml.json

requiredVersions:
  azd: '>=1.32.0'
  extensions:
    azure.ai.agents: '>=1.0.0-beta.13'
name: voice-live-bridge-basic-python
services:
  ai-project:
    host: azure.ai.project
    deployments: []

  voice-live-bridge-basic-python:
    project: src/voice-live-bridge-basic-python
    host: azure.ai.agent
    language: python
    uses:
      - ai-project
    env:
      AZURE_AI_MODEL_DEPLOYMENT_NAME: ${AZURE_AI_MODEL_DEPLOYMENT_NAME}
      AZURE_OPENAI_MAX_OUTPUT_TOKENS: "512"
    codeConfiguration:
      entryPoint: main.py
      runtime: python_3_13
    container:
      resources:
        cpu: "1"
        memory: 2Gi
    description: A hosted text agent that implements Voice Live Bridge Protocol 1.0 with typed AgentServer callbacks and streams text from a Foundry model through the Responses API.
    displayName: Voice Live Bridge — Basic Python
    kind: hosted
    metadata:
      bridgeProtocolVersion: "1.0"
      voiceLiveCompatible: "true"
    name: voice-live-bridge-basic-python
    protocols:
      - protocol: invocations_ws
        version: 1.0.0

  voice-live-bridge-basic-python-voice:
    host: azure.ai.agent
    uses:
      - ai-project
      - voice-live-bridge-basic-python
    audio:
      input:
        format:
          rate: 24000
          type: audio/pcm
        transcription:
          model: azure-speech
        turnDetection:
          prefixPaddingMs: 300
          silenceDurationMs: 500
          threshold: 0.5
          type: server_vad
      output:
        format:
          rate: 24000
          type: audio/pcm
        voice:
          name: en-US-AvaNeural
          type: azure-standard
    conversationEngine:
      name: voice-live-bridge-basic-python
      type: hosted_agent
    greeting:
      text: Hello! How can I help you today?
      type: template
    kind: voice
    name: voice-live-bridge-basic-python-voice
    outputModalities:
      - audio
    store: false
infra:
  provider: microsoft.foundry
```

---

## Voice Service Schema Fields (`azure.ai.agent.json`)

| Field | Supported Shape / Values | Notes |
|---|---|---|
| `kind` | `voice` or `prompt-voice` | `azd` maps `prompt-voice` to service kind `voice` at deployment time. |
| `modelType` | `managed` (default) or `self_deployed` | Omit on Hosted Voice wrappers (`conversationEngine` is used instead). |
| `model` | `{ id: <model-or-deployment-name> }` | Required for Prompt Voice (`managed` or `self_deployed`); forbidden on Hosted Voice wrappers. |
| `conversationEngine` | `{ type: hosted_agent, name: <target-service>, version: deployed }` | Required for Hosted Voice wrappers (`version` defaults to `deployed`). |
| `voice` | String shorthand (e.g., `en-US-Ava:DragonHDLatestNeural`, `en-US-AvaNeural`, or `alloy`) | Top-level voice shorthand on Prompt Voice; `azd` maps OpenAI voices to `type: openai` and Azure locales to `type: azure-standard`. |
| `audio.input` | `format: { type: audio/pcm \| audio/pcmu \| audio/pcma, rate: 24000 }`, `transcription: { model: azure-speech, language }`, `turnDetection: { type: server_vad \| semantic_vad \| azure_semantic_vad, threshold, prefixPaddingMs, silenceDurationMs, speechDurationMs, interruptResponse, autoTruncate, createResponse, removeFillerWords, eagerness, languages }`, `noiseReduction: { type: near_field \| far_field \| azure_deep_noise_suppression }`, `echoCancellation` | Omitted fields inherit `azd` defaults (`audio/pcm` at `24000` Hz, `server_vad`, `azure-speech`). Note `threshold` must be `> 0` and `<= 1`. |
| `audio.output` | `format: { type: audio/pcm \| audio/pcmu \| audio/pcma, rate: 24000 }`, `voice: { type: azure-standard \| azure_standard \| openai, name, style, pitch, rate, locale, volume }`, `speed` (`0.25`–`1.5`) | Full output audio and voice configuration object. |
| `greeting` | `{ type: template, text: "Hello! How can I help you today?" }` or `llm_generated` | Spoken automatically when a Voice session starts. |
| `outputModalities` | Array of strings (well-known values: `audio`, `text`, `animation`, `avatar`) | Defaults to `["audio"]`. |
| `store` | `false` (default) or `true` | Server-side transcript and per-turn audio logging toggle. |
| `telephony` | `{ bindings: [{ provider: acs \| twilio, identifier: <id>, connection: <connection-name>, transferTargets: [...] }] }` | Phone-number bindings (`acs` uses `28:orgid:<guid>` or `4:+<E.164>`; `twilio` uses `+<E.164>`). |
| `structuredInputs`, `tools`, `toolChoice`, `maxOutputTokens`, `include`, `avatar`, `handoff` | Prompt Voice optional objects/arrays (`maxOutputTokens`: integer `1..2147483647` or `"inf"`) | Supported on Prompt Voice; `structuredInputs`, `tools`, `toolChoice`, `maxOutputTokens`, `include`, and `handoff` are forbidden on Hosted Voice wrappers. |

