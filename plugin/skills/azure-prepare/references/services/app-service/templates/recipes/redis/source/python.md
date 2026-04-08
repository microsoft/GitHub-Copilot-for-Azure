# Redis Recipe — Python — REFERENCE ONLY

## Redis Client with Token Refresh

### Requirements

Add to `requirements.txt`:

```
redis>=5.0
azure-identity
```

### Cache Module

Create `cache.py`:

```python
import os
import time
import threading
import redis
from azure.identity import DefaultAzureCredential

# Redis ACL auth requires both username and token as password
_REDIS_USERNAME = "default"
_TOKEN_SCOPE = "https://redis.azure.com/.default"
_TOKEN_REFRESH_MARGIN = 300  # Refresh 5 minutes before expiry

_credential = DefaultAzureCredential()
_lock = threading.Lock()
_token_cache: dict = {}


def _get_token():
    """Return a valid Entra ID token, refreshing if within expiry margin."""
    with _lock:
        now = time.time()
        if not _token_cache or now >= _token_cache["expires_on"] - _TOKEN_REFRESH_MARGIN:
            tok = _credential.get_token(_TOKEN_SCOPE)
            _token_cache["token"] = tok.token
            _token_cache["expires_on"] = tok.expires_on
        return _token_cache["token"]


def create_redis_client() -> redis.Redis:
    """Create a Redis client using Entra ID token authentication."""
    return redis.Redis(
        host=os.environ["REDIS_HOST"],
        port=int(os.environ.get("REDIS_PORT", 6380)),
        ssl=True,
        username=_REDIS_USERNAME,
        password=_get_token(),
        decode_responses=True,
    )


# Re-create the client periodically to pick up refreshed tokens
# For long-running processes, call create_redis_client() before each operation
# or implement a background refresh thread.
cache = create_redis_client()
```

> ⚠️ Entra ID tokens expire in ~1 hour. The `_get_token()` helper refreshes proactively 5 minutes before expiry. For long-lived processes, recreate the client or refresh the `password` before expiry.

### Usage

```python
from cache import cache

def get_cached(key: str):
    value = cache.get(key)
    if value is None:
        value = "computed-value"
        cache.setex(key, 300, value)  # TTL 5 minutes
    return value
```

## Files to Modify

| File | Action |
|------|--------|
| `cache.py` | Create — Redis client with token refresh |
| `main.py` | Modify — use cache client |
| `requirements.txt` | Modify — add redis, azure-identity |
