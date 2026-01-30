# Azure Event Grid

Event-driven patterns and best practices for Azure Event Grid.

## When to Use

- Event-driven architectures
- Reactive programming patterns
- Decoupled event routing
- Near real-time event delivery
- Fan-out to multiple subscribers

## Bicep Resource Pattern

```bicep
resource eventGridTopic 'Microsoft.EventGrid/topics@2023-12-15-preview' = {
  name: '${resourcePrefix}-egt-${uniqueHash}'
  location: location
  properties: {
    inputSchema: 'EventGridSchema'
    publicNetworkAccess: 'Enabled'
  }
}

resource eventGridSubscription 'Microsoft.EventGrid/topics/eventSubscriptions@2023-12-15-preview' = {
  parent: eventGridTopic
  name: 'order-processor-subscription'
  properties: {
    destination: {
      endpointType: 'WebHook'
      properties: {
        endpointUrl: 'https://my-api.azurecontainerapps.io/webhooks/orders'
      }
    }
    filter: {
      includedEventTypes: [
        'Order.Created'
        'Order.Updated'
      ]
    }
    retryPolicy: {
      maxDeliveryAttempts: 30
      eventTimeToLiveInMinutes: 1440
    }
  }
}
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| None required | Event Grid is serverless |
| Key Vault | Store topic keys |

## Event Sources

### Azure Resources (System Topics)

```bicep
resource storageSystemTopic 'Microsoft.EventGrid/systemTopics@2023-12-15-preview' = {
  name: '${resourcePrefix}-storage-topic'
  location: location
  properties: {
    source: storageAccount.id
    topicType: 'Microsoft.Storage.StorageAccounts'
  }
}
```

### Custom Topics

```bicep
resource customTopic 'Microsoft.EventGrid/topics@2023-12-15-preview' = {
  name: '${resourcePrefix}-custom-topic'
  location: location
  properties: {
    inputSchema: 'EventGridSchema'
  }
}
```

### Event Domains

```bicep
resource eventDomain 'Microsoft.EventGrid/domains@2023-12-15-preview' = {
  name: '${resourcePrefix}-domain'
  location: location
  properties: {
    inputSchema: 'EventGridSchema'
  }
}
```

## Subscription Destinations

### Webhook

```bicep
destination: {
  endpointType: 'WebHook'
  properties: {
    endpointUrl: 'https://my-api.example.com/events'
  }
}
```

### Azure Function

```bicep
destination: {
  endpointType: 'AzureFunction'
  properties: {
    resourceId: functionApp.id
  }
}
```

### Service Bus Queue

```bicep
destination: {
  endpointType: 'ServiceBusQueue'
  properties: {
    resourceId: '${serviceBus.id}/queues/events'
  }
}
```

### Event Hub

```bicep
destination: {
  endpointType: 'EventHub'
  properties: {
    resourceId: eventHub.id
  }
}
```

## Event Schema

### Event Grid Schema

```json
{
  "id": "unique-id",
  "eventType": "Order.Created",
  "subject": "/orders/12345",
  "eventTime": "2024-01-15T12:00:00Z",
  "data": {
    "orderId": "12345",
    "customerId": "customer-1"
  },
  "dataVersion": "1.0"
}
```

### CloudEvents Schema

```json
{
  "specversion": "1.0",
  "type": "Order.Created",
  "source": "/orders",
  "id": "unique-id",
  "time": "2024-01-15T12:00:00Z",
  "data": {
    "orderId": "12345"
  }
}
```

## Publishing Events

### Node.js

```javascript
const { EventGridPublisherClient, AzureKeyCredential } = require("@azure/eventgrid");

const client = new EventGridPublisherClient(
  process.env.EVENTGRID_TOPIC_ENDPOINT,
  "EventGrid",
  new AzureKeyCredential(process.env.EVENTGRID_TOPIC_KEY)
);

await client.send([{
  eventType: "Order.Created",
  subject: "/orders/12345",
  dataVersion: "1.0",
  data: { orderId: "12345" }
}]);
```

### Python

```python
from azure.eventgrid import EventGridPublisherClient, EventGridEvent
from azure.core.credentials import AzureKeyCredential

client = EventGridPublisherClient(
    os.environ["EVENTGRID_TOPIC_ENDPOINT"],
    AzureKeyCredential(os.environ["EVENTGRID_TOPIC_KEY"])
)

client.send([EventGridEvent(
    event_type="Order.Created",
    subject="/orders/12345",
    data={"orderId": "12345"},
    data_version="1.0"
)])
```

## Event Filtering

### Event Type Filter

```bicep
filter: {
  includedEventTypes: [
    'Order.Created'
    'Order.Shipped'
  ]
}
```

### Subject Filter

```bicep
filter: {
  subjectBeginsWith: '/orders/priority'
  subjectEndsWith: '.json'
}
```

### Advanced Filtering

```bicep
filter: {
  advancedFilters: [
    {
      operatorType: 'NumberGreaterThan'
      key: 'data.amount'
      value: 100
    }
  ]
}
```

## Environment Variables

| Variable | Value |
|----------|-------|
| `EVENTGRID_TOPIC_ENDPOINT` | Topic endpoint URL |
| `EVENTGRID_TOPIC_KEY` | Topic access key (Key Vault) |
