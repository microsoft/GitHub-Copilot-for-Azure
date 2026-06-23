# FastAPI Knowledge Pack

> **Applies to:** Projects detected with `requirements.txt`, `pyproject.toml`, or `Pipfile` containing `fastapi`

---

## Dockerfile Patterns

### Multi-stage build with virtual environment

Using a virtual environment in a multi-stage build keeps the final image lean by copying only installed packages:

```dockerfile
# Build stage
FROM python:3.12-slim AS build
WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Runtime stage
FROM python:3.12-slim AS runtime
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=build /opt/venv /opt/venv
COPY --from=build /app .
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
USER app:app
EXPOSE 8000
# HEALTHCHECK is omitted — Kubernetes liveness/readiness probes handle
# health checks in AKS. See deployment.yaml for probe configuration.
ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Key points

- **Base image:** `python:3.12-slim` over Alpine — Alpine uses musl libc which causes build failures with many Python C extensions (numpy, psycopg2, cryptography)
- **`PYTHONDONTWRITEBYTECODE=1`** prevents `.pyc` files from bloating the image
- **`PYTHONUNBUFFERED=1`** ensures logs appear immediately in `kubectl logs` without buffering
- **`--no-cache-dir`** for pip avoids caching wheel files in the image layer
- **Non-root user** (`app`) satisfies DS004
- **Virtual environment copy** (`/opt/venv`) cleanly separates dependencies from build tools

---

## Health Endpoints

FastAPI health endpoints must be defined explicitly in application code:

### Minimal health route

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### Readiness route with database check

```python
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

@app.get("/ready")
async def ready(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not ready"},
        )
```

### Probe configuration in Deployment manifest

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 15
  timeoutSeconds: 3
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /ready
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

**Note:** FastAPI apps start quickly (typically <2s), so `initialDelaySeconds: 5` is sufficient — much lower than JVM-based frameworks.

---

## Database Profiles

FastAPI does not have a built-in profile system. Database configuration is typically driven by environment variables:

| ORM / Driver | Package(s) | Connection String Format |
|-------------|-----------|--------------------------|
| SQLAlchemy async + asyncpg | `sqlalchemy[asyncio]`, `asyncpg` | `postgresql+asyncpg://user:pass@host:5432/db` |
| Tortoise ORM | `tortoise-orm`, `asyncpg` | `postgres://user:pass@host:5432/db` |
| SQLModel | `sqlmodel`, `asyncpg` | `postgresql+asyncpg://user:pass@host:5432/db` |
| asyncpg direct | `asyncpg` | `postgresql://user:pass@host:5432/db` |

**Important:** SQLAlchemy async requires the `+asyncpg` suffix in the connection URL scheme (`postgresql+asyncpg://`). Omitting it will default to the synchronous `psycopg2` driver, which blocks the event loop.

### Environment variables for PostgreSQL on AKS

```yaml
env:
  - name: DATABASE_URL
    value: "postgresql+asyncpg://{{IDENTITY_NAME}}@{{PG_SERVER_NAME}}.postgres.database.azure.com:5432/{{DB_NAME}}?sslmode=require"
```

### ConfigMap pattern

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{APP_NAME}}-config
data:
  DATABASE_URL: "postgresql+asyncpg://{{IDENTITY_NAME}}@{{PG_SERVER_NAME}}.postgres.database.azure.com:5432/{{DB_NAME}}?sslmode=require"
  UVICORN_WORKERS: "1"
```

### Workload Identity with azure-identity

See `references/workload-identity.md` for connection patterns. Requires `azure-identity` package.

---

## Writable Paths (DS012 Compliance)

When `readOnlyRootFilesystem: true` is set, FastAPI apps typically only need `/tmp` writable:

- **Uploaded files** use `/tmp` as the default staging directory for `UploadFile`
- **Temporary processing** may write intermediate results to `/tmp`

### Required volume mount

```yaml
volumes:
  - name: tmp
    emptyDir: {}
containers:
  - name: app
    volumeMounts:
      - name: tmp
        mountPath: /tmp
```

No other writable paths are typically needed for production FastAPI apps.

---

## Resource Sizing

FastAPI with Uvicorn is async and lightweight. Size for workload concurrency.

| Resource | Request | Limit |
|----------|---------|-------|
| CPU | 100m | 500m |
| Memory | 128Mi | 256Mi |

---

## Port Configuration

- **Default port:** 8000
- **CLI flag:** `--port 8000` passed to `uvicorn`
- **Env var override:** `PORT` (read via `uvicorn --port $PORT` or `int(os.environ.get("PORT", 8000))`)

Uvicorn logs the port on startup: `Uvicorn running on http://0.0.0.0:8000`

---

## Build Commands

| Tool | Install Command | Output |
|------|----------------|--------|
| pip | `pip install --no-cache-dir -r requirements.txt` | Packages in site-packages |
| Poetry | `poetry install --only main --no-interaction` | Packages in virtualenv |
| uv | `uv sync --frozen --no-dev` | Packages in virtualenv |

The `--no-cache-dir` flag (pip) and `--no-interaction` flag (Poetry) suppress interactive prompts — important for CI/CD and Docker builds.

---

## Common Issues on AKS

| Issue | Symptom | Fix |
|-------|---------|-----|
| Uvicorn workers misconfigured | High latency under load, single-core CPU usage | Set `--workers` to `2 * CPU_CORES + 1` for sync code, or `1` when using async handlers (async code uses a single event loop) |
| Async DB pool exhaustion | `asyncpg.exceptions.TooManyConnectionsError` | Configure pool size with `create_async_engine(pool_size=5, max_overflow=10)` and match PostgreSQL `max_connections` |
| Alpine build fails | `gcc` errors installing `cryptography`, `psycopg2`, `numpy` | Use `python:3.12-slim` (Debian-based) instead of `python:3.12-alpine` |
| Uvicorn binds to localhost | Connection refused from Kubernetes probes | Set `--host 0.0.0.0` — uvicorn defaults to `127.0.0.1` which is unreachable from outside the container |
| Missing uvicorn in production | `ModuleNotFoundError: No module named 'uvicorn'` | Ensure `uvicorn[standard]` is in `requirements.txt` — it is often only in dev dependencies |
