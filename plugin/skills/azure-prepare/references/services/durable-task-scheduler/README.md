# Durable Task Scheduler

Build reliable, fault-tolerant workflows using durable execution with Azure Durable Task Scheduler.

## When to Use

- Long-running workflows requiring state persistence
- Distributed transactions with compensating actions (saga pattern)
- Multi-step orchestrations with checkpointing
- Fan-out/fan-in parallel processing
- Workflows requiring human interaction or external events
- Stateful entities (aggregators, counters, state machines)
- Multi-agent AI orchestration
- Data processing pipelines

## Framework Selection

| Framework | Best For | Hosting |
|-----------|----------|---------|
| **Durable Functions** | Serverless event-driven apps | Azure Functions |
| **Durable Task SDKs** | Any compute (containers, VMs) | ACA, AKS, App Service, VMs |

> **💡 TIP**: Use Durable Functions for serverless with built-in triggers. Use Durable Task SDKs for hosting flexibility.

## Quick Start - Local Emulator

```bash
# Start the emulator (update the tag as needed; see https://mcr.microsoft.com/v2/dts/dts-emulator/tags/list for newer versions)
docker pull mcr.microsoft.com/dts/dts-emulator:v0.0.10
docker run -d -p 8080:8080 -p 8082:8082 --name dts-emulator mcr.microsoft.com/dts/dts-emulator:v0.0.10

# Dashboard available at http://localhost:8082
```

## Workflow Patterns

| Pattern | Use When |
|---------|----------|
| **Function Chaining** | Sequential steps, each depends on previous |
| **Fan-Out/Fan-In** | Parallel processing with aggregated results |
| **Async HTTP APIs** | Long-running operations with HTTP polling |
| **Monitor** | Periodic polling with configurable timeouts |
| **Human Interaction** | Workflow pauses for external input/approval |
| **Saga** | Distributed transactions with compensation |
| **Durable Entities** | Stateful objects (counters, accounts) |

## Connection & Authentication

| Environment | Connection String |
|-------------|-------------------|
| Local Development (Emulator) | `Endpoint=http://localhost:8080;Authentication=None` |
| Azure (System-Assigned MI) | `Endpoint=https://<scheduler>.durabletask.io;Authentication=ManagedIdentity` |
| Azure (User-Assigned MI) | `Endpoint=https://<scheduler>.durabletask.io;Authentication=ManagedIdentity;ClientID=<uami-client-id>` |

> **⚠️ NOTE**: Durable Task Scheduler uses identity-based authentication only — no connection strings with keys. When using a User-Assigned Managed Identity (UAMI), you must include the `ClientID` in the connection string.

## Azure Deployment

For provisioning, Bicep templates, managed identity configuration, and deployment workflows, invoke the **azure-deploy** skill which includes DTS-specific deployment guidance.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| **403 PermissionDenied** on gRPC call (e.g., `client.start_new()`) | Function App managed identity lacks RBAC on the Durable Task Scheduler resource | Assign `Durable Task Data Contributor` role (`5f6a3c3e-0da3-4079-b4f3-4db62a1d3c09`) to the identity (SAMI or UAMI) scoped to the Durable Task Scheduler resource. For UAMI, also ensure the connection string includes `ClientID=<uami-client-id>` |
| **Connection refused** to emulator | Emulator container not running or wrong port | Verify container is running: `docker ps` and confirm port 8080 is mapped |
| **TaskHub not found** | Task hub not provisioned or name mismatch | Ensure `TASKHUB_NAME` app setting matches the provisioned task hub name |

## References

- [.NET](dotnet.md) — packages, setup, examples, determinism, retry, SDK
- [Python](python.md) — packages, setup, examples, determinism, retry, SDK
- [Java](java.md) — dependencies, setup, examples, determinism, retry, SDK
- [JavaScript](javascript.md) — packages, setup, examples, determinism, retry, SDK
- [Bicep Patterns](bicep.md) — scheduler, task hub, RBAC, CLI provisioning
- [Official Documentation](https://learn.microsoft.com/azure/azure-functions/durable/durable-task-scheduler/durable-task-scheduler)
- [Durable Functions Overview](https://learn.microsoft.com/azure/azure-functions/durable/durable-functions-overview)
- [Sample Repository](https://github.com/Azure-Samples/Durable-Task-Scheduler)
- [Choosing an Orchestration Framework](https://learn.microsoft.com/azure/azure-functions/durable/durable-task-scheduler/choose-orchestration-framework)
