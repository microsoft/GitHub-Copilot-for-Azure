# Hosted Voice YAML

Author a two-agent Hosted Voice definition after applying [common invariants](voice-agent-common.md) and the [Bridge `1.0` contract](voice-agent-hosted-bridge.md).

## Ownership

| Service | Owns |
|---|---|
| `kind: hosted` target | Model calls, instructions, tools, bounded history, Bridge callbacks |
| `kind: voice` wrapper | Audio, VAD, transcription, synthesis, greeting, managed Voice endpoint |

## Minimal Shape

```yaml
services:
  travel-target:
    project: src/travel-target
    host: azure.ai.agent
    uses: [ai-project]
    kind: hosted
    name: travel-target
    language: python
    codeConfiguration:
      entryPoint: main.py
      runtime: python_3_13
    env:
      AZURE_AI_MODEL_DEPLOYMENT_NAME: ${AZURE_AI_MODEL_DEPLOYMENT_NAME}
    protocols:
      - protocol: invocations_ws
        version: 1.0.0
    metadata:
      voiceLiveCompatible: "true"
      bridgeProtocolVersion: "1.0"

  travel-voice:
    host: azure.ai.agent
    uses: [ai-project, travel-target]
    kind: voice
    name: travel-voice
    conversationEngine:
      type: hosted_agent
      name: travel-target
    greeting:
      type: template
      text: Hello! How can I help?
    outputModalities: [audio]
    store: false
```

The wrapper must omit target-owned fields such as `model`, `modelType`, `instructions`, `tools`, `protocols`, `codeConfiguration`, environment settings, and session policies.

Add explicit `audio` configuration only when the user requires non-default format, voice, transcription, VAD, noise reduction, or echo cancellation. Keep target and wrapper names distinct and deploy the target before or together with the wrapper.
