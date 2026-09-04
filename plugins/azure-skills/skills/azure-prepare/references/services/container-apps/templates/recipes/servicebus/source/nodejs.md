# Service Bus with Node.js / TypeScript

Packages: `@azure/service-bus`, `@azure/identity`.

```typescript
const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_CLIENT_ID,
});
const client = new ServiceBusClient(process.env.SERVICEBUS_FQDN!, credential);
const receiver = client.createReceiver(process.env.SERVICEBUS_QUEUE!);
receiver.subscribe({
  processMessage: async (message) => handle(message.body),
  processError: async (args) => console.error(args.error),
});
```

Close the receiver and client on process shutdown.
