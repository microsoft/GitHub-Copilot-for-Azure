# Service Bus with Java

Packages: `com.azure:azure-messaging-servicebus`, `com.azure:azure-identity`.

```java
TokenCredential credential = new DefaultAzureCredentialBuilder()
    .managedIdentityClientId(System.getenv("AZURE_CLIENT_ID"))
    .build();
ServiceBusProcessorClient processor = new ServiceBusClientBuilder()
    .fullyQualifiedNamespace(System.getenv("SERVICEBUS_FQDN"))
    .credential(credential)
    .processor()
    .queueName(System.getenv("SERVICEBUS_QUEUE"))
    .processMessage(context -> handle(context.getMessage().getBody()))
    .processError(context -> logger.error("Service Bus", context.getException()))
    .buildProcessorClient();
processor.start();
```
