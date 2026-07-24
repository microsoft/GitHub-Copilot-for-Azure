---
name: appinsights-instrumentation
description: "Guidance for Azure Application Insights instrumentation, telemetry, SDK setup, and observability. WHEN: App Insights guidance, instrumentation examples, APM best practices."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# AppInsights Instrumentation Guide

Reference guidance for instrumenting apps with Azure Application Insights.

> **⛔ Adding components?** If the user wants project changes, invoke **azure-prepare**.

## When to Use This Skill

- User asks **how** to instrument
- User needs App Insights SDK setup instructions
- User needs Azure Functions observability guidance
- User wants to understand App Insights concepts

## When to Use azure-prepare Instead

- User says "add telemetry to my app" or wants project changes

## Prerequisites

ASP.NET Core, Node.js, or Python app hosted in Azure App Service or similar Azure hosting.

## Guidelines

### Collect context information

Determine language, framework, and hosting from source. Confirm unknowns before advising.

### Prefer auto-instrument if possible

For C# ASP.NET Core on Azure App Service, use [AUTO guide](references/auto.md) to auto-instrument.

### Manually instrument

Create an AppInsights resource, then update code:

- Bicep: [examples/appinsights.bicep](examples/appinsights.bicep)
- Azure CLI: [scripts/appinsights.ps1](scripts/appinsights.ps1)
- Code guides: [ASP.NET Core](references/aspnetcore.md), [Node.js](references/nodejs.md), [Python](references/python.md)

## SDK Quick References

- **Functions observability**: [Functions](references/functions.md)
- **OpenTelemetry Distro**: [Python](references/sdk/azure-monitor-opentelemetry-py.md) | [TypeScript](references/sdk/azure-monitor-opentelemetry-ts.md)
- **OpenTelemetry Exporter**: [Python](references/sdk/azure-monitor-opentelemetry-exporter-py.md) | [Java](references/sdk/azure-monitor-opentelemetry-exporter-java.md)

## Platform-Specific Guides

- **Container Apps**: [Observability Guide](references/container-apps.md)
