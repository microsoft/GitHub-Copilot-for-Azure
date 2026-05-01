# Code Migration Phase — Container Apps

Migrate container workloads to Azure Container Apps configuration and code.

## Prerequisites

- Assessment report completed
- Best practices loaded via `mcp_azure_mcp_get_bestpractices` tool
- ACR instance provisioned (or planned in IaC)

## Rules

- Never modify the source directory — all output goes to `<source-folder>-azure/`
- Preserve existing Dockerfiles when possible — optimize, don't rewrite
- Use managed identity for all Azure service connections
- Configure health probes for every container
- Use Key Vault references for secrets — never embed in container specs

## Steps

1. **Load Best Practices** — Use `mcp_azure_mcp_get_bestpractices` tool for Container Apps guidance
2. **Create Project Structure** — Set up output directory with Container Apps configuration
3. **Optimize Dockerfiles** — Apply multi-stage builds, minimize image size
4. **Generate Container App YAML** — Convert source specs to Container Apps manifests
5. **Map Environment Variables** — Convert env vars to Container Apps secrets + env config
6. **Configure Ingress** — Map load balancers and routing to Container Apps ingress
7. **Configure Scaling** — Convert autoscaling rules to Container Apps scale rules
8. **Set Up Health Probes** — Map health checks to liveness/readiness/startup probes
9. **Configure Service Discovery** — Map service mesh / service connect to Dapr or internal DNS

## Dockerfile Analysis

### Multi-Stage Build Pattern

```dockerfile
# ✅ Recommended: Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

### Image Optimization Checklist

| Check | Action |
|-------|--------|
| Use `-alpine` or `-slim` base images | Reduces image size by 50-80% |
| Multi-stage builds | Separate build and runtime stages |
| `.dockerignore` exists | Exclude `node_modules`, `.git`, tests |
| No secrets in image | Use env vars or mounted secrets at runtime |
| Non-root user | Add `USER node` or `USER appuser` |
| Fixed base image tags | Pin versions, avoid `latest` tag |

## Container App YAML Structure

```yaml
properties:
  configuration:
    ingress:
      external: true
      targetPort: 8080
      transport: auto
      allowInsecure: false
    secrets:
      - name: db-connection
        keyVaultUrl: https://<vault>.vault.azure.net/secrets/db-connection
        identity: <managed-identity-resource-id>
    registries:
      - server: <acr-name>.azurecr.io
        identity: <managed-identity-resource-id>
  template:
    containers:
      - image: <acr-name>.azurecr.io/<app>:latest
        name: <app>
        resources:
          cpu: 0.5
          memory: 1Gi
        env:
          - name: DATABASE_URL
            secretRef: db-connection
          - name: PORT
            value: "8080"
        probes:
          - type: liveness
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          - type: readiness
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 3
            periodSeconds: 5
    scale:
      minReplicas: 1
      maxReplicas: 10
      rules:
        - name: http-scaling
          http:
            metadata:
              concurrentRequests: "50"
```

## Environment Variable Mapping

| Source Pattern | Container Apps Equivalent |
|---------------|--------------------------|
| Hardcoded secret in env | Key Vault secret reference |
| Service endpoint URL | Managed identity + env var |
| API key / connection string | Key Vault secret reference |
| Feature flag | Plain env var |
| Port configuration | `targetPort` in ingress config |

## Health Probe Mapping

| Source | Container Apps |
|--------|---------------|
| ECS `healthCheck` | `probes` with `type: liveness` |
| Cloud Run startup probe | `probes` with `type: startup` |
| ALB target group health | `probes` with `type: readiness` |
| Docker `HEALTHCHECK` | `probes` with `type: liveness` |
| Custom TCP check | `tcpSocket` probe |

## Registry Migration

### Push images to ACR

```bash
# Login to ACR
az acr login --name <acr-name>

# Tag and push
docker tag <source-image>:<tag> <acr-name>.azurecr.io/<image>:<tag>
docker push <acr-name>.azurecr.io/<image>:<tag>
```

### ACR import (no local Docker required)

```bash
# Import from public registry
az acr import --name <acr-name> \
  --source docker.io/library/nginx:latest \
  --image nginx:latest

# Import from ECR (with credentials)
az acr import --name <acr-name> \
  --source <account>.dkr.ecr.<region>.amazonaws.com/<image>:<tag> \
  --username AWS --password $(aws ecr get-login-password)

# Import from GCP Artifact Registry
az acr import --name <acr-name> \
  --source <region>-docker.pkg.dev/<project>/<repo>/<image>:<tag> \
  --username _json_key --password "$(cat key.json)"
```

## Handoff to azure-prepare

After code migration is complete:

1. Update `migration-status.md` — mark Code Migration as ✅ Complete
2. Invoke **azure-prepare** — pass the assessment report context so it can:
   - Use the service mapping as requirements input
   - Generate IaC (Bicep/Terraform) for Container Apps Environment, apps, and ACR
   - Create `azure.yaml` and `.azure/preparation-manifest.md`
   - Apply security hardening
3. azure-prepare will then chain to **azure-validate** → **azure-deploy**
