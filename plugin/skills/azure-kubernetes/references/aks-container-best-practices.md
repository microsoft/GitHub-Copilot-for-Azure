# AKS Container Best Practices Reference

This reference provides a comprehensive set of container-level best-practice checks that can be validated via `kubectl` and `az` CLI commands against an AKS cluster. These checks complement the cluster-level and platform-level controls in the [AKS Checklist Matrix](./aks-checklist-matrix.md) by diving deeper into container runtime configuration, image hygiene, security context, resource management, health probes, lifecycle hooks, and pod-level security controls.

## Purpose

The existing checklist matrix validates many controls at a high level (e.g., "workloads define resource requests/limits"). This reference provides granular, field-level validation commands that systematically audit every container across all namespaces. The goal is to surface containers that violate specific best-practice rules so the audit report can quantify non-compliance and provide targeted remediation.

## Extraction Strategy

### General Approach

1. **Namespace enumeration**: Determine the set of namespaces in scope. By default, assess all non-system namespaces. System namespaces (`kube-system`, `kube-node-lease`, `kube-public`, `gatekeeper-system`) are reported separately since they contain platform-managed workloads with different security constraints.
2. **Workload enumeration**: For each namespace, enumerate Deployments, StatefulSets, DaemonSets, Jobs, and CronJobs. Avoid assessing naked Pods directly (they are flagged separately as a best-practice violation).
3. **Container-level extraction**: For each workload, extract container specs (including init containers and ephemeral containers) and validate against the checks below.
4. **Aggregation**: Produce per-namespace and cluster-wide summaries showing the count and percentage of containers that pass or fail each check.

### Command Compatibility

- All commands use `kubectl -o jsonpath` or `kubectl -o json` for structured output.
- On Windows, use `findstr` instead of `grep` where text filtering is needed.
- Where `jq` is referenced as an ideal approach, a `kubectl -o jsonpath` alternative is always provided.
- Replace `<kubeContext>` with the target cluster context in all commands.

## Container Best-Practice Checks

### Image Hygiene

| Check ID | Category | Checklist Item | Validation Commands | Reference |
| --- | --- | --- | --- | --- |
| CTR-IMG-01 | Image Hygiene | Container images do not use the `:latest` tag or omit a tag entirely | `kubectl get pods -A -o jsonpath="{range .items[*]}{range .spec.containers[*]}{.image}{'\n'}{end}{end}" --context <kubeContext> \| findstr /i ":latest"` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-container-image-management#use-meaningful-image-tags> |
| CTR-IMG-02 | Image Hygiene | Images use immutable tags or digests for production workloads | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.image}{', '}{end}{'\n'}{end}" --context <kubeContext>` — check for digest references (`@sha256:`) vs mutable tags | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-container-image-management> |
| CTR-IMG-03 | Image Hygiene | ImagePullPolicy is set explicitly and appropriately (Always for mutable tags, IfNotPresent for immutable/digest) | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'='}{.imagePullPolicy}{', '}{end}{'\n'}{end}" --context <kubeContext>` | <https://kubernetes.io/docs/concepts/containers/images/#image-pull-policy> |
| CTR-IMG-04 | Image Hygiene | Image pull secrets are configured for private registry access | `kubectl get serviceaccount -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': imagePullSecrets='}{.imagePullSecrets}{'\n'}{end}" --context <kubeContext>`; `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': pullSecrets='}{.spec.imagePullSecrets}{'\n'}{end}" --context <kubeContext>` | <https://learn.microsoft.com/en-us/azure/aks/concepts-security#kubernetes-secrets> |
| CTR-IMG-05 | Image Hygiene | All container images are sourced from approved/private registries (no public Docker Hub direct pulls) | `kubectl get pods -A -o jsonpath="{range .items[*]}{range .spec.containers[*]}{.image}{'\n'}{end}{end}" --context <kubeContext>` — identify images without a registry prefix (implicit `docker.io`) or from public registries | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-container-image-management#use-a-private-registry> |
| CTR-IMG-06 | Image Hygiene | ACR integration is configured for pull authentication (attach or workload identity) | `az aks show -g <rg> -n <cluster> --query "identityProfile.kubeletidentity.resourceId" -o tsv`; `az role assignment list --scope <acrResourceId> --query "[?roleDefinitionName=='AcrPull']" -o table` | <https://learn.microsoft.com/en-us/azure/aks/cluster-container-registry-integration> |

### Container Security Context

| Check ID | Category | Checklist Item | Validation Commands | Reference |
| --- | --- | --- | --- | --- |
| CTR-SEC-01 | Security Context | Containers set `runAsNonRoot: true` in securityContext | `kubectl get pods -A -o json --context <kubeContext>` — for each container, check `.spec.containers[*].securityContext.runAsNonRoot` and `.spec.securityContext.runAsNonRoot` (pod-level fallback); report containers where neither is `true` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security#secure-pod-access-to-resources> |
| CTR-SEC-02 | Security Context | Containers set `readOnlyRootFilesystem: true` | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'=roRootFS:'}{.securityContext.readOnlyRootFilesystem}{', '}{end}{'\n'}{end}" --context <kubeContext>` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security#secure-pod-access-to-resources> |
| CTR-SEC-03 | Security Context | Containers set `allowPrivilegeEscalation: false` | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'=allowPrivEsc:'}{.securityContext.allowPrivilegeEscalation}{', '}{end}{'\n'}{end}" --context <kubeContext>` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security#secure-pod-access-to-resources> |
| CTR-SEC-04 | Security Context | No containers run in `privileged: true` mode | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'=privileged:'}{.securityContext.privileged}{', '}{end}{'\n'}{end}" --context <kubeContext>` — flag any container where `privileged=true` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |
| CTR-SEC-05 | Security Context | Linux capabilities are dropped (`drop: ["ALL"]`) and only required capabilities are added | `kubectl get pods -A -o json --context <kubeContext>` — for each container, check `.spec.containers[*].securityContext.capabilities.drop` includes `ALL` and `.add` is either absent or minimal | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |
| CTR-SEC-06 | Security Context | Seccomp profile is set (RuntimeDefault or Localhost) | `kubectl get pods -A -o json --context <kubeContext>` — check `.spec.securityContext.seccompProfile.type` and `.spec.containers[*].securityContext.seccompProfile.type`; report containers without a seccomp profile | <https://kubernetes.io/docs/tutorials/security/seccomp/> |
| CTR-SEC-07 | Security Context | Containers specify explicit `runAsUser` and `runAsGroup` (non-zero) | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'=runAsUser:'}{.securityContext.runAsUser}{',runAsGroup:'}{.securityContext.runAsGroup}{'; '}{end}{'\n'}{end}" --context <kubeContext>` | <https://kubernetes.io/docs/tasks/configure-pod-container/security-context/#set-the-security-context-for-a-pod> |

### Resource Management

| Check ID | Category | Checklist Item | Validation Commands | Reference |
| --- | --- | --- | --- | --- |
| CTR-RES-01 | Resource Management | All containers define CPU and memory requests | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'=cpuReq:'}{.resources.requests.cpu}{',memReq:'}{.resources.requests.memory}{'; '}{end}{'\n'}{end}" --context <kubeContext>` — flag containers with empty request fields | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management#define-pod-resource-requests-and-limits> |
| CTR-RES-02 | Resource Management | All containers define CPU and memory limits | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'=cpuLim:'}{.resources.limits.cpu}{',memLim:'}{.resources.limits.memory}{'; '}{end}{'\n'}{end}" --context <kubeContext>` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management#define-pod-resource-requests-and-limits> |
| CTR-RES-03 | Resource Management | QoS class distribution is understood and appropriate (Guaranteed preferred for critical workloads) | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': qosClass='}{.status.qosClass}{'\n'}{end}" --context <kubeContext>` — tally Guaranteed, Burstable, and BestEffort counts | <https://kubernetes.io/docs/tasks/configure-pod-container/quality-service-pod/> |
| CTR-RES-04 | Resource Management | Resource limits are not excessively higher than requests (limit-to-request ratio within reasonable bounds) | `kubectl get pods -A -o json --context <kubeContext>` — compare `.resources.requests.cpu` vs `.resources.limits.cpu` and `.resources.requests.memory` vs `.resources.limits.memory` for each container; flag ratios exceeding 5:1 for CPU or 3:1 for memory | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management> |
| CTR-RES-05 | Resource Management | Ephemeral storage requests and limits are set for containers that write temporary data | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'=ephReq:'}{.resources.requests.ephemeral-storage}{',ephLim:'}{.resources.limits.ephemeral-storage}{'; '}{end}{'\n'}{end}" --context <kubeContext>` | <https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/#setting-requests-and-limits-for-local-ephemeral-storage> |
| CTR-RES-06 | Resource Management | Init containers define appropriate resource requests and limits | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.initContainers[*]}{.name}{'=cpuReq:'}{.resources.requests.cpu}{',memReq:'}{.resources.requests.memory}{',cpuLim:'}{.resources.limits.cpu}{',memLim:'}{.resources.limits.memory}{'; '}{end}{'\n'}{end}" --context <kubeContext>` | <https://kubernetes.io/docs/concepts/workloads/pods/init-containers/#resource-sharing-within-containers> |

### Health Probes and Lifecycle

| Check ID | Category | Checklist Item | Validation Commands | Reference |
| --- | --- | --- | --- | --- |
| CTR-PROBE-01 | Health Probes | All long-running containers define a readiness probe | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'=readiness:'}{.readinessProbe}{'; '}{end}{'\n'}{end}" --context <kubeContext>` — flag containers with no readinessProbe | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management#define-pod-health-probes> |
| CTR-PROBE-02 | Health Probes | All long-running containers define a liveness probe | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'=liveness:'}{.livenessProbe}{'; '}{end}{'\n'}{end}" --context <kubeContext>` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management#define-pod-health-probes> |
| CTR-PROBE-03 | Health Probes | Startup probes are configured for containers with long initialization times | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'=startup:'}{.startupProbe}{'; '}{end}{'\n'}{end}" --context <kubeContext>` | <https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-startup-probes> |
| CTR-PROBE-04 | Health Probes | Probe configuration uses appropriate timing values (initialDelaySeconds, periodSeconds, failureThreshold) | `kubectl get deploy -A -o json --context <kubeContext>` — for each container, extract probe timing fields and identify probes with defaults only (`initialDelaySeconds: 0`, `periodSeconds: 10`, `failureThreshold: 3`) that may not suit the workload | <https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/> |
| CTR-PROBE-05 | Health Probes | Liveness and readiness probes use different endpoints or checks (liveness probe should not test downstream dependencies) | `kubectl get deploy -A -o json --context <kubeContext>` — compare liveness and readiness probe paths/commands for each container; flag identical configurations | <https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/#when-should-you-use-a-liveness-probe> |
| CTR-LIFE-01 | Lifecycle | `preStop` lifecycle hooks are defined for graceful shutdown of containers receiving traffic | `kubectl get deploy -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.template.spec.containers[*]}{.name}{'=preStop:'}{.lifecycle.preStop}{'; '}{end}{'\n'}{end}" --context <kubeContext>` | <https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/#container-hooks> |
| CTR-LIFE-02 | Lifecycle | `terminationGracePeriodSeconds` is set appropriately (not left at default 30s if workload needs longer shutdown) | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': terminationGrace='}{.spec.terminationGracePeriodSeconds}{'\n'}{end}" --context <kubeContext>` | <https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination> |
| CTR-LIFE-03 | Lifecycle | Rolling update strategy is configured with appropriate `maxSurge` and `maxUnavailable` values | `kubectl get deploy -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': strategy='}{.spec.strategy.type}{',maxSurge='}{.spec.strategy.rollingUpdate.maxSurge}{',maxUnavailable='}{.spec.strategy.rollingUpdate.maxUnavailable}{'\n'}{end}" --context <kubeContext>` | <https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment> |

### Pod-Level Security Controls

| Check ID | Category | Checklist Item | Validation Commands | Reference |
| --- | --- | --- | --- | --- |
| CTR-POD-01 | Pod Security | `automountServiceAccountToken: false` is set on pods and/or service accounts that do not need API access | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': autoMount='}{.spec.automountServiceAccountToken}{', sa='}{.spec.serviceAccountName}{'\n'}{end}" --context <kubeContext>`; `kubectl get sa -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': autoMount='}{.automountServiceAccountToken}{'\n'}{end}" --context <kubeContext>` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security#secure-pod-access-to-resources> |
| CTR-POD-02 | Pod Security | Pods do not use `hostNetwork: true` unless explicitly required | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': hostNetwork='}{.spec.hostNetwork}{'\n'}{end}" --context <kubeContext>` — flag non-system pods with `hostNetwork=true` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |
| CTR-POD-03 | Pod Security | Pods do not use `hostPID: true` or `hostIPC: true` | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': hostPID='}{.spec.hostPID}{', hostIPC='}{.spec.hostIPC}{'\n'}{end}" --context <kubeContext>` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |
| CTR-POD-04 | Pod Security | No `hostPath` volumes are mounted in production workloads | `kubectl get pods -A -o json --context <kubeContext>` — check `.spec.volumes[*].hostPath` for non-null entries; exclude system namespaces from violation count | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |
| CTR-POD-05 | Pod Security | Pod Security Standards labels are applied at the namespace level (`pod-security.kubernetes.io/enforce`) | `kubectl get ns --show-labels --context <kubeContext>` — check for `pod-security.kubernetes.io/enforce=baseline` or `restricted` labels | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |
| CTR-POD-06 | Pod Security | Default service accounts are not used for workloads (dedicated service accounts per workload) | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': sa='}{.spec.serviceAccountName}{'\n'}{end}" --context <kubeContext>` — flag pods using `default` service account | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |

### Container Configuration Hygiene

| Check ID | Category | Checklist Item | Validation Commands | Reference |
| --- | --- | --- | --- | --- |
| CTR-CFG-01 | Configuration Hygiene | No sensitive data is passed via environment variables directly (prefer secrets or Key Vault CSI) | `kubectl get deploy -A -o json --context <kubeContext>` — inspect `.spec.template.spec.containers[*].env[*]` for suspicious keys (e.g., containing `PASSWORD`, `SECRET`, `KEY`, `TOKEN`, `CONNECTION_STRING`) that use `.value` instead of `.valueFrom` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |
| CTR-CFG-02 | Configuration Hygiene | ConfigMaps and Secrets are used instead of baked-in configuration | `kubectl get deploy -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': envFrom='}{.spec.template.spec.containers[*].envFrom}{'\n'}{end}" --context <kubeContext>`; `kubectl get configmap -A --context <kubeContext>` — verify workloads reference ConfigMaps/Secrets | <https://kubernetes.io/docs/concepts/configuration/configmap/> |
| CTR-CFG-03 | Configuration Hygiene | No naked Pods exist (all pods are managed by a controller: Deployment, StatefulSet, DaemonSet, Job) | `kubectl get pods -A -o json --context <kubeContext>` — flag pods where `.metadata.ownerReferences` is empty or absent | <https://kubernetes.io/docs/concepts/workloads/pods/#working-with-pods> |
| CTR-CFG-04 | Configuration Hygiene | Container ports are explicitly declared in pod specs | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{'=ports:'}{.ports}{'; '}{end}{'\n'}{end}" --context <kubeContext>` — flag containers with no ports declared that serve network traffic | <https://kubernetes.io/docs/concepts/services-networking/service/#field-spec-ports> |
| CTR-CFG-05 | Configuration Hygiene | Containers do not run multiple processes per container (single-concern principle) | Manual review — examine `command` and `args` fields: `kubectl get deploy -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.template.spec.containers[*]}{.name}{'=cmd:'}{.command}{',args:'}{.args}{'; '}{end}{'\n'}{end}" --context <kubeContext>` | <https://kubernetes.io/docs/concepts/workloads/pods/#how-pods-manage-multiple-containers> |

### Network and Service Mesh Controls

| Check ID | Category | Checklist Item | Validation Commands | Reference |
| --- | --- | --- | --- | --- |
| CTR-NET-01 | Network | Network policies exist for application namespaces to restrict pod-to-pod traffic | `kubectl get networkpolicy -A -o wide --context <kubeContext>` — flag non-system namespaces with no network policies | <https://learn.microsoft.com/en-us/azure/aks/use-network-policies> |
| CTR-NET-02 | Network | Default-deny ingress network policy is applied per application namespace | `kubectl get networkpolicy -A -o json --context <kubeContext>` — check for policies with `spec.podSelector: {}` and empty `ingress` array (deny-all) | <https://kubernetes.io/docs/concepts/services-networking/network-policies/#default-deny-all-ingress-traffic> |
| CTR-NET-03 | Network | Services use `ClusterIP` type by default (LoadBalancer and NodePort are justified and documented) | `kubectl get svc -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': type='}{.spec.type}{'\n'}{end}" --context <kubeContext>` — flag `LoadBalancer` or `NodePort` services in application namespaces | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-network> |

### ACR and Image Supply Chain (Platform-Level)

| Check ID | Category | Checklist Item | Validation Commands | Reference |
| --- | --- | --- | --- | --- |
| CTR-ACR-01 | Image Supply Chain | ACR vulnerability scanning (Defender for Containers) is enabled | `az security pricing show -n ContainerRegistry -o json`; `az acr show -n <acrName> --query "id" -o tsv` | <https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-containers-vulnerability-assessment-azure> |
| CTR-ACR-02 | Image Supply Chain | ACR image quarantine or approval gates are in place | `az acr config content-trust show -r <acrName> -o json`; `az policy assignment list --scope <acrResourceId> -o table` | <https://learn.microsoft.com/en-us/azure/container-registry/container-registry-content-trust> |
| CTR-ACR-03 | Image Supply Chain | ACR retention policy is configured to limit stale image accumulation | `az acr config retention show -r <acrName> -o json` | <https://learn.microsoft.com/en-us/azure/container-registry/container-registry-retention-policy> |
| CTR-ACR-04 | Image Supply Chain | ACR webhook or Event Grid notifications are configured for image push events | `az acr webhook list -r <acrName> -o table` | <https://learn.microsoft.com/en-us/azure/container-registry/container-registry-webhook> |

## Summary Statistics Extraction

To produce the cluster-wide summary for the report, run these aggregation commands:

### Total Container Count

```bash
kubectl get pods -A -o jsonpath="{range .items[*]}{range .spec.containers[*]}{'1\n'}{end}{end}" --context <kubeContext> | find /c "1"
```

### Containers Without Resource Requests

```bash
kubectl get pods -A -o json --context <kubeContext>
```

Parse JSON output: count containers where `.resources.requests.cpu` or `.resources.requests.memory` is null or empty.

### Containers Running as Root

```bash
kubectl get pods -A -o json --context <kubeContext>
```

Parse JSON output: count containers where neither pod-level nor container-level `runAsNonRoot` is `true` and `runAsUser` is `0` or unset.

### Containers Without Readiness Probes

```bash
kubectl get pods -A -o json --context <kubeContext>
```

Parse JSON output: count containers (excluding init containers) where `.readinessProbe` is null.

### Latest Tag Usage

```bash
kubectl get pods -A -o jsonpath="{range .items[*]}{range .spec.containers[*]}{.image}{'\n'}{end}{end}" --context <kubeContext>
```

Parse output: count images ending in `:latest` or with no tag specified.

### BestEffort QoS Pods

```bash
kubectl get pods -A -o jsonpath="{range .items[*]}{.status.qosClass}{'\n'}{end}" --context <kubeContext>
```

Count occurrences of `BestEffort`.

## Mapping to Existing Checklist Items

Several container best-practice checks overlap with or deepen existing items in the [AKS Checklist Matrix](./aks-checklist-matrix.md). When both a matrix check and a container check apply, the container check provides deeper per-container evidence while the matrix check provides the pass/fail status.

| Container Check ID | Overlapping Matrix Check ID | Relationship |
| --- | --- | --- |
| CTR-IMG-05 | AKS-CIMG-01 | Deepens — provides per-container image source evidence |
| CTR-IMG-06 | AKS-CIMG-01 | Deepens — validates ACR pull authentication at platform level |
| CTR-SEC-01, CTR-SEC-02, CTR-SEC-03, CTR-SEC-04 | AKS-DEVPS-01, SEC-10 | Deepens — per-field validation vs aggregate security context check |
| CTR-RES-01, CTR-RES-02 | REL-06, AKS-DEV-01, AKS-DEVRM-01 | Deepens — per-container resource field validation |
| CTR-PROBE-01, CTR-PROBE-02 | AKS-DEV-01, AKS-DEVRM-01 | Deepens — per-container probe presence validation |
| CTR-PROBE-03 | AKSC-APP-01 | Equivalent — startup probe validation |
| CTR-LIFE-01 | AKSC-APP-02 | Equivalent — preStop hook validation |
| CTR-CFG-03 | AKSC-APP-03 | Equivalent — naked pod detection |
| CTR-NET-01 | SEC-04 | Deepens — per-namespace network policy coverage |
| CTR-POD-05 | SEC-10 | Deepens — explicit PSS label validation |
| CTR-ACR-01 | SEC-08, AKS-CIMG-02 | Deepens — ACR-specific scanning validation |

### Overlap Rules

1. Container checks that **deepen** an existing matrix check: run the container check commands and include per-container findings in the `Evidence Summary` of the parent matrix check row. Also include a summary in the Container Best Practices Assessment section.
2. Container checks that are **equivalent** to a matrix check: the container check commands replace or supplement the matrix check validation commands. Report results in both sections.
3. Container checks with **no overlap**: report exclusively in the Container Best Practices Assessment section of the report.

## Scoring Rules

Container best-practice checks are scored per namespace and per cluster:

### Per-Namespace Scoring

- For each check, compute the percentage of containers (or pods, as appropriate) that comply.
- Compliance threshold: **80%** of containers must pass for a namespace to receive `Meets` status.
- Between **50-79%**: `Partially meets`.
- Below **50%**: `Does not meet`.
- If the check is not applicable to the namespace workload type, mark `Not applicable`.

### Cluster-Wide Scoring

- Aggregate across all assessed namespaces.
- Compute the overall container compliance percentage per check.
- Use the same thresholds as per-namespace scoring.

### Rollup Summary

Produce a rollup table grouped by Container Check Category:

- `Total Checks`
- `Scored Checks`
- `Meets`
- `Partially meets`
- `Does not meet`
- `Not applicable`
- `Not assessed`
- `Compliance %`

## Interpretation Guidelines

- **System namespaces** (`kube-system`, `kube-node-lease`, `kube-public`, `gatekeeper-system`): Platform-managed workloads may legitimately violate some container checks (e.g., `hostNetwork`, privileged containers for CNI/CSI drivers). Report these separately and note that violations in system namespaces are expected for certain infrastructure components.
- **DaemonSets**: Infrastructure DaemonSets (e.g., monitoring agents, log collectors) may require elevated privileges. Flag but do not automatically mark as `Does not meet` — instead note whether the elevation is justified.
- **Jobs and CronJobs**: Batch workloads may not require readiness probes or preStop hooks. Adjust expectations accordingly and note in comments.
- **Init containers**: Resource management checks apply. Health probe checks do not apply to init containers.
- **Per-container vs per-pod checks**: Some checks (e.g., `hostNetwork`, `terminationGracePeriodSeconds`) are pod-level. Others (e.g., `securityContext`, `resources`) are per-container. The commands above target the correct level.
