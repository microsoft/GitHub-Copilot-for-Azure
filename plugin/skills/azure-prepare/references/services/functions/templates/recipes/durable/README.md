# Durable Functions Recipe

Orchestration workflows with Durable Task Scheduler as the backend.

## Template Selection

Resource filter: `durable`  
Discover templates via MCP or CDN manifest where `resource == "durable"` and `language` matches user request.

## Key Concept

Uses **Durable Task Scheduler** (DTS) — a fully managed backend for state persistence. Do NOT use Azure Storage queues/tables.

See [Durable Task Scheduler reference](../../../../durable-task-scheduler/README.md) for backend configuration details.

## Eval

| Path | Description |
|------|-------------|
| [eval/summary.md](eval/summary.md) | Evaluation summary |
| [eval/python.md](eval/python.md) | Python evaluation results |
