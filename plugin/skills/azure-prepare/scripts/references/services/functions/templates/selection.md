# Template Selection Guide

Map user intent to a template `resource` value for `input.functionsTemplate`.

> **NEVER hardcode template names** — names can change. Identify the `resource` from intent (below); the driver discovers the matching template for that `resource` + `language` and fetches it for you.

## Intent → Resource Mapping

| User Says | Code Indicators (existing projects) | Resource Filter | Recipe Reference |
|-----------|-------------------------------------|-----------------|------------------|
| "HTTP", "REST", "API", "webhook" | `HttpTrigger`, `@app.route`, `req: HttpRequest` | `http` | — |
| "timer", "schedule", "cron", "periodic" | `TimerTrigger`, `@app.schedule`, `TimerInfo` | `timer` | [recipes/timer/README.md](recipes/timer/README.md) |
| "Cosmos", "CosmosDB", "document DB" | `CosmosDBTrigger`, `@app.cosmos_db`, `cosmos_db_input` | `cosmos` | [recipes/cosmosdb/README.md](recipes/cosmosdb/README.md) |
| "Event Hub", "streaming", "events" | `EventHubTrigger`, `@app.event_hub`, `event_hub_output` | `eventhub` | [recipes/eventhubs/README.md](recipes/eventhubs/README.md) |
| "Service Bus", "queue", "message" | `ServiceBusTrigger`, `@app.service_bus_queue` | `servicebus` | [recipes/servicebus/README.md](recipes/servicebus/README.md) |
| "blob", "file", "storage trigger" | `BlobTrigger`, `@app.blob`, `blob_input`, `blob_output` | `blob` | [recipes/blob-eventgrid/README.md](recipes/blob-eventgrid/README.md) |
| "SQL", "database trigger" | `SqlTrigger`, `@app.sql`, `sql_input`, `SqlOutput` | `sql` | [recipes/sql/README.md](recipes/sql/README.md) |
| "MCP", "MCP server", "tools" | `McpToolTrigger`, `@app.mcp_tool`, `mcp` in project | `mcp` | [recipes/mcp/README.md](recipes/mcp/README.md) |
| "durable", "workflow", "orchestration" | `DurableOrchestrationTrigger`, `orchestrator`, `durable_functions` | `durable` | [recipes/durable/README.md](recipes/durable/README.md) |
| "AI", "agent", "chatbot", "OpenAI" | `openai`, `AzureOpenAI`, `langchain`, `semantic_kernel` | `http` | Scan description for "AI", "agent", "Copilot SDK" |
| **No specific trigger / intent unclear** | — | `http` (default) | — |

## Selection Algorithm

```
1. DETECT (existing code): Scan for code indicators above → map to resource
2. MATCH (new projects): Map user intent → resource (table above)
3. IaC: infrastructure == user_iac_choice (bicep default, terraform if requested)
4. DEFAULT: If intent unclear or no trigger specified → use `http`
5. SET: input.functionsTemplate = { resource, language }  (the driver discovers,
   filters, and fetches the best-matching AZD-enabled template)
```

## Output: Working Function App

The driver fetches **complete, deployable projects** into the repo. Review the fetched
files in `auto.functionsTemplate.files[]` — each entry has `{ path, content }`:

| Contents | Action |
|----------|--------|
| Function source code (triggers, bindings, business logic), infra, config | Already written to the repo — review, then wire in your app logic |

> NEVER hand-write Bicep/Terraform. If the driver reports no matching template, compose from the reference patterns (see [composition.md](recipes/composition.md)).

For deployment steps, see [README.md](README.md#step-5-deploy).

## Default Behavior

**When user intent is ambiguous or no specific trigger is mentioned**, default to HTTP:

- User says "create a function" with no trigger → HTTP
- User describes business logic without specifying trigger → HTTP
- Intent cannot be determined from context → HTTP

HTTP is the safest default because it's the most common trigger type and provides a simple request/response pattern that works for most use cases.

## IaC Selection

| User Says | Filter By |
|-----------|-----------|
| Nothing specified | `infrastructure: "bicep"` (default) |
| "terraform", "use terraform" | `infrastructure: "terraform"` |
| "bicep", "use bicep" | `infrastructure: "bicep"` |

## Non-AZD Fallback

If specific trigger/binding has no AZD template:

1. Use non-AZD template for **function code** only
2. Find related AZD template as **IaC reference**:

| Non-AZD Resource | Related AZD Reference |
|-----------------|----------------------|
| RabbitMQ, Kafka | EventHub AZD |
| SendGrid, Twilio, Webhook | HTTP AZD |
| IoT Hub | EventHub AZD |
