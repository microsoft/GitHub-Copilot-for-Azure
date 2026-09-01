# Container Deployment Precheck

Complete every applicable check before running `azd deploy`.

## 1. Select and configure the build path

Default to remote build without asking the user. Use local build only when the
user explicitly requests a local build or requires the image to be built on the
local machine.

| Build path | When to use | `azure.yaml` |
|------------|-------------|--------------|
| Remote build | Default | Set `docker.remoteBuild: true`. |
| Local build | The user explicitly requires local build | Set `docker.remoteBuild: false`. |
| Pre-built image | The user supplies an existing image | Set a fully qualified `image:` and `docker.imagePassthrough: true`. |

## 2. Validate `azure.yaml`

- The intended `azure.ai.agent` service is clearly identified.
- `codeConfiguration:` is absent and `language: docker` is present.
- The selected build path matches the `docker` or `image` configuration.
- Container CPU, memory, and declared protocols are supported.
- `azd env get-values` shows the intended project, model deployment, and ACR.
  For an existing ACR, its name, endpoint, and resource ID identify the same
  registry.

## 3. Validate the container files and code

For remote and local builds:

- The Dockerfile uses the correct build context, copies every required file,
  installs dependencies, and starts the agent server on port 8088.
- `.dockerignore` excludes `.env`, credentials, virtual environments, caches,
  and other local-only files without excluding required application files.
- The entry point and dependency files match the application source.

## 4. Validate ACR permissions

Verify every applicable operation at the target ACR scope:

| Operation | Identity | Required access |
|-----------|----------|-----------------|
| Remote build | Identity running `azd deploy` | Build-source upload and task execution permissions provided by **Container Registry Tasks Contributor** or equivalent |
| Local build and push | Identity running `azd deploy` | Image push permission provided by **AcrPush**, **Container Registry Repository Writer**, or equivalent |
| Runtime image pull | Foundry project managed identity | The Container Registry connection targets the selected ACR and uses this identity, which has **AcrPull**, **Container Registry Repository Reader**, or equivalent |

Run `azd ai agent doctor --output json` to catch known configuration and
permission issues. Ask before changing RBAC; if required access is missing,
report the principal, role, and ACR scope to an administrator.
