# ACR Workflow for Java

Use the [Java multi-stage Dockerfile](../../../dockerfiles/java.md). Configure `azure.yaml`
with `host: containerapp`, the app `project`, and `docker.path`.

```bash
az acr build --registry <registry> --image <app>:<tag> --file Dockerfile .
```

Cache dependencies in the build stage and copy only the packaged JAR into the runtime image.
