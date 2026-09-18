# ACR Workflow for Python

Use the [Python multi-stage Dockerfile](../../../dockerfiles/python.md). Configure
`azure.yaml` with `host: containerapp`, the app `project`, and `docker.path`.

```bash
az acr build --registry <registry> --image <app>:<tag> --file Dockerfile .
```

Use a deployment identity with Container Registry Tasks Contributor and push data-plane
access. The Container App identity needs pull access only.
