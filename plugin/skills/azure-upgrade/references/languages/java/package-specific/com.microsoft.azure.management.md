# com.microsoft.azure.management.**

## Code Checklist

- Keep Azure resources, operations, and property values identical. The goal is functional equivalence, not feature expansion.
- Do not change the method sequence when creating or updating an Azure resource unless the new SDK requires it.
- Preserve the existing async pattern. For example, a delayed provisioning pattern that uses `Creatable<Resource>` should not be replaced by a direct `.create()` call. Similarly, when provisioning a resource, do not swap `.withNewDependencyResource` for `.withExistingDependencyResource` unless mandated by the new API surface.
- Keep the text emitted by logging and stdout/stderr unchanged to avoid breaking downstream consumers of those streams.
- Do not replace `resource.region()` with `resource.regionName()`; doing so changes the type from `Region` to `String` and can introduce subtle regressions.

## Code Samples

### Authentication with File

Even though file-based authentication is deprecated in the modern SDKs, preserve the existing logic when performing the upgrade.

Legacy code
```java
final File credentialFile = new File(System.getenv("AZURE_AUTH_LOCATION"));
Azure azure = Azure.configure()
    .authenticate(credentialFile)
    .withDefaultSubscription();
```
can be updated to read the JSON file via `ObjectMapper` from the Jackson library and authenticate with the `ClientSecretCredential` class.
```java
final File credentialFile = new File(System.getenv("AZURE_AUTH_LOCATION"));
ObjectMapper mapper = new ObjectMapper();
JsonNode credentialFileNode = mapper.readTree(credentialFile);
String clientId = credentialFileNode.get("clientId").asText();
String clientSecret = credentialFileNode.get("clientSecret").asText();
String tenantId = credentialFileNode.get("tenantId").asText();
String subscriptionId = credentialFileNode.get("subscriptionId").asText();

AzureProfile profile = new AzureProfile(tenantId, subscriptionId, AzureEnvironment.AZURE);
ClientSecretCredential credential = new ClientSecretCredentialBuilder()
    .clientId(clientId)
    .clientSecret(clientSecret)
    .tenantId(tenantId)
    .build();

AzureResourceManager azure = AzureResourceManager.configure()
    .authenticate(credential, profile)
    .withSubscription(subscriptionId);
```

If Jackson is not included in the project, add a compatible version of `jackson-databind`.

Handle `IOException` and other checked exceptions according to the project's standards.

### OKHttp Interceptors

Legacy OKHttp `Interceptor` implementation classes should be migrated to `HttpPipelinePolicy` implementation classes.

1. Legacy code:
```java
RestClient.Builder builder = new RestClient.Builder()
    ...
    .withNetworkInterceptor(new ResourceGroupTaggingInterceptor())
    ...;

Azure.Authenticated azureAuthed = Azure.authenticate(builder.build(), subscriptionId, credentials.domain());
Azure azure = azureAuthed.withSubscription(subscriptionId);
```

2. Migrated code:
```java
AzureResourceManager azureResourceManager = AzureResourceManager.configure()
    .withPolicy(new ResourceGroupTaggingPolicy())
    .authenticate(credential, profile)
    .withDefaultSubscription();
```

### ProviderRegistrationInterceptor

If legacy client(XXManager) initializes with `ProviderRegistrationInterceptor`, check whether this client is one of the premium ones:
- Azure
- AuthorizationManager
- CdnManager
- ComputeManager
- ContainerInstanceManager
- ContainerRegistryManager
- ContainerServiceManager
- CosmosDBManager
- DnsZoneManager
- EventHubManager
- KeyVaultManager
- MonitorManager
- MSIManager
- NetworkManager
- RedisManager
- ResourceManager
- SearchServiceManager
- ServiceBusManager
- SqlServerManager
- StorageManager
- TrafficManager

If not, add `ProviderRegistrationPolicy` when initializing the client. Otherwise, don't.

For each legacy client, add along with whether to initialize with `ProviderRegistrationPolicy`, to the generated plan guideline, and migrate accordingly.

1. Legacy client(not premium client):
```java
BatchManager batchManager = BatchManager.configure()
    .withLogLevel(LogLevel.BASIC)
    .withInterceptor(new ProviderRegistrationInterceptor(credentials))
    .authenticate(credentials, subscriptionId);
```
should be migrated to:
```java
BatchManager batchManager = BatchManager.configure()
    .withPolicy(new ProviderRegistrationPolicy())
    .withLogOptions(new HttpLogOptions().setLogLevel(HttpLogDetailLevel.BASIC))
    .authenticate(credential, profile);
```

2. Legacy client(premium clients):
```java
Azure azure = Azure.configure()
    .withInterceptor(new ProviderRegistrationInterceptor(credentials))
    .withLogLevel(LogLevel.BASIC)
    .authenticate(credentials)
    .withSubscription(subscriptionId);
```
should be migrated to:
```java
AzureResourceManager.configure()
    .withLogLevel(HttpLogDetailLevel.BASIC)
    .authenticate(credential, profile);
```

### BatchAccount

azure-resourcemanager-batch is no longer a premium/handwritten library. In BatchAccount, `withNewStorageAccount` should be replaced by `.withAutoStorage(new AutoStorageBaseProperties().withStorageAccountId(storageAccount.id()))`, while the `storageAccount` needs to be created separately.

Legacy code:
```java
BatchAccount batchAccount = azure.batchAccounts().define(batchAccountName)
    .withRegion(region)
    .withNewResourceGroup(rgName)
    .defineNewApplication(applicationName)
        .defineNewApplicationPackage(applicationPackageName)
        .withAllowUpdates(true)
        .withDisplayName(applicationDisplayName)
        .attach()
    .withNewStorageAccount(storageAccountName)
    .create();
```

Migrated:
```java
StorageAccount storageAccount = storageManager.storageAccounts()
    .define(storageAccountName)
    .withRegion(REGION)
    .withExistingResourceGroup(resourceGroup)
    .create();
BatchAccount account = batchManager.batchAccounts()
    .define(batchAccountName)
    .withRegion(REGION)
    .withExistingResourceGroup(resourceGroup)
    .withAutoStorage(new AutoStorageBaseProperties().withStorageAccountId(storageAccount.id()))
    .create();
// create application with batch account
application = batchManager.applications()
    .define(applicationName)
    .withExistingBatchAccount(resourceGroup, account.name())
    .withDisplayName(applicationDisplayName)
    .withAllowUpdates(true)
    .create();
applicationPackage = batchManager.applicationPackages()
    .define(applicationPackageName)
    .withExistingApplication(resourceGroup, batchAccountName, applicationName)
    .create();
```
