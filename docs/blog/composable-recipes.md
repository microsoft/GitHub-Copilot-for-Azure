# Introducing Composable Recipes for Azure Functions

> Build production-ready serverless apps in minutes by combining proven templates with integration recipes.

## TL;DR

- **8 integration recipes** now available: Cosmos DB, Event Hubs, Service Bus, SQL, Blob+EventGrid, Timer, Durable, MCP
- **One command** to scaffold: `azd init -t functions-quickstart-python-http-azd`
- **Mix and match** - start with HTTP base, add any recipe
- **Multi-language** - Python, TypeScript, JavaScript, C#, Java, PowerShell
- **Production-ready** - UAMI auth, RBAC, VNet support built-in

## The Problem

Building Azure Functions with service integrations used to mean:
1. Hunting for the right template
2. Manually configuring IAM and networking
3. Debugging auth errors because you missed a setting
4. Repeating this for each language

**Result:** Hours lost to boilerplate instead of building features.

## The Solution: Composable Recipes

We've created a **recipe system** that separates concerns:

| Component | What It Provides |
|-----------|------------------|
| **Base Template** | HTTP trigger + Storage + App Insights + UAMI + RBAC |
| **Recipe** | Service-specific IaC + source code + app settings |

Compose them together → get a deployable project.

## Getting Started

### Step 1: Initialize Base Template

```bash
azd init -t functions-quickstart-python-http-azd -e myapp-dev --no-prompt
```

### Step 2: Apply a Recipe

The azure-prepare skill automatically:
1. Copies recipe's Bicep modules to `infra/app/`
2. Wires them into `main.bicep`
3. Adds required app settings
4. Replaces source code with trigger implementation

### Step 3: Deploy

```bash
azd provision --no-prompt
sleep 60  # RBAC propagation
azd deploy --no-prompt
```

## Available Recipes

| Recipe | Trigger | Languages | IaC Required |
|--------|---------|-----------|--------------|
| **cosmosdb** | Change feed | All 6 | ✅ Cosmos account |
| **eventhubs** | Event stream | All 6 | ✅ EH namespace |
| **servicebus** | Queue/Topic | All 6 | ✅ SB namespace |
| **sql** | Row changes | Py, TS, C# | ✅ SQL Server |
| **blob-eventgrid** | Blob events | Py, TS | ✅ EventGrid sub |
| **timer** | Cron schedule | All 6 | ❌ Source only |
| **durable** | Orchestration | Py, TS, JS, C# | ⚠️ Storage flags |
| **mcp** | JSON-RPC tools | Py, TS | ⚠️ Storage flags |

## Deep Dive: Storage Flags

Some recipes need Queue or Table storage beyond the default Blob. Set flags in `main.bicep`:

```bicep
module storage './shared/storage.bicep' = {
  params: {
    enableBlob: true    // Default
    enableQueue: true   // Durable, MCP
    enableTable: true   // Durable only
  }
}
```

When `true`, the base template automatically:
- Adds service URI app settings
- Assigns RBAC roles to managed identity

**No manual IAM configuration needed.**

## Example: Event Hubs Function

```python
import azure.functions as func
import logging

app = func.FunctionApp()

@app.event_hub_message_trigger(
    arg_name="event",
    event_hub_name="%EVENTHUB_NAME%",
    connection="EventHubConnection"
)
def process_event(event: func.EventHubEvent):
    logging.info(f"Received: {event.get_body().decode()}")
```

The recipe handles:
- ✅ Event Hub namespace creation
- ✅ Consumer group setup
- ✅ UAMI role assignment (Azure Event Hubs Data Receiver)
- ✅ App settings with `__credential` and `__clientId`

## What's Next

- **More recipes**: SignalR, API Management, Logic Apps
- **Terraform parity**: All recipes in both Bicep and Terraform
- **Recipe composer UI**: Visual recipe selection in VS Code

---

**Try it now:** Ask GitHub Copilot to "create an Azure Function with Event Hubs trigger" and watch the recipe system do its magic.
