# Service Bus - Bicep Patterns

## Namespace

```bicep
resource serviceBus 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '${resourcePrefix}-sb-${uniqueHash}'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
}
```

## Queue

```bicep
resource queue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBus
  name: 'orders'
  properties: {
    maxDeliveryCount: 10
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P14D'
    lockDuration: 'PT5M'
  }
}
```

## Topic and Subscription

```bicep
resource topic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = {
  parent: serviceBus
  name: 'events'
  properties: {
    defaultMessageTimeToLive: 'P14D'
  }
}

resource subscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: topic
  name: 'order-processor'
  properties: {
    maxDeliveryCount: 10
    deadLetteringOnMessageExpiration: true
    lockDuration: 'PT5M'
  }
}
```

## Subscription Filters

### SQL Filter

```bicep
resource filterRule 'Microsoft.ServiceBus/namespaces/topics/subscriptions/rules@2022-10-01-preview' = {
  parent: subscription
  name: 'high-priority'
  properties: {
    filterType: 'SqlFilter'
    sqlFilter: {
      sqlExpression: 'priority = \'high\''
    }
  }
}
```

### Correlation Filter

```bicep
resource correlationRule 'Microsoft.ServiceBus/namespaces/topics/subscriptions/rules@2022-10-01-preview' = {
  parent: subscription
  name: 'orders-only'
  properties: {
    filterType: 'CorrelationFilter'
    correlationFilter: {
      label: 'order'
    }
  }
}
```

## Managed Identity Access

```bicep
resource serviceBusRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBus.id, principalId, 'Azure Service Bus Data Sender')
  scope: serviceBus
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39')
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
```
