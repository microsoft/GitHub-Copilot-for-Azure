# Java Legacy Azure SDK — Event Hubs Fixture

Minimal Maven project used by the `azure-upgrade` integration test to verify
the Event Hubs slice of Flow B (legacy `com.microsoft.azure` → modern
`com.azure`).

The pom intentionally pulls in:

- `com.microsoft.azure:azure-eventhubs`
- `com.microsoft.azure:azure-eventhubs-eph`

Sources cover the EventProcessorHost rewrite documented under
`plugin/skills/azure-upgrade/references/languages/java/package-specific/com.microsoft.azure.eventprocessorhost.md`:

- `com/microsoft/azure/eventprocessorhosts/{Consumer,EventProcessor,ErrorNotificationHandler}.java`
  — `EventProcessorHost` with `InMemoryCheckpointManager` / `InMemoryLeaseManager`,
  exercising the mandatory rewrite to `BlobCheckpointStore`. Sources are taken
  from <https://github.com/logstash-plugins/logstash-input-azure_event_hubs/blob/main/.ci/integration/event_hub_consumer/src/main/java/com/microsoft/azure/eventprocessorhost/Consumer.java>.

This is a **test fixture**, not a real application. Do not add real
credentials, subscription IDs, or tenant IDs.
