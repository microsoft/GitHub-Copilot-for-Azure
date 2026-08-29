# ACR Workflow for Go

Use the [Go multi-stage Dockerfile](../../../dockerfiles/go.md). Configure `azure.yaml`
with `host: containerapp`, the app `project`, and `docker.path`.

```bash
az acr build --registry <registry> --image <app>:<tag> --file Dockerfile .
```

Build a static binary and use a non-root runtime stage. The Container App identity needs
pull access only.
