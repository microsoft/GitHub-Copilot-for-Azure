# Redis with Python

Packages: `redis`, `azure-identity`.

```python
credential = DefaultAzureCredential(
    managed_identity_client_id=os.environ["AZURE_CLIENT_ID"]
)
token = credential.get_token("https://redis.azure.com/.default")
client = redis.Redis(
    host=os.environ["REDIS_HOSTNAME"],
    port=int(os.getenv("REDIS_PORT", "6380")),
    ssl=True,
    username=os.environ["REDIS_USER_OID"],
    password=token.token,
)
```

Refresh credentials before token expiry for long-running workers.
