# GCP Cloud Run to Azure Container Apps Migration

## Service Mapping

| GCP Service | Azure Equivalent |
|-------------|------------------|
| Cloud Run Service | Container App |
| Cloud Run Revision | Container App revision |
| Cloud Run Jobs | Container Apps Jobs |
| Artifact Registry / GCR | Azure Container Registry (ACR) |
| Cloud Load Balancing | Container Apps ingress |
| Cloud Run service-to-service | Container Apps internal DNS / Dapr |
| Cloud Run domain mapping | Container Apps custom domains |
| Cloud Logging | Log Analytics |
| Cloud Monitoring | Azure Monitor Metrics |
| Cloud Trace | Application Insights (distributed tracing) |
| IAM service account | Managed Identity + RBAC |
| Secret Manager | Azure Key Vault |
| VPC Connector | Container Apps VNet integration |
| Pub/Sub | Azure Service Bus / Event Grid |
| Cloud Storage | Azure Blob Storage |
| Cloud SQL | Azure Database for PostgreSQL / MySQL |
| Firestore | Azure Cosmos DB |
| Cloud Scheduler | Container Apps Jobs (scheduled) |
| Cloud Build | Azure DevOps Pipelines / GitHub Actions |
| Terraform (GCP) | Bicep / Terraform (Azure) |

## Cloud Run Service → Container App

### Cloud Run service YAML (source)

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: my-api
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        autoscaling.knative.dev/minScale: "1"
        run.googleapis.com/cpu-throttling: "false"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
        - image: us-docker.pkg.dev/my-project/my-repo/my-api:v1
          ports:
            - containerPort: 8080
          resources:
            limits:
              cpu: "1"
              memory: 512Mi
          env:
            - name: NODE_ENV
              value: production
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: latest
                  name: db-password
          startupProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 0
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 10
```

### Container App YAML (target)

```yaml
properties:
  configuration:
    ingress:
      external: true
      targetPort: 8080
      transport: auto
    secrets:
      - name: db-password
        keyVaultUrl: https://myvault.vault.azure.net/secrets/db-password
        identity: <managed-identity-resource-id>
    registries:
      - server: myacr.azurecr.io
        identity: <managed-identity-resource-id>
    maxInactiveRevisions: 5
  template:
    containers:
      - image: myacr.azurecr.io/my-api:v1
        name: my-api
        resources:
          cpu: 1.0
          memory: 512Mi
        env:
          - name: NODE_ENV
            value: production
          - name: DB_PASSWORD
            secretRef: db-password
        probes:
          - type: startup
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 5
          - type: liveness
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 10
    scale:
      minReplicas: 1
      maxReplicas: 10
      rules:
        - name: concurrent-requests
          http:
            metadata:
              concurrentRequests: "80"
```

## Cloud Run Jobs → Container Apps Jobs

| Cloud Run Jobs | Container Apps Jobs |
|---------------|---------------------|
| Job execution | Job execution |
| Task count | `parallelism` + `replicaCompletionCount` |
| Task timeout | `replicaTimeout` |
| Max retries | `replicaRetryLimit` |
| Scheduled via Cloud Scheduler | `triggerType: Schedule` with cron |
| On-demand execution | `triggerType: Manual` |
| Event-triggered | `triggerType: Event` |

### Scheduled Job Example

```yaml
properties:
  configuration:
    triggerType: Schedule
    scheduleTriggerConfig:
      cronExpression: "0 */6 * * *"
      parallelism: 1
      replicaCompletionCount: 1
    registries:
      - server: myacr.azurecr.io
        identity: <managed-identity-resource-id>
  template:
    containers:
      - image: myacr.azurecr.io/batch-job:v1
        name: batch-job
        resources:
          cpu: 1.0
          memory: 2Gi
        env:
          - name: JOB_MODE
            value: scheduled
```

## Concurrency & Scaling

| Cloud Run Setting | Container Apps Equivalent |
|-------------------|--------------------------|
| `containerConcurrency: 80` | HTTP scale rule `concurrentRequests: "80"` |
| `minScale: 0` (scale to zero) | `minReplicas: 0` |
| `maxScale: 10` | `maxReplicas: 10` |
| `cpu-throttling: false` (always-on CPU) | Consumption plan default behavior |
| Pub/Sub push scaling | Queue-based scale rule |
| Scheduled execution | KEDA cron scale rule |

## Networking

| Cloud Run | Container Apps |
|-----------|---------------|
| Public HTTPS endpoint | `external: true` ingress |
| Internal-only | `external: false` ingress |
| VPC Connector | VNet-integrated Container Apps Environment |
| Cloud Run → Cloud SQL (private IP) | VNet integration + private endpoint |
| Custom domain | Custom domain binding + managed certificate |
| gRPC support | Ingress with `transport: http2` |

## Secret Manager → Key Vault

| GCP Pattern | Azure Pattern |
|-------------|---------------|
| `secretKeyRef` in YAML | `secretRef` + Key Vault reference |
| Secret version `latest` | Key Vault secret (latest version) |
| Secret version pinning | Key Vault secret version URI |
| IAM `secretAccessor` role | `Key Vault Secrets User` RBAC role |
| Per-service secret access | Managed Identity scoped to Key Vault |

## IAM Service Account → Managed Identity

| GCP IAM | Azure RBAC |
|---------|------------|
| Cloud Run service account | User Assigned Managed Identity |
| `roles/storage.objectViewer` | `Storage Blob Data Reader` |
| `roles/pubsub.subscriber` | `Service Bus Data Receiver` |
| `roles/secretmanager.secretAccessor` | `Key Vault Secrets User` |
| `roles/cloudsql.client` | Database-specific RBAC |
| `roles/logging.logWriter` | `Monitoring Metrics Publisher` |

## Artifact Registry → ACR

```bash
# Import directly (no local Docker needed)
az acr import --name <acr-name> \
  --source <region>-docker.pkg.dev/<project>/<repo>/<image>:<tag> \
  --username _json_key \
  --password "$(cat gcp-service-account-key.json)"

# Configure managed identity pull
az role assignment create \
  --assignee <managed-identity-principal-id> \
  --role AcrPull \
  --scope <acr-resource-id>
```

## Monitoring Mapping

| GCP | Azure | Notes |
|-----|-------|-------|
| Cloud Logging | Log Analytics | Container stdout/stderr auto-collected |
| Cloud Monitoring metrics | Azure Monitor Metrics | Built-in CPU, memory, requests |
| Cloud Monitoring alerts | Azure Monitor Alerts | KQL-based alert rules |
| Cloud Trace | Application Insights | Distributed tracing via OpenTelemetry |
| Error Reporting | Application Insights exceptions | Auto-capture with SDK |

## Key Differences

| Feature | Cloud Run | Container Apps |
|---------|-----------|---------------|
| Scale-to-zero | Default behavior | `minReplicas: 0` |
| Cold start | Startup CPU boost | Startup probe |
| Request timeout | 3600s max | 240s default (configurable) |
| Concurrency model | Per-instance | Per-replica (HTTP scale rules) |
| gRPC | Native support | `transport: http2` |
| WebSockets | Supported | Supported with sticky sessions |
| GPU | Supported (limited) | Dedicated workload profiles |
| Jobs | Cloud Run Jobs | Container Apps Jobs |

## Reference Links

- [Container Apps overview](https://learn.microsoft.com/en-us/azure/container-apps/overview) · [Jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs)
- [Ingress](https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview) · [VNet](https://learn.microsoft.com/en-us/azure/container-apps/vnet-custom) · [Scale rules](https://learn.microsoft.com/en-us/azure/container-apps/scale-app)
- [Secrets / Key Vault](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets) · [Custom domains](https://learn.microsoft.com/en-us/azure/container-apps/custom-domains-managed-certificates)
