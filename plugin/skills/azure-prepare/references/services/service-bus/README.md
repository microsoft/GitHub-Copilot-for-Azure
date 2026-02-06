# Azure Service Bus

Enterprise messaging with queues and pub/sub topics.

## When to Use

- Reliable message delivery
- Pub/sub messaging patterns
- Message ordering requirements
- Dead-letter handling
- Transaction support
- Enterprise integration

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| None required | Service Bus is self-contained |
| Key Vault | Store connection strings |

## SKU Selection

| SKU | Features | Use Case |
|-----|----------|----------|
| Basic | Queues only, 256KB messages | Simple messaging |
| Standard | Topics, 256KB messages | Pub/sub patterns |
| Premium | 100MB messages, VNET, zones | Enterprise, high throughput |

## Environment Variables

| Variable | Value |
|----------|-------|
| `SERVICEBUS_CONNECTION_STRING` | Connection string (Key Vault) |
| `SERVICEBUS_NAMESPACE` | Namespace name |
| `SERVICEBUS_QUEUE` | Queue name |

## References

| Topic | Reference |
|-------|-----------|
| Bicep patterns | [bicep.md](bicep.md) |
| Messaging patterns | [patterns.md](patterns.md) |
