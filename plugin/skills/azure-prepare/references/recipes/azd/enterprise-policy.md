# Enterprise Policy Compliance

Many Azure enterprise environments enforce security policies that require disabling local authentication methods. When generating infrastructure, **always include** these security properties to comply with common enterprise policies.

## Event Hubs Namespace

```bicep
resource eventHubNamespace 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: eventHubNamespaceName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    disableLocalAuth: true  // REQUIRED for enterprise policy compliance
  }
}
```

## Storage Account

```bicep
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowSharedKeyAccess: false  // REQUIRED for enterprise policy compliance
  }
}
```

## Application Insights

```bicep
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    DisableLocalAuth: true  // REQUIRED for enterprise policy compliance
  }
}
```

## Service Bus Namespace

```bicep
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: serviceBusNamespaceName
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    disableLocalAuth: true  // REQUIRED for enterprise policy compliance
  }
}
```

## Common Policy Errors

**Error:**
```
RequestDisallowedByPolicy: Resource 'evhns-xxx' was disallowed by policy.
Reasons: 'Local authentication methods are not allowed.'
```

**Solution:** Add `disableLocalAuth: true` (or `allowSharedKeyAccess: false` for Storage) to the resource properties in Bicep.

## See Also

- [iac-rules.md](iac-rules.md) - Complete IAC rules including security requirements
- [appinsights-auth.md](appinsights-auth.md) - Application Insights identity-based authentication
