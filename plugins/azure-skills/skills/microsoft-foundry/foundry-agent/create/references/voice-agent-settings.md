# Voice Agent Advanced Settings

Load only for requested or preserved settings. Source beta.20 (introduced beta.13). Init exposes model/simple voice; edit `kind: voice` YAML for the rest.

## Ownership and Confidence

| Owner | Settings |
|---|---|
| Prompt Voice | Model/instructions, `structuredInputs`, audio, tools/`toolChoice`, `maxOutputTokens`, `include`, `handoff`, avatar, greeting, modalities, store, telephony |
| Hosted wrapper | Audio/voice, avatar, greeting, modalities, store |
| Hosted target | Model/instructions, tools and conversation logic |

**Typed/validated:** audio, turn detection, transcription, modalities, max tokens, and Prompt Voice telephony. **Pass-through:** structured-input contents, tools, greeting/avatar/handoff, echo cancellation, and include values. Preserve verified shapes.

Hosted wrappers forbid model, instructions, `structuredInputs`, tools/`toolChoice`, `parallelToolCalls`, `maxOutputTokens`, `include`, `handoff`, and target fields. `parallelToolCalls` is rejected. Telephony is verified only for Prompt Voice.

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
      name: en-US-Ava:DragonHDLatestNeural
      style: cheerful
      pitch: "+0Hz"
      rate: "+0%"
      locale: en-US
      volume: "+0%"
    speed: 1.1                    # 0.25–1.5
```

Defaults: PCM 24 kHz, `server_vad`, `azure-speech`, `[audio]`, and azd's output voice. Omit overrides unless requested.

## Other Supported Fields

```yaml
greeting: { type: template, text: "Hello {{persona}}" }
outputModalities: [audio, text]
avatar: { type: video_avatar, character: lisa, output_protocol: webrtc }
tools: [{ type: system, name: end_conversation }] # Prompt Voice only; service-owned shapes
toolChoice: auto
maxOutputTokens: inf              # or integer 1–2147483647
include: [item.input_audio_transcription.phrases]
telephony:                        # Prompt Voice only
  bindings:
    - provider: twilio            # or acs
      identifier: "+14255550123"  # ACS: 28:orgid:<guid> or 4:+<E.164>
      connection: telephony-twilio
```

Phrase inclusion requires `azure-speech` or `azure-fast-transcription`. Preserve verified shapes for `handoff` and other opaque maps.

`store` is optional privacy/operations config, not audio customization. Omitted defaults to `false`. Preserve explicit values; write `false` for requested no retention, or `true` after confirming transcript/per-turn audio retention intent.

After the smoke gate, validate voice, VAD, STT, telephony, avatar, interruption, playback, devices, and latency manually in the playground.
