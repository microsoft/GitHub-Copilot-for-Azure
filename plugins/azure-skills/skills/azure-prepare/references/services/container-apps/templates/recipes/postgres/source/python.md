# PostgreSQL with Python

Packages: `psycopg[binary]`, `azure-identity`.

```python
credential = DefaultAzureCredential(
    managed_identity_client_id=os.environ["AZURE_CLIENT_ID"]
)
token = credential.get_token(
    "https://ossrdbms-aad.database.windows.net/.default"
)
connection = psycopg.connect(
    host=os.environ["PGHOST"],
    dbname=os.environ["PGDATABASE"],
    user=os.environ["PGUSER"],
    password=token.token,
    sslmode="require",
)
```

Refresh the token before opening new pooled connections after expiry.
