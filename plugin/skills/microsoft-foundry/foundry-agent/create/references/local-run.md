# Local Run Reference

Use this when iterating on a hosted agent before deploying.

> **Prerequisite:** Local run does NOT require `azd provision` or any deployed Azure infrastructure. The agent runs on your machine and calls the Foundry model endpoint directly using your local credentials (`DefaultAzureCredential` — falls back to `az login` / VS Code identity). You only need a `.env` file in the agent source directory with:
> ```env
> FOUNDRY_PROJECT_ENDPOINT=https://<account>.services.ai.azure.com/api/projects/<project>
> AZURE_AI_MODEL_DEPLOYMENT_NAME=<model-deployment-name>
> ```
> If you already ran `azd provision`, extract these from `azd env get-values`.
>
> **Critical: keep `.env` and `azd env` in sync.** `azd ai agent run` injects the active `azd env` values into the agent process before Python loads `.env`. Many samples use `load_dotenv(override=False)`, so an existing process environment value wins over `.env`. If you change the project endpoint or model deployment, update both `.env` and `azd env`:
> ```bash
> azd env set FOUNDRY_PROJECT_ENDPOINT "https://<account>.services.ai.azure.com/api/projects/<project>"
> azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME "<model-deployment-name>"
> azd env get-values
> ```
> A stale `AZURE_AI_MODEL_DEPLOYMENT_NAME` in `azd env` can make local run call the wrong deployment even when `.env` is correct, commonly surfacing as a Foundry responses API `404 Not Found`.

## Start the agent locally

```bash
azd ai agent run
```

What this does:

1. Resolves the agent service from `azure.yaml` (auto-picks when only one exists).
2. Detects the project type (Python, .NET, Node.js) from files in the service source dir.
3. Installs dependencies if needed (`pip install -r requirements.txt`, `npm install`, `dotnet restore`).
4. Starts the agent in the foreground on `localhost:8088` (default).
5. Opens **Agent Inspector** in your browser (unless `--no-inspector`).

> First startup takes 30-60 seconds. Wait before sending the first invocation.

`Ctrl+C` stops the agent and clears the saved local session id.

## Useful flags

| Flag | Purpose |
|------|---------|
| `--port <n>` / `-p <n>` | Override the listen port. Useful when 8088 is taken. |
| `--start-command "<cmd>"` / `-c "<cmd>"` | Override `azure.yaml` and auto-detect. Example: `--start-command "python app.py"`. |
| `--no-inspector` | Skip opening Agent Inspector. Use in CI / SSH. |

Pass the service name when there are multiple `ai.agent` services:

```bash
azd ai agent run my-agent
```

## Where the start command comes from

Resolution order (first non-empty wins):

1. `--start-command` flag.
2. `azure.yaml services.<name>.config.startupCommand`.
3. Auto-detected from project type.

Example:

```yaml
# azure.yaml
services:
  my-agent:
    project: src/my-agent
    language: py
    host: ai.agent
    config:
      startupCommand: "uvicorn app:app --host 0.0.0.0 --port 4001"
```

If detection fails and no override is set, `run` errors with the project dir and asks for `--start-command` or `startupCommand`.

## Invoke the local agent

```bash
azd ai agent invoke --local "hello, are you up?"
```

`--local` differs from a remote invoke in:

- Targets `http://localhost:<port>` instead of the Foundry endpoint.
- Skips the confirmation envelope (no billing, no remote mutation).
- `--version` is rejected (versions are a remote concept).
- Named-agent invocation is rejected (only one agent runs locally at a time).

Other useful flags:

| Flag | Purpose |
|------|---------|
| `--protocol responses` (default) / `--protocol invocations` | Wire format your agent speaks. |
| `--input-file request.json` / `-f request.json` | Send a file body instead of a string message. |
| `--new-session` | Drop the saved local session and start fresh. |
| `--port <n>` | Match the port you started `run` with. |

## When to graduate to remote

Local dev validates code shape; remote validates infra + identity + Foundry binding. Move to deploy when:

- You changed `agent.yaml` `model:`, `tools:`, `connections:`, or `protocols:`. Those only take effect on the deployed agent.
- You need to test against real Foundry connections (search indexes, Bing, MCP, A2A) that have no local mock.
- You are ready to publish a new immutable agent version.

Next step -> [deploy/deploy.md](../../deploy/deploy.md).

## Common failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `could not connect to localhost:<port>` | `run` not started, or wrong port | Start `azd ai agent run`; pass `--port` to `invoke --local` if non-default. |
| `could not detect project type in <dir>` | Missing project marker file | Set `startupCommand` in `azure.yaml` or pass `--start-command`. |
| `cannot use --local with a named agent` | Named-agent invoke against localhost | Drop the name; only one local agent at a time. |
| `cannot use --version with --local` | `--version` is remote-only | Drop `--version`, or remove `--local` to hit the deployed agent. |
| Inspector never opens | Headless env, or extension install failed | Pass `--no-inspector`, or run `azd extension install azure.ai.inspector`. |
| Auth / connection errors against Azure services | Local credentials not wired | Expected -- `DefaultAzureCredential` falls back to your `az login` / VS Code identity. Use `azd auth login` if needed. |
