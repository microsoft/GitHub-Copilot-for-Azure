# Copilot SDK Reference

`@github/copilot-sdk` embeds Copilot's agent runtime in your app via JSON-RPC to the Copilot CLI.

## Quick Start

Run `azd init --template jongio/copilot-sdk-agent`, then `pnpm install` in each service directory (`src/api`, `src/web`).

The template gives you a two-service app: Express API + React web UI, with Azure infra, all ready to deploy.

## Template Customization

The template's chat UI is just an example. Read the scaffolded source code (especially `AGENTS.md`) and adapt it to the user's scenario:

1. **Build a custom UI** in `src/web/` that fits the use case — most scenarios are NOT chat
2. **Adapt the API** in `src/api/` — update routes, `systemMessage`, and `defineTool()` calls for the user's domain
3. **Keep template infra** — do NOT regenerate Dockerfile, Bicep, or `azure.yaml`

The template source code already demonstrates `session.on()`, SSE streaming, `defineTool()`, error handling, and Express setup — read it before writing new code.

## Testing

The template includes a React web UI in `src/web/`. Run `azd app run` to test locally. When building a custom UI, adapt `src/web/` — don't create separate test pages.

## BYOK (Bring Your Own Key)

Pass `provider: { type: "azure-openai", endpoint, apiKey, deploymentName }` to `createSession()`. Supported: `openai`, `azure-openai`, `anthropic`, `ollama`.

## Errors

| Error | Fix |
|-------|-----|
| `docker info` fails | Install Docker Desktop and start it |
| `gh auth token` fails | Run `gh auth login` then `gh auth refresh --scopes copilot` |
| `ECONNREFUSED` on JSON-RPC | Set `autoStart: true` or start CLI manually |
| `Model not available` | Check model name; for BYOK verify provider config |
| Session hangs on `sendAndWait` | Set `maxTurns` limit or add hook to break |
