# Reserved Environment Variables for Hosted Agents

The Foundry platform injects environment variables into every hosted agent container at startup. You MUST NOT generate, suggest, or configure any of these in `.env` files, `agent.yaml` `environment_variables`, or application code.

## Blocked Prefixes

Any variable starting with these is reserved and will be overwritten at runtime:

- `FOUNDRY_*` - platform-injected identity, session, project, and toolset variables
- `AGENT_*` - reserved for platform use

## Exact Reserved Names

These are platform-managed and overwritten at runtime:

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP listen port (default `8088`) |
| `HOME` | session filesystem path (`/home/session`) |
| `SSE_KEEPALIVE_INTERVAL` | SSE keep-alive config |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | observability |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint |

## Key `FOUNDRY_*` Variables Available at Runtime

These are read-only - do not set them, but your code can read them:

| Variable | Purpose |
|----------|---------|
| `FOUNDRY_PROJECT_ENDPOINT` | Project endpoint URL for calling Azure services |
| `FOUNDRY_AGENT_NAME` | The deployed agent's name |
| `FOUNDRY_AGENT_VERSION` | The deployed agent's version |
| `FOUNDRY_TOOLBOX_ENDPOINT` | MCP-compatible toolbox endpoint (if toolbox is configured) |

If user code needs to read these values at runtime (e.g., `FOUNDRY_PROJECT_ENDPOINT` to call Azure services), read them from the environment - do not set or override them.

## Local Development

For local development, `azd ai agent run` translates azd environment values into `FOUNDRY_*` variables for you. You do not need to export them manually.
