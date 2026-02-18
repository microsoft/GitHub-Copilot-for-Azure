# Service Bus Integration

Service Bus integration with managed identity for Azure Functions.

```hcl
data "azurerm_servicebus_namespace" "example" {
  name                = var.servicebus_namespace_name
  resource_group_name = var.servicebus_resource_group
}

resource "azurerm_linux_function_app" "function_app" {
  # ... (Function App definition from Flex Consumption pattern)
  
  app_settings = {
    # Storage with managed identity
    "AzureWebJobsStorage__accountName" = azurerm_storage_account.function_storage.name
    
    # Service Bus with managed identity
    "SERVICEBUS__fullyQualifiedNamespace" = "${data.azurerm_servicebus_namespace.example.name}.servicebus.windows.net"
    "SERVICEBUS_QUEUE_NAME"               = var.servicebus_queue_name
    
    # Other settings...
    "FUNCTIONS_EXTENSION_VERSION"  = "~4"
    "FUNCTIONS_WORKER_RUNTIME"     = "python"
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.function_insights.connection_string
  }
}

# Grant Service Bus Data Receiver role for triggers
resource "azurerm_role_assignment" "servicebus_receiver" {
  scope                = data.azurerm_servicebus_namespace.example.id
  role_definition_name = "Azure Service Bus Data Receiver"
  principal_id         = azurerm_linux_function_app.function_app.identity[0].principal_id
}

# Grant Service Bus Data Sender role (if function sends messages)
resource "azurerm_role_assignment" "servicebus_sender" {
  scope                = data.azurerm_servicebus_namespace.example.id
  role_definition_name = "Azure Service Bus Data Sender"
  principal_id         = azurerm_linux_function_app.function_app.identity[0].principal_id
}
```

> 💡 **Key Points:**
> - Use `SERVICEBUS__fullyQualifiedNamespace` (double underscore) for managed identity
> - Grant `Service Bus Data Receiver` role for reading messages
> - Grant `Service Bus Data Sender` role for sending messages (if needed)
> - Role assignments automatically enable connection via managed identity
