---
name: appinsights-instrumentation
description: 'Instrument a webapp to send telemetry data to Azure App Insights'
---

# AppInsights Instrumentation

Add Azure Application Insights telemetry to web apps for observability.

## Prerequisites

Supported: ASP.NET Core, Node.js, or Python apps hosted in Azure.

## Workflow

1. **Determine context**: Identify (language, framework, hosting). Always ask where hosted.
2. **Prefer auto-instrument**: For ASP.NET Core on App Service → [AUTO guide](references/AUTO.md)
3. **Manual setup**: Create resource + modify code

## Resource Creation

| Method | When to Use |
|--------|-------------|
| [Bicep template](examples/appinsights.bicep) | Existing Bicep files in workspace |
| [Azure CLI](scripts/appinsights.ps1) | Quick setup via CLI |

Create in same resource group as the hosted app.

## Code Modification

| Stack | Guide |
|-------|-------|
| ASP.NET Core | [ASPNETCORE](references/ASPNETCORE.md) |
| Node.js | [NODEJS](references/NODEJS.md) |
| Python | [PYTHON](references/PYTHON.md) |
