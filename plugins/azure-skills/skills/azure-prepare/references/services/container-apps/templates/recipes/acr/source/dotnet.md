# ACR Workflow for .NET

Use the [.NET multi-stage Dockerfile](../../../dockerfiles/dotnet.md). In `azure.yaml`, set
the service `host` to `containerapp`, `project` to the app directory, and
`docker.path` to the Dockerfile. `azd deploy --no-prompt` builds and deploys the image.

For direct quick builds:

```bash
az acr build --registry <registry> --image <app>:<tag> --file Dockerfile .
```

The caller needs Container Registry Tasks Contributor plus push data-plane access.
