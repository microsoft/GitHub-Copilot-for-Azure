# Quick Deploy

Deploy an application to an existing AKS cluster with production-grade artifacts.

## Goal

Detect the application framework and Azure infrastructure, generate production-ready deployment artifacts, validate against AKS Deployment Safeguards, deploy, and verify — with minimal questions.

---

## Section 1: Detection

Scan the project and Azure environment. Ask at most one clarifying question (only if genuinely ambiguous: multiple Dockerfiles, multiple ACRs, multiple identities).

### Framework Detection

Follow the framework detection table in `references/detection.md`. Scan for signal files at the project root (and one level deep for monorepos).

### Port Detection

Follow the port detection table in `references/detection.md` (first match wins).

### Health Endpoint Detection

Follow the health endpoint detection table in `references/detection.md`. If none found, use `/health` as default in probes.

### Existing Artifact Detection

Check for existing `Dockerfile` and `k8s/` (or `manifests/`, `deploy/`) directories.

### Azure Infrastructure Detection

```bash
kubectl config current-context
az aks show -g <rg> -n <cluster> -o json
```

Extract from cluster details:
- **AKS flavor**: `nodeProvisioningProfile.mode` — `"Auto"` = AKS Automatic, otherwise = AKS Standard
- **OIDC issuer**: `oidcIssuerProfile.issuerUrl`
- **Azure RBAC**: `aadProfile.enableAzureRBAC`

### Routing Detection

Determine whether the cluster uses Gateway API or Ingress — this applies to **both** AKS Automatic and Standard:

```bash
az aks show -g <rg> -n <cluster> --query '{webAppRoutingEnabled: ingressProfile.webAppRouting.enabled, istioMode: serviceMeshProfile.istio.mode}' -o json
```

- If `webAppRoutingEnabled` is not `true`, stop with error and provide the enable command: `az aks approuting enable -g <rg> -n <cluster>`
- If `istioMode` is `"Enabled"` → use **Gateway API** (`gateway.yaml` + `httproute.yaml`, `gatewayClassName: istio`)
- Otherwise → use **Ingress** (`ingress.yaml`, `ingressClassName: webapprouting.kubernetes.azure.com`)

> **Note:** AKS Automatic defaults to NGINX/Ingress (same as Standard). Gateway API via Istio is an optional mode on both flavors.

```bash
az acr list -g <rg> -o json
az identity list -g <rg> -o json
```

### ACR-AKS Integration

Verify the AKS kubelet identity can pull images from the detected ACR:

```bash
az aks check-acr --resource-group <rg> --name <cluster> --acr <acr-name>.azurecr.io
```

If the check fails, attach the ACR to the cluster (requires confirmation):

```bash
az aks update -g <rg> -n <cluster> --attach-acr <acr-name>
```

**RBAC check** — if Azure RBAC is enabled:

```bash
kubectl auth can-i create namespaces
```

If `no`, stop with error. Offer alternatives: have admin create the namespace, or deploy to an existing namespace.

If any Azure CLI or kubectl command fails during detection, stop with the error and suggest common fixes: `az login`, `az account set -s <subscription-id>`, `az aks get-credentials -g <rg> -n <cluster>`.

### Knowledge Pack

After framework detection, load the matching pack from `knowledge-packs/frameworks/` if available:

`spring-boot`, `express`, `nextjs`, `fastapi`, `django`, `nestjs`, `aspnet-core`, `go`, `flask`

Knowledge packs influence Dockerfile optimization, probe configuration, and writable path requirements.

---

## Section 2: File Generation

Write all files in a single response turn (batch file writes).

### Dockerfile

**If existing Dockerfile:** Validate against best practices (multi-stage build, non-root USER, pinned base tags, layer caching, .dockerignore). Apply targeted fixes for failures — do not regenerate the file.

**If no Dockerfile:** Generate from the appropriate template:

| Language | Template |
|----------|----------|
| Node.js | `templates/dockerfiles/node.Dockerfile` |
| Python | `templates/dockerfiles/python.Dockerfile` |
| Java | `templates/dockerfiles/java.Dockerfile` |
| Go | `templates/dockerfiles/go.Dockerfile` |
| .NET | `templates/dockerfiles/dotnet.Dockerfile` |
| Rust | `templates/dockerfiles/rust.Dockerfile` |

Generate `.dockerignore` if missing — use the matching template from `templates/dockerfiles/<language>.dockerignore`.

### Kubernetes Manifests

**If existing manifests found** (in `k8s/`, `manifests/`, or `deploy/` directories): Validate them against AKS Deployment Safeguards (Section 3) and apply targeted fixes. Do not regenerate files that already exist — improve them in place.

**If no manifests found:** Generate from `templates/k8s/` templates. Replace `<angle-bracket>` placeholders with detected values.

| Manifest | Template | Notes |
|----------|----------|-------|
| `k8s/namespace.yaml` | `templates/k8s/namespace.yaml` | |
| `k8s/serviceaccount.yaml` | `templates/k8s/serviceaccount.yaml` | Workload Identity annotation |
| `k8s/deployment.yaml` | `templates/k8s/deployment.yaml` | Image placeholder resolved at deploy time |
| `k8s/service.yaml` | `templates/k8s/service.yaml` | |
| `k8s/gateway.yaml` | `templates/k8s/gateway.yaml` | Only if Istio Gateway API detected |
| `k8s/httproute.yaml` | `templates/k8s/httproute.yaml` | Only if Istio Gateway API detected |
| `k8s/ingress.yaml` | `templates/k8s/ingress.yaml` | Only if using Ingress (default for both flavors) |
| `k8s/hpa.yaml` | `templates/k8s/hpa.yaml` | min: 2, max: 10 |
| `k8s/pdb.yaml` | `templates/k8s/pdb.yaml` | minAvailable: 1 |
| `k8s/configmap.yaml` | `templates/k8s/configmap.yaml` | Only if app needs environment-specific config |
| `k8s/networkpolicy.yaml` | `templates/k8s/networkpolicy.yaml` | Restricts ingress to the ingress controller namespace |

### Hostname

For initial deployments without a custom domain, **omit the `host` field** from the Ingress `rules` (or Gateway `listeners`) so traffic routes to the external IP directly. Once the user has a domain, they can add `host` and TLS configuration later.

### Resource Sizing

Use the framework-specific defaults from the knowledge pack's "Resource Sizing" section. If no knowledge pack is loaded, use these general defaults:

| Resource | Request | Limit |
|----------|---------|-------|
| CPU | 100m | 500m |
| Memory | 128Mi | 256Mi |

### Startup Probe

For slow-start frameworks (Java/Spring Boot, .NET with heavy DI), uncomment the `startupProbe` in the deployment template. This prevents the liveness probe from killing the pod before initialization completes.

---

## Section 3: Safeguards Validation

Before deploying, validate all generated manifests against AKS Deployment Safeguards DS001-DS013. Reference `references/safeguards.md` for the full checklist.

- 12 of 13 rules are auto-fixable. DS009 (no `:latest` tag) is resolved by tagging with git SHA.
- Apply framework-specific writable path requirements from the knowledge pack (e.g., Spring Boot needs `/tmp`, Next.js needs `/app/.next/cache`).
- Reference `references/workload-identity.md` for Workload Identity configuration.

**AKS Automatic:** Safeguards are always enforced — all violations must be fixed.

**AKS Standard:** Check `safeguardsProfile.level`:
```bash
az aks show -g <rg> -n <cluster> --query 'safeguardsProfile.level' -o tsv
```
- `Enforcement`: fix all violations
- `Warning` or `Off`: mention issues as warnings, don't block

---

## Section 4: Deploy

### Ensure kubectl context

```bash
az aks get-credentials -g <resource_group> -n <aks_cluster_name> --overwrite-existing
```

### Verify Gateway API CRDs (only if Istio Gateway API detected)

```bash
kubectl get crd gateways.gateway.networking.k8s.io httproutes.gateway.networking.k8s.io 2>/dev/null
```

If missing: `kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.0.0/standard-install.yaml`

### Build and push

```bash
IMAGE_TAG=$(git rev-parse --short HEAD)   # fallback: date +%Y%m%d%H%M%S
az acr build --registry <acr_name> --image <app-name>:$IMAGE_TAG --file Dockerfile .
```

**Monorepo:** If the app is not at the repository root, adjust the build context and Dockerfile path:

```bash
az acr build --registry <acr_name> --image <app-name>:$IMAGE_TAG --file apps/myapp/Dockerfile apps/myapp/
```

### Deploy to cluster

```bash
# 1. Create namespace (must succeed before proceeding)
kubectl apply -f k8s/namespace.yaml
kubectl get namespace <namespace> -o name   # verify

# 2. Apply remaining manifests
kubectl apply -f k8s/ --recursive

# 3. Wait for rollout
kubectl rollout status deployment/<app-name> -n <namespace> --timeout=300s
```

If any step fails, show the error and stop. Reference `references/rollback.md` for recovery procedures.

---

## Section 5: Verify

```bash
kubectl get pods -n <namespace> -l app=<app-name>
kubectl get gateway -n <namespace> -o jsonpath='{.items[0].status.addresses[0].value}'  # if Gateway API
kubectl get ingress -n <namespace> -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}'  # if Ingress
```

Wait up to 3 minutes for external IP. Once available, curl the health endpoint.
