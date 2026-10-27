# Voice Agent Common Invariants

Rules shared by voice-based prompt agents and voice agents with hosted conversation engines in `azure.yaml`.

## Classification

- Author and maintain Voice Agent services with canonical `kind: voice`.
- Silently recognize existing `kind: prompt-voice` manifests as Voice Agents for compatibility, and normalize them to `kind: voice` when editing.
- A **voice-based prompt agent** declares `model` with `modelType: managed` or `self_deployed`.
- A **voice agent with a hosted conversation engine** uses `conversationEngine` to name a distinct hosted service.
- A standalone `kind: hosted` service using raw `invocations_ws` is not a managed Voice Agent.

## Required Rules

1. Place Voice fields directly under `services.<service-key>`; never use a nested `config:` block.
2. Declare exactly one engine:
   - Voice-based prompt agent: `modelType` plus `model.id`.
   - Voice agent with a hosted conversation engine: `conversationEngine`.
3. Stop when both engines or neither engine are declared.
4. Never use obsolete `modelType: hosted_agent` or `targetAgent`.
5. Keep hosted conversation engine and voice agent service keys and `name` values distinct.
6. Preserve existing optional settings and omit optional fields the user did not request.

## Lifecycle Boundaries

- Deploy Voice services with azd.
- Do not invoke a Voice service with `azd ai agent invoke`.
- A voice-based prompt agent has no local container.
- Conversation-engine testing validates only its protocol handler; the voice agent still requires end-to-end testing over the managed `voice` WebSocket.

Load only the selected subtype reference:

- [Voice-based prompt agent YAML](voice-agent-prompt-yaml.md)
- [Voice agent with a hosted conversation engine YAML](hosted-voice-yaml.md)
