# Prompt Voice YAML

Author a single managed Voice Agent after applying [common invariants](voice-agent-common.md).

## Managed Real-Time Model

`modelType: managed` uses the service-hosted model and does not require a project deployment:

```yaml
services:
  support-voice:
    host: azure.ai.agent
    uses: [ai-project]
    kind: voice
    name: support-voice
    modelType: managed
    model:
      id: gpt-realtime
    instructions: Respond naturally and concisely.
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
    kind: voice
    name: advisor-voice
    modelType: self_deployed
    model:
      id: gpt-4o-mini
    instructions: Respond naturally and concisely.
```

For an existing project deployment, omit a new `deployments` entry and use its exact deployment name.

## Optional Configuration

When requested settings require YAML edits, load [Voice Agent YAML settings](voice-agent-settings.md). Preserve unrelated existing fields and edit only requested paths.

Common defaults include PCM at 24 kHz, Azure Speech transcription, server VAD, and audio output. Omit `voice` unless requested or required by an existing definition so azd applies its default.
