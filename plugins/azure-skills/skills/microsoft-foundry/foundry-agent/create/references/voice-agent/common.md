# Voice Agent Common Invariants

Rules shared by GPT-Live, Prompt Voice, and Hosted Voice services in `azure.yaml`.

## Classification

- Author and maintain Voice Agent services with canonical `kind: voice`.
- Silently recognize existing `kind: prompt-voice` manifests as Voice Agents for compatibility, and normalize them to `kind: voice` when editing.
- Classify in this exact order:
  1. `subProtocol: live` -> **GPT-Live**.
  2. Otherwise, `conversationEngine.type: hosted_agent` -> **Hosted Voice**.
  3. Otherwise, `modelType: managed` or `self_deployed` -> **Prompt Voice**.
- GPT-Live is self-deployed, so checking `modelType` before `subProtocol` misclassifies it.
- A standalone `kind: hosted` service using raw `invocations_ws` is not a managed Voice Agent.

## Required Rules

1. Place Voice fields directly under `services.<service-key>`; never use a nested `config:` block.
2. Declare the selected subtype shape:
   - GPT-Live: `subProtocol: live`, `modelType: self_deployed`, and `model.id`.
   - Prompt Voice: `modelType` plus `model.id`.
   - Voice wrapper: `conversationEngine`.
3. Stop when GPT-Live also declares `conversationEngine` or Voice Live-only fields. For non-Live Voice, stop when both engines or neither engine are declared.
4. Never use obsolete `modelType: hosted_agent` or `targetAgent`.
5. Keep hosted target and Voice wrapper service keys and `name` values distinct.
6. Preserve existing optional settings and omit optional fields the user did not request. Do not write unused optional fields as `null`.

## Lifecycle Boundaries

- Deploy Voice services with azd.
- Do not invoke a Voice service with `azd ai agent invoke`.
- GPT-Live uses `/protocols/voice/live/sessions?api-version=v1`; never send it through the ordinary `/protocols/voice` helper.
- Prompt Voice has no local container.
- Hosted target testing validates only its Voice Live Bridge handler; the Voice wrapper still requires end-to-end testing over the managed `voice` WebSocket.

Load only the selected subtype reference:

- [GPT-Live YAML](gpt-live-yaml.md)
- [Prompt Voice YAML](prompt-voice-yaml.md)
- [Hosted Voice YAML](hosted-voice-yaml.md)
