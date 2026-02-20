---
name: azure-messaging
description: |
  Troubleshoot and resolve issues with Azure Messaging SDKs for Event Hubs and Service Bus.
  Covers connection failures, authentication errors, message processing issues, and SDK configuration problems.
  USE FOR: event hub SDK error, service bus SDK issue, messaging connection failure, AMQP error,
  event processor host issue, message lock lost, send timeout, receiver disconnected, SDK troubleshooting,
  azure messaging SDK, event hub consumer, service bus queue issue, topic subscription error
  DO NOT USE FOR: creating Event Hub or Service Bus resources (use azure-prepare), monitoring metrics
  (use azure-observability), cost analysis (use azure-cost-optimization)
---

# Azure Messaging SDK Troubleshooting

## Quick Reference

| Property | Value |
|----------|-------|
| **Services** | Azure Event Hubs, Azure Service Bus |
| **MCP Tools** | `azure-eventhubs`, `azure-servicebus` |
| **Best For** | Diagnosing SDK connection, auth, and message processing issues |

## When to Use This Skill

- User reports connection failures with Event Hubs or Service Bus SDK
- Authentication or authorization errors (SAS, Entra ID / Managed Identity)
- Message send/receive timeouts or AMQP link errors
- Event processor or message handler stops processing
- Message lock lost or session lock errors in Service Bus
- SDK configuration questions (retry policy, prefetch, batch size)

## MCP Tools

| Tool | Command | Use |
|------|---------|-----|
| `azure-eventhubs` | Namespace and hub operations | List namespaces, hubs, consumer groups |
| `azure-servicebus` | Queue and topic operations | List namespaces, queues, topics, subscriptions |
| `azure-monitor` | `logs_query` | Query diagnostic logs with KQL |
| `azure-resourcehealth` | `get` | Check service health status |

## Diagnosis Workflow

1. **Identify the SDK and version** — Ask which language SDK and version the user is on
2. **Check resource health** — Use `azure-resourcehealth` to verify the namespace is healthy
3. **Review the error message** — Match against language-specific troubleshooting guide
4. **Check configuration** — Verify connection string, entity name, consumer group
5. **Recommend fix** — Apply the appropriate remediation


## Diagnostic KQL Queries

```kql
// Event Hubs failures in the last hour
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.EVENTHUB"
| where Category == "OperationalLogs"
| where Level == "Error"
| project TimeGenerated, OperationName, ResultDescription
| order by TimeGenerated desc
| take 50
```

```kql
// Service Bus dead-letter messages
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.SERVICEBUS"
| where OperationName == "DeadLetter"
| project TimeGenerated, _ResourceId, properties_s
| order by TimeGenerated desc
| take 50
```

## SDK Troubleshooting Guides

Language-specific error handling, common issues, and configuration for each SDK:

- **Event Hubs**: [Python](references/sdk/azure-eventhubs-py.md) | [Java](references/sdk/azure-eventhubs-java.md) | [JavaScript](references/sdk/azure-eventhubs-js.md) | [.NET](references/sdk/azure-eventhubs-dotnet.md)
- **Service Bus**: [Python](references/sdk/azure-servicebus-py.md) | [Java](references/sdk/azure-servicebus-java.md) | [JavaScript](references/sdk/azure-servicebus-js.md) | [.NET](references/sdk/azure-servicebus-dotnet.md)

## References

- [Event Hubs quotas and limits](https://learn.microsoft.com/azure/event-hubs/event-hubs-quotas)
- [Service Bus quotas and limits](https://learn.microsoft.com/azure/service-bus-messaging/service-bus-quotas)
- [Event Hubs AMQP troubleshooting](https://learn.microsoft.com/azure/event-hubs/event-hubs-amqp-troubleshoot)
- [Service Bus AMQP troubleshooting](https://learn.microsoft.com/azure/service-bus-messaging/service-bus-amqp-troubleshoot)