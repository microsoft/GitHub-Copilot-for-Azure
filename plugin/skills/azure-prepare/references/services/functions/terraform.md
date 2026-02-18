# Functions Terraform Patterns

**Use Flex Consumption (FC1) for new deployments with managed identity.**

> **⚠️ IMPORTANT**: Flex Consumption requires **azurerm provider v4.2 or later**.

## Provider Configuration

```hcl
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.2"
    }
  }
}
```

## Hosting Plans

| Plan | Use Case | Terraform SKU |
|------|----------|---------------|
| **Flex Consumption** ⭐ | Recommended for new projects | `FC1` |
| Consumption (Y1) | Legacy, not recommended | `Y1` |
| Premium | No cold starts, VNET support | `EP1`, `EP2`, `EP3` |

## Runtime Stacks

Configure in `site_config.application_stack`:

| Runtime | Configuration |
|---------|---------------|
| Node.js | `node_version = "18"` |
| Python | `python_version = "3.11"` |
| .NET | `dotnet_version = "8.0"` |
| Java | `java_version = "17"` |

## Patterns

### [Flex Consumption (Recommended)](terraform/flex-consumption.md)

Complete pattern with managed identity, security best practices, and Azure Verified Module.

**Key Features:**
- Uses `storage_uses_managed_identity = true`
- No connection strings (`shared_access_key_enabled = false`)
- Automatic scaling with `maximum_instance_count`
- References [HashiCorp Flex Consumption Example](https://registry.terraform.io/modules/Azure/avm-res-web-site/azurerm/latest/examples/flex_consumption)

### [Service Bus Integration](terraform/servicebus.md)

Managed identity configuration for Service Bus triggers and bindings.

**Key Features:**
- Uses `SERVICEBUS__fullyQualifiedNamespace` (double underscore)
- Automatic role assignments for receiver/sender
- No connection strings required

### [Alternative Hosting Plans](terraform/hosting-plans.md)

Premium and legacy Consumption plan configurations.

**Includes:**
- Premium (EP1-EP3) with `always_on` and `pre_warmed_instance_count`
- Legacy Y1 Consumption (not recommended for new deployments)
