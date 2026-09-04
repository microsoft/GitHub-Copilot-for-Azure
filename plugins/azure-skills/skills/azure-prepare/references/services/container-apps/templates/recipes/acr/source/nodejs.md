# ACR Workflow for Node.js / TypeScript

Use the [Node.js multi-stage Dockerfile](../../../dockerfiles/node.md). Configure
`azure.yaml` with `host: containerapp`, the app `project`, and `docker.path`.

```bash
az acr build --registry <registry> --image <app>:<tag> --file Dockerfile .
```

Keep dev dependencies in the build stage and run the runtime image as the `node` user.
