# Container Deployment Precheck

Complete every applicable check before running `azd deploy`. Do not use
deployment as a configuration probe.

## 1. Validate the deployment configuration

- `azure.yaml` contains exactly one intended `azure.ai.agent` service.
- The service key and `name:` match.
- `project:` resolves to the expected source directory.
- `codeConfiguration:` is absent and `language: docker` is present.
- Remote build has `docker.remoteBuild: true`.
- Local build has `docker.remoteBuild: false`.
- Pre-built image deployment has a fully qualified `image:` and
  `docker.imagePassthrough: true`.
- A Dockerfile exists for remote and local builds. Its command starts the agent
  server on port 8088.
- `.dockerignore` excludes `.env`, virtual environments, caches, credentials,
  and other local-only files.
- Container CPU, memory, and declared protocols are supported.

Run `azd env get-values` and verify that the project endpoint, project ID, model
deployment, and ACR values match the intended environment.

For a new ACR, these values must be unset before `azd provision`:

```text
AZURE_CONTAINER_REGISTRY_NAME
AZURE_CONTAINER_REGISTRY_ENDPOINT
AZURE_CONTAINER_REGISTRY_RESOURCE_ID
```

To reuse an existing ACR, all three values must identify that registry.

Then run the non-deploying checks:

```bash
azd ai project show --output json
azd ai agent doctor --output json
```

Do not treat a passing `doctor` as proof of ACR build and pull authorization;
perform the explicit checks below.

## 2. Validate ACR and build reachability

- Confirm the selected ACR exists and its login server matches the azd
  environment.
- For remote ACR build, confirm the registry allows ACR Tasks workers. Their
  outbound IP addresses are not predictable; a firewall or private endpoint
  may require local build from an allowed network instead.
- For local build, confirm Docker or Podman is running, supports Linux
  containers, and can reach the registry.
- Confirm the builder can reach the base-image registry and every package feed
  required by the Dockerfile.

For an existing ACR, inspect its resource and network configuration:

```bash
az acr show --ids "<acr-resource-id>" \
  --query "{id:id,loginServer:loginServer,location:location,roleAssignmentMode:roleAssignmentMode,publicNetworkAccess:publicNetworkAccess,networkRuleSet:networkRuleSet}"
```

## 3. Validate developer build and push authorization

Resolve the object ID of the identity that will run `azd deploy`.

- Remote ACR build requires **Container Registry Tasks Contributor**. `AcrPush`
  alone does not grant ACR Tasks build-source upload or `scheduleRun`.
- Local build requires **AcrPush** on a normal RBAC registry, or **Container
  Registry Repository Writer** with the appropriate repository condition on an
  ABAC-mode registry.

Inspect assignments at the ACR scope:

```bash
az role assignment list --assignee "<developer-object-id>" \
  --scope "<acr-resource-id>" \
  --query "[].{role:roleDefinitionName,scope:scope}" -o json
```

For a signed-in user, resolve the object ID with:

```bash
az ad signed-in-user show --query id -o tsv
```

For a service principal or federated CI identity, use its service-principal
object ID, not its application/client ID.

If an assignment is missing, ask before changing RBAC. If the current identity
cannot write role assignments, provide the principal ID, required role, and ACR
scope to an administrator. Do not run `azd deploy` expecting it to repair the
permission.

## 4. Validate Foundry runtime image-pull authorization

The build or push identity is not the runtime pull identity. Resolve the
Foundry project managed identity:

```bash
az resource show --ids "<project-arm-id>" --api-version 2025-06-01 \
  --query identity.principalId -o tsv
```

At the ACR scope, verify that this principal has:

- **AcrPull** for a normal RBAC registry, or
- **Container Registry Repository Reader** with the appropriate repository
  condition for an ABAC-mode registry.

```bash
az role assignment list --assignee "<project-principal-id>" \
  --scope "<acr-resource-id>" \
  --query "[].{role:roleDefinitionName,scope:scope}" -o json
```

`azd` can create the pull assignment only when the deploying identity has
`Microsoft.Authorization/roleAssignments/write`. If it cannot, stop and ask an
administrator to create the assignment before deployment.

## 5. Validate the Docker build

- Check Dockerfile syntax, build context, copied paths, entry point, port 8088,
  and `linux/amd64` compatibility.
- For local build, run the smallest available local build check.
- For remote build, verify ACR Tasks authorization and external build
  dependencies. Do not submit a redundant manual ACR build unless the user
  explicitly requests one.
- On Windows, Azure CLI log streaming can fail with a CP1252
  `UnicodeEncodeError` even when the server-side ACR build succeeds. Set
  `PYTHONUTF8=1` and query the ACR run status before retrying a build.
