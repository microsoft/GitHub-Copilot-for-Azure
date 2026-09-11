# Python Dockerfile

```dockerfile
FROM python:3.13-slim AS build
WORKDIR /build
COPY requirements.txt .
RUN python -m venv /venv && /venv/bin/pip install --no-cache-dir -r requirements.txt

FROM python:3.13-slim AS runtime
ENV PATH="/venv/bin:$PATH" PYTHONUNBUFFERED=1
RUN useradd --create-home app
WORKDIR /app
COPY --from=build /venv /venv
COPY --chown=app:app . .
USER app
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "main:app"]
```

Use an ASGI worker for FastAPI, for example
`gunicorn -k uvicorn.workers.UvicornWorker`, and align `targetPort` with `8000`.
