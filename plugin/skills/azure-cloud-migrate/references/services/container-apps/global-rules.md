# Global Rules — Container Apps Migrations

These rules apply to ALL phases of container migration to Azure Container Apps.

## Destructive Action Policy

⛔ **NEVER** perform destructive actions without explicit user confirmation via `ask_user`:
- Deleting container images, registries, or repositories
- Overwriting existing Dockerfiles or compose files
- Deploying to production environments
- Modifying existing Azure resources
- Removing source cloud resources (ECS services, Cloud Run services)

## User Confirmation Required

Always use `ask_user` before:
- Selecting Azure subscription
- Selecting Azure region/location
- Deploying infrastructure
- Choosing between Consumption and Dedicated plans
- Making breaking changes to existing container configurations

## Best Practices

- Always use `mcp_azure_mcp_get_bestpractices` tool before generating Azure code
- Prefer managed identity over connection strings or API keys
- **Always use the latest stable base images** — check official images for newest GA tags
- Follow Azure naming conventions (`ca-`, `cae-`, `acr-` prefixes)
- Use Consumption plan unless workload requires dedicated resources
- Enable Dapr only when service-to-service communication patterns require it

## Identity-First Authentication (Zero API Keys)

> Enterprise subscriptions commonly enforce policies that block local auth. Always design for identity-based access from the start.

- **Container Registry**: Use managed identity for ACR pull — assign `AcrPull` role
- **Storage accounts**: Set `allowSharedKeyAccess: false`. Use identity-based connections
- **Key Vault**: Use managed identity + RBAC (`Key Vault Secrets User`) instead of access policies
- **Application Insights**: Set `disableLocalAuth: true`. Use `APPLICATIONINSIGHTS_AUTHENTICATION_STRING` with AAD auth
- **DefaultAzureCredential with UAMI**: When using User Assigned Managed Identity, always pass `managedIdentityClientId`:
  ```javascript
  const credential = new DefaultAzureCredential({
    managedIdentityClientId: process.env.AZURE_CLIENT_ID
  });
  ```

## Container Apps Specifics

- **Ingress**: Always configure ingress for HTTP-serving containers. Set `external: true` for public, `external: false` for internal-only
- **Secrets**: Use Key Vault references for sensitive values — do NOT embed secrets in container env vars or YAML
- **Scaling rules**: Map source autoscaling (ECS Service Auto Scaling, Cloud Run concurrency) to Container Apps scale rules (HTTP, queue, custom)
- **Revisions**: Use revision-scope changes for zero-downtime deployments
- **Health probes**: Always configure liveness and readiness probes matching source health checks
- **VNet integration**: When source uses private networking (VPC, VPC Connectors), configure Container Apps Environment with VNet integration

## Output Directory

All migration output goes to `<source-folder>-azure/` at workspace root. Never modify the source directory.
