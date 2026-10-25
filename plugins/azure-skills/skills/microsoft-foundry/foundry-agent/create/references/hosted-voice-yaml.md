# Voice Agent with a Hosted Conversation Engine YAML

Author a voice-based agent that uses a hosted text agent as its conversation engine. Apply [common invariants](voice-agent-common.md) and the [voice conversation engine contract and compatibility boundary](voice-conversation-engine.md).

## Ownership

| Service | Owns |
|---|---|
| Hosted conversation engine (`kind: hosted`) | Model calls, instructions, tools, bounded history, conversation-engine protocol handler |
| Managed voice agent (`kind: voice`) | Audio, VAD, transcription, synthesis, greeting, managed Voice endpoint |

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
```

The voice agent must omit engine-owned fields such as `model`, `modelType`, `instructions`, `tools`, `protocols`, `codeConfiguration`, environment settings, and session policies.

`conversationEngine.name` identifies the hosted service in this azd project. Its optional `version` defaults to `deployed`, selecting the version deployed by the current azd environment. This CLI value is not a literal SDK/API agent version: Python uses `VoiceHostedAgentConversationEngine(name=..., version=...)` under `conversation_engine` with an actual version, or omits `version` to select the latest at connection time. Keep the `hosted_agent` discriminator unchanged.

When requested voice settings require YAML edits, load [Voice Agent YAML settings](voice-agent-settings.md). Preserve unrelated existing fields, keep engine and voice agent names distinct, and deploy the engine before or together with the voice agent.
