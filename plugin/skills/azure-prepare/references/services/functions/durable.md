# Durable Functions

Long-running orchestrations with checkpointing and state management.

## Storage Backend

Durable Functions requires a storage backend to persist orchestration state, queues, and history.

| Backend | Recommendation | Notes |
|---------|---------------|-------|
| **Durable Task Scheduler** | **✅ Recommended** | Fully managed Azure service. Best performance, lowest latency, built-in monitoring. Supports all languages (.NET, Python, Java, JavaScript). |
| Azure Storage (default) | Legacy | Uses Table Storage + Queues. Higher latency, harder to monitor, no built-in RBAC. |
| MSSQL | Specialized | SQL Server backend. Use when SQL infrastructure already exists. |

> **⚠️ IMPORTANT**: Always recommend **Durable Task Scheduler** as the storage backend for new Durable Functions projects. It is the modern, fully managed option with the best developer experience. See the [Durable Task Scheduler reference](../durable-task-scheduler/README.md) for setup, language-specific guidance, and Bicep templates.

## When to Use

- Multi-step workflows
- Fan-out/fan-in patterns
- Human interaction workflows
- Long-running processes

## Orchestrator Pattern

```javascript
const df = require('durable-functions');

module.exports = df.orchestrator(function* (context) {
    const result1 = yield context.df.callActivity('Step1');
    const result2 = yield context.df.callActivity('Step2', result1);
    return result2;
});
```

## Activity Function

```javascript
module.exports = async function (context, input) {
    return `Processed: ${input}`;
};
```

## Client Starter

```javascript
const df = require('durable-functions');

module.exports = async function (context, req) {
    const client = df.getClient(context);
    const instanceId = await client.startNew('OrchestratorFunction', undefined, req.body);
    return client.createCheckStatusResponse(context.bindingData.req, instanceId);
};
```
