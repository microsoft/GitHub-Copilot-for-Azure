# Cosmos DB with Python

Packages: `azure-cosmos`, `azure-identity`.

```python
import os
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential(
    managed_identity_client_id=os.environ["AZURE_CLIENT_ID"]
)
client = CosmosClient(os.environ["COSMOS_ENDPOINT"], credential)
container = client.get_database_client(
    os.environ["COSMOS_DATABASE"]
).get_container_client("items")
```

Create the client once at process startup.
