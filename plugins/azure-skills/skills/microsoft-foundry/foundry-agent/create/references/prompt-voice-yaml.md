# Prompt Voice YAML

Author a single managed Voice Agent after applying [common invariants](voice-agent-common.md).

## Managed Real-Time Model

`modelType: managed` uses the service-hosted model and does not require a project deployment:

```yaml
services:
  support-voice:
    host: azure.ai.agent
    uses: [ai-project]
    kind: prompt-voice
    name: support-voice
    modelType: managed
    model:
      id: gpt-realtime
    instructions: Respond naturally and concisely.
    voice: en-US-AvaNeural
    store: false
```

## Project Model Deployment

`modelType: self_deployed` references a verified deployment name. Foundry infers native speech-to-speech versus cascaded STT -> LLM -> TTS from `model.id`.

```yaml
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
    host: azure.ai.agent
    uses: [ai-project]
    kind: prompt-voice
    name: advisor-voice
    modelType: self_deployed
    model:
      id: gpt-4o-mini
    instructions: Respond naturally and concisely.
    voice: en-US-AvaNeural
    store: false
```

For an existing project deployment, omit a new `deployments` entry and use its exact deployment name.

## Optional Configuration

Prompt Voice may configure `audio`, `greeting`, `outputModalities`, `tools`, `handoff`, `structuredInputs`, `telephony`, and output limits directly on the service. Do not set `parallelToolCalls: true`; current azd validation rejects it.

Common defaults are PCM at 24 kHz, Azure Speech transcription, server VAD, audio output, and `en-US-AvaNeural`. Override only when requested or required by an existing definition.
