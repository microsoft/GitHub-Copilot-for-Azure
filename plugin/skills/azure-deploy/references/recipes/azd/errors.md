# AZD Errors

## Deployment Runtime Errors

These errors occur **during** `azd up` execution:

| Error | Cause | Resolution |
|-------|-------|------------|
| `unknown flag: --location` | `azd up` doesn't accept `--location` | Use `azd env set AZURE_LOCATION <region>` before `azd up` |
| Provision failed | Bicep template errors | Check detailed error in output |
| Deploy failed | Build or Docker errors | Check build logs |
| Package failed | Missing Dockerfile or deps | Verify Dockerfile exists and dependencies |
| Quota exceeded | Subscription limits | Request increase or change region |
| `PrincipalId '...' has type 'ServicePrincipal', which is different from specified PrincipalType 'User'` | Base template RBAC assigns roles with `principalType: 'User'` but deploying identity is a service principal (CI/CD) | Set `allowUserIdentityPrincipal: false` in the `storageEndpointConfig` variable in `infra/main.bicep`. Do NOT try clearing `AZURE_PRINCIPAL_ID` — azd repopulates it. See [Principal Type Mismatch](#principal-type-mismatch). |
| `ImagePullBackOff` or `azd up` hangs during provision for Container Apps | Container App references an image that doesn't exist in ACR yet | See [Container Apps Bootstrap Problem](#container-apps-bootstrap-problem) |
| `unauthorized: authentication required` on `docker push` to ACR | ACR auth token expired or scoped incorrectly | See [ACR Authentication Failures](#acr-authentication-failures) |
| `could not determine container registry endpoint` | Missing `AZURE_CONTAINER_REGISTRY_ENDPOINT` | See [Missing Container Registry Variables](#missing-container-registry-variables) |
| `map has no entry for key "AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID"` | Missing managed identity env vars | See [Missing Container Registry Variables](#missing-container-registry-variables) |
| `map has no entry for key "MANAGED_IDENTITY_CLIENT_ID"` | Missing managed identity client ID | See [Missing Container Registry Variables](#missing-container-registry-variables) |
| `found '2' resources tagged with 'azd-service-name: <name>'` | Previous deployment left duplicate-tagged resources in same RG | **Preferred**: Create fresh env with `azd env new <new-name>`, set subscription/location, redeploy. **Alternative**: Delete conflicting resources (requires `ask_user`). |

> ℹ️ **Pre-flight validation**: Run `azure-validate` before deployment to catch configuration errors early. See [Pre-Deploy Checklist](../../pre-deploy-checklist.md).

## Container Apps Bootstrap Problem

**Symptom:** `azd up` hangs or fails during provisioning with `ImagePullBackOff`, or the Container App cannot start because the referenced image doesn't exist in ACR yet.

**Cause:** The Bicep template creates the Container App referencing an ACR image, but that image doesn't exist until `azd deploy` builds and pushes it. This chicken-and-egg problem blocks provisioning.

**Solution — use two-phase deployment:**

```bash
# Phase 1: Provision infrastructure (Container App uses placeholder image)
azd provision --no-prompt

# Phase 2: Build, push, and update Container App with real image
azd deploy --no-prompt
```

> ⚠️ This requires the Bicep template to use a placeholder image parameter (e.g., `mcr.microsoft.com/azuredocs/containerapps-helloworld:latest`) so provisioning succeeds without the app image. If the Bicep hardcodes the ACR image reference, update it to accept a `containerImageName` parameter with a placeholder default before provisioning.

> ⚠️ Do **NOT** repeatedly poll a hanging `azd up` — if there is no provisioning progress or you continue to see `ImagePullBackOff` events for several minutes during a Container Apps deployment, stop it and switch to the two-phase approach above.

## ACR Authentication Failures

**Symptom:** `docker push` fails with `unauthorized: authentication required` even after `az acr login` succeeds.

**Solution — try these methods in order:**

```bash
# Method 1: AAD-based login (preferred)
az acr login --name <acr-name>
docker push <acr-name>.azurecr.io/<image>:<tag>

# Method 2: Admin credentials (fallback)
ACR_USER=$(az acr credential show --name <acr-name> --query username -o tsv)
ACR_PASS=$(az acr credential show --name <acr-name> --query "passwords[0].value" -o tsv)
docker login <acr-name>.azurecr.io -u "$ACR_USER" -p "$ACR_PASS"
docker push <acr-name>.azurecr.io/<image>:<tag>
```

> 💡 **Tip:** Prefer `azd deploy` over manual `docker push` — azd handles ACR authentication automatically.

## Missing Container Registry Variables

**Symptom:** Errors during `azd deploy` about missing container registry or managed identity environment variables:

```
ERROR: could not determine container registry endpoint, ensure 'registry' has been set in the docker options or 'AZURE_CONTAINER_REGISTRY_ENDPOINT' environment variable has been set
```

Or:

```
ERROR: failed executing template file: template: manifest template:6:14: executing "manifest template" at <.Env.AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID>: map has no entry for key "AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID"
```

Or:

```
ERROR: failed executing template file: template: manifest template:39:26: executing "manifest template" at <.Env.MANAGED_IDENTITY_CLIENT_ID>: map has no entry for key "MANAGED_IDENTITY_CLIENT_ID"
```

**Cause:** This typically occurs with .NET Aspire projects using azd "limited mode" (in-memory infrastructure generation without explicit `infra/` folder). The `azd provision` command creates the Azure Container Registry and Managed Identity resources but doesn't automatically populate the environment variables that `azd deploy` needs to reference them.

> ⚠️ **Prevention is Better:** For .NET Aspire projects, this issue should be addressed PROACTIVELY before deployment by setting up environment variables after `azd init` but before `azd up`. This avoids deployment failures entirely.

**Solution:**

After `azd provision` succeeds, manually set the missing environment variables by querying the provisioned resources:

```bash
# Get the resource group name (typically rg-{environment-name})
azd env get-values

# Set container registry endpoint
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT $(az acr list --resource-group <resource-group-name> --query "[0].loginServer" -o tsv)

# Set managed identity resource ID
azd env set AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID $(az identity list --resource-group <resource-group-name> --query "[0].id" -o tsv)

# Set managed identity client ID
azd env set MANAGED_IDENTITY_CLIENT_ID $(az identity list --resource-group <resource-group-name> --query "[0].clientId" -o tsv)
```

**PowerShell:**
```powershell
# Set container registry endpoint
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT (az acr list --resource-group <resource-group-name> --query "[0].loginServer" -o tsv)

# Set managed identity resource ID
azd env set AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID (az identity list --resource-group <resource-group-name> --query "[0].id" -o tsv)

# Set managed identity client ID
azd env set MANAGED_IDENTITY_CLIENT_ID (az identity list --resource-group <resource-group-name> --query "[0].clientId" -o tsv)
```

After setting these variables, retry the deployment:
```bash
azd deploy --no-prompt
```

> 💡 **Tip:** This issue is specific to Aspire limited mode. Manually setting these environment variables after `azd provision` is the recommended workaround.

## Retry

After fixing the issue:
```bash
azd up --no-prompt
```

## Principal Type Mismatch

**Symptom:** `azd up` fails during provisioning with:

```
PrincipalId '...' has type 'ServicePrincipal', which is different from specified PrincipalType 'User'
```

**Cause:** Many AZD templates (e.g., `functions-quickstart-python-http-azd`) include RBAC role assignments for the deploying user with hardcoded `principalType: 'User'`. This is controlled by an `allowUserIdentityPrincipal` flag in `main.bicep`'s `storageEndpointConfig` variable. When deploying from CI/CD with a service principal, `azd` sets `AZURE_PRINCIPAL_ID` to that service principal's object ID, but the Bicep still tries to create a role assignment with `principalType: 'User'`, causing ARM to reject it.

**Solution:**

In `infra/main.bicep`, find the `storageEndpointConfig` variable and set `allowUserIdentityPrincipal` to `false`:

```bicep
var storageEndpointConfig = {
  enableBlob: true
  enableQueue: false
  enableTable: false
  enableFiles: false
  allowUserIdentityPrincipal: false  // Set to false for service principal deployments
}
```

> ⚠️ **Do NOT** try to fix this by running `azd env set AZURE_PRINCIPAL_ID ""`. The `azd` CLI repopulates this value from the current auth context, so clearing it has no effect.

## Cleanup (DESTRUCTIVE)

```bash
azd down --force --purge
```

⚠️ Permanently deletes ALL resources including databases and Key Vaults.
