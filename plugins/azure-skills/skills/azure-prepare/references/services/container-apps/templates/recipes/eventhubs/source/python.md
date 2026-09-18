# Event Hubs with Python

Packages: `azure-eventhub`, `azure-eventhub-checkpointstoreblob-aio`, `azure-identity`.

```python
credential = DefaultAzureCredential(
    managed_identity_client_id=os.environ["AZURE_CLIENT_ID"]
)
checkpoint = BlobCheckpointStore(
    blob_account_url=os.environ["CHECKPOINT_STORAGE_URL"],
    container_name="checkpoints",
    credential=credential,
)
client = EventHubConsumerClient(
    fully_qualified_namespace=os.environ["EVENTHUB_FQDN"],
    eventhub_name=os.environ["EVENTHUB_NAME"],
    consumer_group=os.environ["EVENTHUB_CONSUMER_GROUP"],
    credential=credential,
    checkpoint_store=checkpoint,
)
```

Use the async clients for long-running workers.
