# Voice Agent Common Invariants

Rules shared by Prompt Voice and Hosted Voice services in `azure.yaml`.

## Classification

- Author and maintain Voice Agent services with canonical `kind: voice`.
- Silently recognize existing `kind: prompt-voice` manifests as Voice Agents for compatibility, and normalize them to `kind: voice` when editing.
- **Prompt Voice** declares `model` with `modelType: managed` or `self_deployed`.
- **Hosted Voice** declares `conversationEngine.type: hosted_agent` and names a distinct `kind: hosted` target.
- A standalone `kind: hosted` service using raw `invocations_ws` is not a managed Voice Agent.

## Required Rules

1. Place Voice fields directly under `services.<service-key>`; never use a nested `config:` block.
2. Declare exactly one engine:
   - Prompt Voice: `modelType` plus `model.id`.
   - Hosted Voice wrapper: `conversationEngine`.
3. Stop when both engines or neither engine are declared.
4. Never use obsolete `modelType: hosted_agent` or `targetAgent`.
5. Keep Hosted Voice target and wrapper service keys and `name` values distinct.
6. Omit `store` for generic new services and preserve any existing explicit value. Author it only for explicit retention intent.

## Lifecycle Boundaries

- Deploy Voice services with azd.
- Do not invoke a Voice service with `azd ai agent invoke`.
- Prompt Voice has no local container.
- Hosted Voice target testing validates only the Bridge target; the wrapper still requires end-to-end testing over the managed `voice` WebSocket.

Load only the selected subtype reference:

- [Prompt Voice YAML](voice-agent-prompt-yaml.md)
- [Hosted Voice YAML](hosted-voice-yaml.md)
