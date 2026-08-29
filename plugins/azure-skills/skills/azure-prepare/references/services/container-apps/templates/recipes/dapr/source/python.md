# Dapr with Python

Use `httpx` against the local sidecar. The Dapr component, not the app, authenticates to
Azure services.

```python
import os
import httpx

base = f"http://localhost:{os.getenv('DAPR_HTTP_PORT', '3500')}"
httpx.post(f"{base}/v1.0/publish/pubsub/orders", json={"orderId": "123"}).raise_for_status()
secret = httpx.get(
    f"{base}/v1.0/secrets/secretstore/db-password"
).raise_for_status().json()["db-password"]
```

Use timeouts and retry only idempotent operations in production.
