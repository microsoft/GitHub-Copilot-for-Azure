# Service Bus with Python

Packages: `azure-servicebus`, `azure-identity`.

```python
import os
from azure.identity import DefaultAzureCredential
from azure.servicebus import ServiceBusClient

credential = DefaultAzureCredential(
    managed_identity_client_id=os.environ["AZURE_CLIENT_ID"]
)
client = ServiceBusClient(
    fully_qualified_namespace=os.environ["SERVICEBUS_FQDN"],
    credential=credential,
)
receiver = client.get_queue_receiver(queue_name=os.environ["SERVICEBUS_QUEUE"])
```

Use context managers so clients and receivers close cleanly.
