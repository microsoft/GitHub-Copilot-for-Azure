# Event Hubs with Node.js / TypeScript

Packages: `@azure/event-hubs`, `@azure/identity`, `@azure/storage-blob`,
`@azure/eventhubs-checkpointstore-blob`.

```typescript
const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_CLIENT_ID,
});
const container = new ContainerClient(
  `${process.env.CHECKPOINT_STORAGE_URL!}/checkpoints`, credential);
const store = new BlobCheckpointStore(container);
const client = new EventHubConsumerClient(
  process.env.EVENTHUB_CONSUMER_GROUP!,
  process.env.EVENTHUB_FQDN!,
  process.env.EVENTHUB_NAME!,
  credential,
  store,
);
```

Call `client.subscribe` with event and error handlers, and close the subscription on shutdown.
