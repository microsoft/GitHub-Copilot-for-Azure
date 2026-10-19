# Create a Microsoft Foundry Voice Agent

Create, configure, or extend a Microsoft Foundry Voice Agent:

- **Prompt Voice**: one managed Voice Agent using `modelType: managed` or `self_deployed`.
- **Hosted Voice**: a `kind: hosted` target paired with a managed `kind: voice` wrapper.

For a custom Hosted WebSocket agent with developer-defined frames and no managed Voice wrapper, use [invocations-ws](../invocations-ws/invocations-ws.md), not this workflow.

## Quick Reference

| Decision | Prompt Voice | Hosted Voice |
|---|---|---|
| Foundry agents | One `kind: voice` service | One `kind: hosted` target plus one `kind: voice` wrapper |
| Reasoning and tools | Voice service | Hosted target |
| Audio, VAD, TTS, greeting | Voice service | Voice wrapper |
| Local runtime | None | Target-only Bridge validation |
| End-to-end invocation | Managed `voice` WebSocket | Managed `voice` WebSocket on the wrapper |

## Step 1: Prerequisite and Context Resolution

Before authoring files or running azd:

1. From the `foundry-agent/create` directory, run the paired preflight scripts:

   ```bash
   ./scripts/check-copilot-app-entry.sh
   ./scripts/verify-environment.sh
   ```

   ```powershell
   .\scripts\check-copilot-app-entry.ps1
   .\scripts\verify-environment.ps1
   ```

   Resolve every `[ACTION]` before continuing. Never run `az login` or `azd auth login` for the user.

2. Read [Foundry azd guidance](../azd-guidance/azd-guidance.md) before any azd command.

   Commands below use the repository's neutral `azd ...` form. Execute every azd invocation with the user agent set inline:

   ```bash
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd <arguments>
   ```

   ```powershell
   $env:AZURE_DEV_USER_AGENT = "microsoft_foundry_skill"
   azd <arguments>
   ```

   Do not persist `AZURE_DEV_USER_AGENT` with `azd env set`, `.env`, or `azure.yaml`.

3. Follow [Common Project Context Resolution](../../SKILL.md#agent-common-project-context-resolution):
   - Inspect `azure.yaml` and `azd env get-values` when an azd project exists.
   - Classify existing services before selecting a target. Do not convert an existing Prompt, Hosted, Managed Harness, or Voice Agent into another type.
   - If multiple services exist, ask which Voice wrapper or Prompt Voice service to modify. Selecting a Hosted Voice wrapper also selects its `conversationEngine.name` target as a deployment dependency.
   - Resolve an existing project endpoint to its ARM ID with `scripts/resolve-project-id.sh` or `scripts/resolve-project-id.ps1`; never construct the ARM ID from the endpoint.

## Step 2: Model-First Decision and Collected-Values Checkpoint

Before generating `azure.yaml`, scaffolding code, or running init, determine the conversation engine and model strategy from the request and existing project context.

For a generic greenfield request to create a Voice Agent, proceed with **Prompt Voice using the managed real-time model** without requiring a subtype question. State these defaults before authoring:

- `modelType: managed`
- `model.id: gpt-realtime`
- canonical authored `kind: voice`
- `store: false`

Explicit user choices override these defaults. Ask only when an unresolved requirement materially changes the architecture:

- custom code, an existing Hosted Agent, or explicit Hosted Voice intent;
- BYOM, `self_deployed`, or an existing project model deployment;
- an existing project or codebase whose services imply a subtype but do not identify the target clearly;
- a planning, explanation, or comparison request that explicitly asks to evaluate the available approaches.

For planning or comparison, explain Prompt Voice managed, Prompt Voice self-deployed, Hosted Voice, and custom raw `invocations_ws` without creating files or running azd.

Detect explicit advanced settings in the request or existing Voice service, including structured inputs, audio format, transcription, VAD/turn detection, noise/echo processing, output voice controls, greeting/avatar, tools, handoff, response options, storage, or telephony. Do not ask an advanced-settings questionnaire when none are requested.

Resolve values from the request, workspace, `azure.yaml`, and active azd environment before asking. Do not author files until this checkpoint is complete:

| Value | Resolution rule |
|---|---|
| Voice subtype | Default a generic greenfield request to managed Prompt Voice; ask only for the architecture-changing cases above |
| Agent name | Reuse the selected service name; otherwise collect or derive a concise name |
| Foundry project | Confirm new versus existing; never provision implicitly |
| Existing project identity | Resolve both endpoint and ARM ID; pass the ARM ID to `--project-id` |
| azd environment | Reuse the selected environment or collect the intended environment |
| Model strategy | Default generic creation to managed `gpt-realtime`; ask when BYOM, self-deployed, or an existing deployment is intended |
| Model/deployment name | Default managed Prompt Voice to `gpt-realtime`; inspect or ask for self-deployed/Hosted target models |
| Instructions | Preserve existing instructions or collect the requested behavior |
| Output voice | Preserve an existing value or use the user's requested voice; otherwise omit it and use the azd default |
| Storage | Default to `store: false`; enabling storage requires an explicit privacy and retention decision |

State every applied default clearly before authoring.

## Step 3: Load Only the Selected Authoring Reference

Always read [Voice Agent common invariants](references/voice-agent-common.md).

- For **Prompt Voice**, read [Prompt Voice YAML](references/voice-agent-prompt-yaml.md).
- For **Hosted Voice**, read [Hosted Voice YAML](references/hosted-voice-yaml.md) and [Hosted Voice Bridge `1.0`](references/voice-agent-hosted-bridge.md).
- Only when advanced customization is requested or existing settings must be preserved, read [Voice Agent advanced settings](references/voice-agent-settings.md).

Do not load the other subtype's YAML reference unless the user asks for a comparison or migration.

Before editing advanced settings, map every requested field to the Prompt Voice service, Hosted Voice wrapper, or Hosted target using the advanced-settings ownership table. Preserve all unrelated existing advanced fields and edit only the requested YAML paths.

## Step 4: Initialize or Update

### Prompt Voice

For a new project:

```bash
azd ai agent init --no-prompt \
  --kind prompt-voice \
  --agent-name "<agent-name>" \
  --model "<model-name>"
```

For an existing Foundry project:

```bash
azd ai agent init --no-prompt \
  --kind prompt-voice \
  --agent-name "<agent-name>" \
  --project-id "<project-arm-id>" \
  --model "<model-name>"
```

Add `--voice "<voice-name>"` only when the user explicitly requests a voice. Otherwise allow azd to apply its default. `--kind prompt-voice` does not accept Hosted/runtime flags or `--model-deployment`. For self-deployed Prompt Voice, initialize the project, then edit the generated service to reference the verified deployment as documented in [Prompt Voice YAML](references/voice-agent-prompt-yaml.md).

Immediately after init, normalize the generated service to canonical `kind: voice` if azd wrote `kind: prompt-voice`, alongside the other generated-YAML edits.

For an existing Prompt Voice service, edit `azure.yaml` in place. Do not rerun init and create a suffixed duplicate.

### Hosted Voice

Use the official Hosted Voice manifest when starting from the sample:

```bash
azd ai agent init --no-prompt \
  -m "https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/bring-your-own/voice-agent-target-agent/basic/azure.yaml"
```

Add `--project-id "<project-arm-id>"` when using an existing project. For existing target code, preserve the target service and add or update the wrapper using [Hosted Voice YAML](references/hosted-voice-yaml.md); do not replace it with a Prompt Voice definition.

After init, enter the generated project directory before setting subscription, region, project name, endpoint, or model values. Do not chain `azd env set` to the init command.

## Step 5: Local Validation

- **Prompt Voice** has no local container. Continue to deploy.
- **Hosted Voice** must validate the target's Bridge handler locally before deployment. Follow [local run](references/local-run.md) and [Hosted Voice Bridge `1.0`](references/voice-agent-hosted-bridge.md). Target-only validation does not replace an end-to-end wrapper smoke test.

## Step 6: Deploy and Verify

Follow [deploy](../deploy/deploy.md), then [invoke](../invoke/invoke.md).

Voice services do not support `azd ai agent invoke`. Use the two-stage process in [Voice smoke testing](references/voice-agent-smoke-test.md):

1. Run the automated managed Voice WebSocket smoke test as the technical deployment gate.
2. From `azd ai agent show --output json`, provide the Voice Agent Playground URL and recommend that the user complete manual audio-to-audio experience validation in the Foundry portal.

Run the helper from the `microsoft-foundry` skill root:

```bash
./foundry-agent/create/scripts/smoke-test-voice.sh \
  --endpoint "$AZURE_AI_PROJECT_ENDPOINT" \
  --agent-name "<voice-agent-name>" \
  --text "Hello, briefly introduce yourself." \
  --timeout 180
```

```powershell
.\foundry-agent\create\scripts\smoke-test-voice.ps1 `
  -Endpoint $env:AZURE_AI_PROJECT_ENDPOINT `
  -AgentName "<voice-agent-name>" `
  -Text "Hello, briefly introduce yourself." `
  -Timeout 180
```

The final handoff must distinguish the results: report whether automated technical verification passed, provide the Playground URL, and explain that microphone, STT quality, VAD/turn-taking, interruption, playback/voice quality, browser/device behavior, and perceived latency remain a manual portal acceptance step. Do not claim that manual validation was completed automatically.

## Error Handling

| Error | Resolution |
|---|---|
| Project choice is unresolved | Stop and ask for a new or existing project before init or provision |
| Existing endpoint has no ARM ID | Resolve it with the paired `resolve-project-id` script |
| Init would duplicate an existing service | Edit the existing Voice service in place |
| Prompt Voice model deployment is missing | Inspect project deployments or ask before authoring `model.id` |
| Hosted Voice target fails locally | Fix the Bridge handler before deploying the wrapper |
| `azd ai agent invoke` rejects Voice | Use the managed `voice` WebSocket helper or Foundry Voice playground |
