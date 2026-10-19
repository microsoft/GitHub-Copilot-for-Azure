# Voice Agent Advanced Settings

Load only for requested customization or preserving existing settings. Source: beta.20; advanced settings landed in beta.13. `azd ai agent init` exposes only model and simple voice; use `kind: voice` YAML for the rest.

## Ownership and Confidence

| Owner | Settings |
|---|---|
| Prompt Voice | Model/instructions, `structuredInputs`, audio, tools/`toolChoice`, `maxOutputTokens`, `include`, `handoff`, avatar, greeting, modalities, store, telephony |
| Hosted wrapper | Audio/voice, avatar, greeting, modalities, store |
| Hosted target | Model/instructions, tools and conversation logic |

**Typed/validated:** audio formats, turn detection, transcription, noise-reduction type, output voice/speed, modalities, max tokens, and Prompt Voice telephony. **Mapped/pass-through:** `structuredInputs` contents, tools/tool choice, greeting, avatar, handoff, echo cancellation, and include values. Preserve source-tested shapes; do not invent opaque fields.

Hosted wrappers forbid model, instructions, `structuredInputs`, tools/`toolChoice`, `parallelToolCalls`, `maxOutputTokens`, `include`, `handoff`, and target-owned runtime fields. `parallelToolCalls` is rejected everywhere. Telephony is verified for Prompt Voice only; do not author it on a Hosted wrapper without newer source proof.

## Verified YAML Paths

```yaml
structuredInputs:                 # Prompt Voice only
  persona:
    description: Assistant persona
    defaultValue: Ada             # maps to wire default_value

audio:
  input:
    format: { type: audio/pcm, rate: 24000 } # also audio/pcmu, audio/pcma; rate > 0
    noiseReduction: { type: near_field }      # also far_field, azure_deep_noise_suppression
    echoCancellation: { type: server_echo_cancellation, channels: 1 } # pass-through
    transcription:
      model: azure-speech         # default; language and prompt are optional
      language: en-US
      prompt: Contoso terms
    turnDetection:
      type: server_vad            # also semantic_vad, azure_semantic_vad
      threshold: 0.6              # > 0 and <= 1
      prefixPaddingMs: 300
      silenceDurationMs: 500
      createResponse: true
      eagerness: <service-supported-value> # pass-through string
      speechDurationMs: 120
      removeFillerWords: true
      interruptResponse: true
      languages: [en-US]
      autoTruncate: true
  output:
    format: { type: audio/pcm, rate: 24000 }
    voice:
      type: azure-standard           # or openai
      name: en-US-AvaNeural
      style: cheerful
      pitch: "+0Hz"
      rate: "+0%"
      locale: en-US
      volume: "+0%"
    speed: 1.1                    # 0.25–1.5
```

Defaults: PCM 24 kHz, `server_vad`, `azure-speech`, and `outputModalities: [audio]`. azd internally defaults to `en-US-Ava:DragonHDLatestNeural`; this skill explicitly authors `en-US-AvaNeural`.

## Other Supported Fields

```yaml
greeting: { type: template, text: "Hello {{persona}}" }
outputModalities: [audio, text]
avatar: { type: video_avatar, character: lisa, output_protocol: webrtc }
tools: [{ type: system, name: end_conversation }] # Prompt Voice only; service-owned shapes
toolChoice: auto
maxOutputTokens: inf              # or integer 1–2147483647
include: [item.input_audio_transcription.phrases]
store: false
telephony:                        # Prompt Voice only
  bindings:
    - provider: twilio            # or acs
      identifier: "+14255550123"  # ACS: 28:orgid:<guid> or 4:+<E.164>
      connection: telephony-twilio
```

`item.input_audio_transcription.phrases` requires `azure-speech` or `azure-fast-transcription`. For `handoff` or other opaque maps, preserve a verified existing/service sample shape.

After deployment, the smoke test remains the technical gate. Validate voice, VAD, STT, telephony, avatar, interruption, playback, device behavior, and perceived latency manually in the Foundry Voice Agent playground.
