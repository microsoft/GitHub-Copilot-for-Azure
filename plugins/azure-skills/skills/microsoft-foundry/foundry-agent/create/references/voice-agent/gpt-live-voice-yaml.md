# GPT-Live Voice YAML

Author GPT-Live Voice after selecting it with [Voice Agent subtypes](subtypes.md) and applying [common invariants](common.md). It is not a Prompt Voice setting and does not use a Hosted Voice Bridge.

## Canonical Minimal Shape

Author the complete service directly; there is no `azd ai agent init --kind gpt-live`, and a Prompt Voice scaffold must not be converted into GPT-Live Voice.

```yaml
services:
  live-assistant:
    host: azure.ai.agent
    uses: [ai-project]
    kind: voice
    name: live-assistant
    subProtocol: live
    modelType: self_deployed
    model:
      id: gpt-live-1
```

`model.id` must name an existing compatible GPT-Live model deployment. The model and any requested delegation backend deployment or managed agent must already exist. Do not assume the Prompt Voice `deployments[]` plus `azd provision` Golden Path applies; verify deployment ownership and lifecycle separately before changing infrastructure.

## Optional Settings and Known Values

Preserve unrelated existing fields and omit unused optional fields rather than writing `null`.

```yaml
instructions: Respond naturally and concisely.
store: false
audio:
  format: { type: audio/pcm, rate: 24000 }
  output:
    voice: marin
greeting: { type: template, text: "Hello {{name}}" }
structuredInputs:
  name:
    description: Caller name
    schema: { type: string }
    required: false
    defaultValue: Ada
policies:
  - type: rai_policy
    raiPolicyName: <rai-policy-resource-id>
```

| Setting | Supported shape |
|---|---|
| `audio.format` | `audio/pcm` at `16000` or `24000`; `audio/pcmu` or `audio/pcma` at `8000` |
| `audio.output.voice` | Nonblank built-in voice string, or `{ id: <custom-voice-id> }` only |
| `instructions` / `store` | String / boolean |
| `greeting` | Exactly `type: template` plus nonblank `text` |
| `structuredInputs.<name>` | Optional `description` string, `schema` object, `required` boolean, and `defaultValue` |
| `policies` | At most one named `rai_policy` with full-resource-ID `raiPolicyName`; no `invocationsModeration` |

## Delegation

```yaml
delegation: { type: client }
```

```yaml
delegation:
  type: responses
  responses:
    model: <existing-responses-deployment>
    instructions: Return concise backend guidance.
```

```yaml
delegation:
  type: foundry_managed_agent
  agentName: <existing-agent-name>
  agentVersion: "<positive-version>"
```

- `client` supports only `type`.
- `responses` requires `responses.model` and must omit `agentName`/`agentVersion`.
- `foundry_managed_agent` requires `agentName`, may include a positive numeric-string `agentVersion`, and must omit `responses`.

| `responses` option | Supported shape |
|---|---|
| `instructions` | String |
| `maxOutputTokens` / `parallelToolCalls` | Positive integer / boolean |
| `serviceTier` | `auto`, `default`, `fast_tier_temp_pilot`, `flex`, `priority`, or `ultrafast` |
| `reasoning` | `effort`: `none|minimal|low|medium|high|xhigh`; `summary`: `concise|detailed|auto` |
| `text.verbosity` | `low`, `medium`, or `high` |
| `toolChoice` | `auto|none|required`; named `function`; or named `mcp` with `serverLabel` |
| `tools` | `{ type: web_search }`, or function with name, optional description, parameters object, and optional boolean `strict` |

## Constraints and Forbidden Fields

Forbidden or discriminator-incompatible fields are rejected even when empty or `null`. Do not author `audio.input` transcription/VAD/noise reduction/echo cancellation, `audio.output.format`/`speed`, `conversationEngine`, `targetAgent`, root `voice`, input/output schemas, output modalities, root tools/tool choice/output-token settings, avatar, handoff, include, or telephony.
