# Azure Device Provisioning

Provides guided, read-only Azure IoT Device Provisioning Service onboarding validation through Azure MCP.

## Azure MCP

This plugin starts the pinned Azure MCP package through `npx`. Review repository and user-level
`.npmrc` settings before installation because npm configuration can change package resolution.

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.
