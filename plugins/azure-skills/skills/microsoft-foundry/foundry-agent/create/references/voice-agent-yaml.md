# Voice Agent `azure.yaml` Reference

Canonical `azure.yaml` service shapes, configuration fields, and validation rules for Microsoft Foundry Voice Agents (`kind: voice` or CLI alias `kind: prompt-voice`).

## Schema Invariants

1. **Host and kind**:
   - Every Voice Agent service sits under `services:` with `host: azure.ai.agent` and `config.kind: voice` (`kind: prompt-voice` is accepted as an alias by `azd ai agent`).
2. **Engine selection (mutually exclusive)**:
   - **Prompt Voice** sets `modelType: managed` or `modelType: self_deployed` **and** `model: <model-or-deployment-name>`.
   - **Hosted Voice wrapper** sets `conversationEngine: { type: hosted_agent, name: <hosted-target-name> }` and omits `modelType`, `model`, and `instructions`.
   - Setting **both** `modelType`/`model` and `conversationEngine` is invalid.
   - Setting **neither** `modelType` nor `conversationEngine` is incomplete.
3. **Deprecated fields (never use)**:
   - Do **not** use `modelType: hosted_agent` or `targetAgent`. Always use `conversationEngine.type: hosted_agent` and `conversationEngine.name`.
4. **Native vs cascaded speech (Prompt Voice)**:
   - There is no separate `cascade` YAML mode. Foundry infers native speech-to-speech vs cascaded speech (`STT -> LLM -> TTS`) from `config.model` (real-time speech models such as `gpt-realtime` / `gpt-realtime-1.5` vs text/chat models such as `gpt-4.1-mini`).
5. **Privacy default**:
   - Default `store: false` unless the user explicitly opts in to storing transcripts/audio and confirms retention settings.

---

## 1. Prompt Voice — Managed Model (`modelType: managed`)

Uses a service-hosted real-time model (`gpt-realtime` or `gpt-realtime-1.5`). No model deployment entry is required under `services.ai-project.models`.

```yaml
name: support-voice-app
services:
  ai-project:
    host: azure.ai.project

  support-voice:
    host: azure.ai.agent
    uses:
      - ai-project
    config:
      name: support-voice
      kind: voice
      description: Real-time customer support voice agent
      modelType: managed
      model: gpt-realtime
      store: false
      instructions: >-
        You are a concise, helpful customer support voice assistant.
        Keep spoken responses natural and under two sentences unless asked for detail.
      greeting:
        type: pregenerated
        text: "Hello! How can I help you today?"
      turnDetection:
        type: semantic_vad
        interruptResponse: true
        autoTruncate: true
        createResponse: true
        eagerness: medium
      audio:
        input:
          format: pcm16
          sampleRate: 24000
          noiseSuppression:
            type: azure_deep_noise_suppression
          echoCancellation:
            type: server_echo_cancellation
        output:
          format: pcm16
          sampleRate: 24000
          voice:
            name: en-US-Ava:DragonHDLatestNeural
            type: azure-standard
      inputModalities:
        - audio
        - text
      outputModalities:
        - audio
        - text
```

---

## 2. Prompt Voice — Project Model Deployment (`modelType: self_deployed`)

Uses a model deployed in `services.ai-project.models`. Foundry automatically runs native speech-to-speech when `model` points to a real-time speech deployment, or cascaded speech (`STT -> LLM -> TTS`) when `model` points to a text/chat deployment.

```yaml
name: cascaded-voice-app
services:
  ai-project:
    host: azure.ai.project
    models:
      - name: gpt-4.1-mini
        model:
          name: gpt-4.1-mini
          format: OpenAI
          version: "2025-04-14"
        sku:
          name: GlobalStandard
          capacity: 50

  advisor-voice:
    host: azure.ai.agent
    uses:
      - ai-project
    config:
      name: advisor-voice
      kind: voice
      modelType: self_deployed
      model: gpt-4.1-mini
      store: false
      instructions: >-
        You are a financial policy voice assistant. Answer clearly and concisely.
      greeting:
        type: llm_generated
        prompt: "Greet the caller warmly and ask how you can help."
      turnDetection:
        type: semantic_vad
        interruptResponse: true
        createResponse: true
      audio:
        input:
          format: pcm16
          sampleRate: 24000
          transcription:
            model: azure-speech
            language: en-US
        output:
          format: pcm16
          sampleRate: 24000
          voice:
            name: en-US-Ava:DragonHDLatestNeural
            type: azure-standard
```

---

## 3. Hosted Voice — Two-Agent Architecture (`kind: hosted` + `kind: voice`)

Hosted Voice requires **two distinct services** with **different service keys** and **different `config.name` values**:
1. **Target service (`kind: hosted`)**: Runs custom code/container over `invocations_ws` `1.0.0` with `metadata.voiceLiveCompatible: "true"` and `bridgeProtocolVersion: "1.0"`. Owns `deployments`, reasoning, instructions, and tools.
2. **Wrapper service (`kind: voice`)**: Connects to the target via `conversationEngine: { type: hosted_agent, name: <target-name> }`. Owns audio I/O, greeting, turn detection, and the managed `voice` WebSocket endpoint.

```yaml
name: hosted-voice-app
services:
  ai-project:
    host: azure.ai.project
    models:
      - name: gpt-5.4-mini
        model:
          name: gpt-5.4-mini
          format: OpenAI
        sku:
          name: GlobalStandard
          capacity: 50

  travel-agent-target:
    project: ./src/travel-agent-target
    language: python
    host: azure.ai.agent
    uses:
      - ai-project
    config:
      name: travel-agent-target
      kind: hosted
      deployments:
        - gpt-5.4-mini
      container:
        resources:
          cpu: "1"
          memory: 2Gi
      protocols:
        - protocol: invocations_ws
          version: 1.0.0
      metadata:
        voiceLiveCompatible: "true"
        bridgeProtocolVersion: "1.0"

  travel-agent-voice:
    host: azure.ai.agent
    uses:
      - ai-project
      - travel-agent-target
    config:
      name: travel-agent-voice
      kind: voice
      store: false
      conversationEngine:
        type: hosted_agent
        name: travel-agent-target
      greeting:
        type: pregenerated
        text: "Welcome to Contoso Travel! Where would you like to go?"
      turnDetection:
        type: semantic_vad
        interruptResponse: true
        autoTruncate: true
        createResponse: true
      audio:
        input:
          format: pcm16
          sampleRate: 24000
          noiseSuppression:
            type: azure_deep_noise_suppression
          echoCancellation:
            type: server_echo_cancellation
        output:
          format: pcm16
          sampleRate: 24000
          voice:
            name: en-US-Ava:DragonHDLatestNeural
            type: azure-standard
      outputModalities:
        - audio
```

---

## Optional Voice Configuration Fields

| Section | Key Fields | Notes |
|---|---|---|
| `greeting` | `type: pregenerated` (`text`) or `type: llm_generated` (`prompt`) | Spoken automatically when a Voice session starts. |
| `turnDetection` | `type: semantic_vad` or `server_vad`, `interruptResponse`, `autoTruncate`, `createResponse`, `eagerness` | Controls barge-in/interruption and turn boundaries. |
| `audio.input` | `format: pcm16`, `sampleRate: 24000`, `noiseSuppression`, `echoCancellation`, `transcription` (`model`, `language`, `customSpeechModel`, `phraseList`) | Configures caller audio processing and speech recognition. |
| `audio.output` | `format: pcm16`, `sampleRate: 24000`, `voice` (`name`, `type`, `temperature`, `rate`, `endpointId`), `lexiconUrl` | Configures TTS output voice and prosody. |
| `avatar` | `character`, `style`, `customized`, `video` | Optional visual avatar stream configuration. |
| `tools` / `handoffs` | Declarative tool definitions and agent handoff targets | Used on Prompt Voice agents (`modelType: managed` or `self_deployed`). In Hosted Voice, tools live in the `kind: hosted` target code. |
| `structuredInputs` | Named key/value session inputs | Passed at session initialization for prompt templating. |
| `bindings` | Telephony bindings (`acs` or `twilio`) | Connects the Voice Agent to Azure Communication Services or Twilio telephony channels. |
