# Azure AI Speech SDK analyzer regressions

These deterministic tests exercise the bundled native Speech SDK log analyzer
(`plugins/azure-skills/skills/azure-ai/scripts/analyze-speech-sdk-log.mjs`) with
synthetic captures. No Azure sign-in, network, audio, customer log or credential
is used, and the analyzer never writes to its input.

They check evidence boundaries, not service behavior: unknown formats and
versions stay unknown, IDs are typed and never borrowed by thread or time
proximity, absent features are not reported as disabled, and transcript text,
keys and unknown properties are not emitted. They do not establish behavior on
real logs from other SDK versions, other bindings or the JavaScript SDK.

`speech-sdk.test.ts` is a Vitest suite that runs against the built plugin
output, so build first. From the repository root, after installing dependencies:

```bash
npm run build
npm --prefix tests test -- azure-skills/azure-ai/speech-sdk.test.ts
```

To test the source file without building, point `SPEECH_ANALYZER_PATH` at it:

```powershell
$env:SPEECH_ANALYZER_PATH = (Resolve-Path plugins\azure-skills\skills\azure-ai\scripts\analyze-speech-sdk-log.mjs).Path
npm --prefix tests test -- azure-skills/azure-ai/speech-sdk.test.ts
```

```bash
SPEECH_ANALYZER_PATH="$PWD/plugins/azure-skills/skills/azure-ai/scripts/analyze-speech-sdk-log.mjs" \
  npm --prefix tests test -- azure-skills/azure-ai/speech-sdk.test.ts
```

## Offline preflight suites

Additional deterministic Vitest suites exercise the bundled `azure-ai` offline
inspectors under `plugins/azure-skills/skills/azure-ai/scripts/` using
synthetic inputs only (no Azure sign-in, network, customer data or
credentials):

- `speech-audio.test.ts` — `inspect-speech-audio.mjs` (`SPEECH_AUDIO_INSPECTOR_PATH`)

Build first so `output/azure-skills/skills/azure-ai/scripts/` is up to date, then
run all suites from the repository root:

```bash
npm run build
npm --prefix tests test -- azure-skills/azure-ai/
```
