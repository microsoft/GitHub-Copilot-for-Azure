# AKS Checklist Matrix

Use this checklist matrix as the canonical source for the audit. Execute at least one validation command per item when technically possible. Output all columns of every table.

Legend:

- `az`: Azure platform command
- `kubectl`: Kubernetes API command

## Well-Architected Pillars (AKS Service Guide)

| Check ID | Pillar | Checklist Item | Validation Commands | Learn Reference |
| --- | --- | --- | --- | --- |
| REL-01 | Reliability | Cluster uses availability zones where region supports zones | `az aks show -g <rg> -n <cluster> --query "agentPoolProfiles[].availabilityZones" -o tsv` | <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service#reliability> |
| REL-02 | Reliability | Multi-region strategy for critical workloads | `az resource list -t Microsoft.ContainerService/managedClusters --query "[].{name:name,region:location}" -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-multi-region> |
| REL-03 | Reliability | Internet-facing failover routing design (Front Door or Traffic Manager) | `az network front-door list -o table`; `az network traffic-manager profile list -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-multi-region#use-azure-traffic-manager-to-route-traffic> |
| REL-04 | Reliability | System and user node pools are isolated | `az aks nodepool list -g <rg> --cluster-name <cluster> -o table`; `kubectl get nodes -L agentpool` | <https://learn.microsoft.com/en-us/azure/aks/use-system-pools> |
| REL-05 | Reliability | System node pool sizing and minimum count meet guidance | `az aks nodepool list -g <rg> --cluster-name <cluster> --query "[?mode=='System'].{name:name,count:count,vmSize:vmSize}" -o table` | <https://learn.microsoft.com/en-us/azure/aks/use-system-pools> |
| REL-06 | Reliability | Workloads define resource requests/limits | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{' req='}{.resources.requests}{' lim='}{.resources.limits}{'; '}{end}{'\n'}{end}"` | <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service#reliability> |
| REL-07 | Reliability | NAT Gateway used when high outbound concurrency is required | `az aks show -g <rg> -n <cluster> --query "networkProfile.natGatewayProfile" -o json` | <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service#reliability> |
| REL-08 | Reliability | Backup and restore posture exists for cluster/app data | `az backup vault list -o table`; `az backup item list --vault-name <vault> -g <rg> -o table` | <https://learn.microsoft.com/en-us/azure/backup/azure-kubernetes-service-cluster-backup> |
| SEC-01 | Security | Microsoft Entra ID integration is enabled | `az aks show -g <rg> -n <cluster> --query "aadProfile" -o json` | <https://learn.microsoft.com/en-us/azure/aks/managed-azure-ad> |
| SEC-02 | Security | Local accounts disabled and Entra RBAC enforced where required | `az aks show -g <rg> -n <cluster> --query "disableLocalAccounts" -o tsv`; `az aks show -g <rg> -n <cluster> --query "azurePortalFqdn" -o tsv` | <https://learn.microsoft.com/en-us/azure/aks/manage-local-accounts-managed-azure-ad> |
| SEC-03 | Security | API server access is private or IP-restricted | `az aks show -g <rg> -n <cluster> --query "apiServerAccessProfile" -o json` | <https://learn.microsoft.com/en-us/azure/aks/private-clusters> |
| SEC-04 | Security | Network policies are enabled (Azure/Calico/Cilium) | `az aks show -g <rg> -n <cluster> --query "networkProfile.networkPolicy" -o tsv`; `kubectl get networkpolicy -A` | <https://learn.microsoft.com/en-us/azure/aks/use-network-policies> |
| SEC-05 | Security | Azure Policy add-on enabled for cluster governance | `az aks show -g <rg> -n <cluster> --query "addonProfiles.azurepolicy.enabled" -o tsv` | <https://learn.microsoft.com/en-us/azure/governance/policy/concepts/policy-for-kubernetes> |
| SEC-06 | Security | Workload identity enabled for pod-to-Azure auth | `az aks show -g <rg> -n <cluster> --query "securityProfile.workloadIdentity" -o json`; `kubectl get sa -A -o yaml | findstr azure.workload.identity` | <https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview> |
| SEC-07 | Security | Secrets externalized with Key Vault CSI where applicable | `az aks show -g <rg> -n <cluster> --query "addonProfiles.azureKeyvaultSecretsProvider.enabled" -o tsv`; `kubectl get secretproviderclass -A` | <https://learn.microsoft.com/en-us/azure/aks/csi-secrets-store-driver> |
| SEC-08 | Security | Defender for Containers enabled | `az security pricing show -n KubernetesService -o json` | <https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-containers-introduction> |
| SEC-09 | Security | Egress control enforced through firewall/proxy pattern | `az aks show -g <rg> -n <cluster> --query "networkProfile.outboundType" -o tsv`; `az network firewall list -o table` | <https://learn.microsoft.com/en-us/azure/aks/limit-egress-traffic> |
| SEC-10 | Security | Pod security baseline/restricted controls enforced | `kubectl get ns -L pod-security.kubernetes.io/enforce,pod-security.kubernetes.io/audit,pod-security.kubernetes.io/warn` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |
| COST-01 | Cost Optimization | Cluster SKU/pricing tier aligns with environment intent | `az aks show -g <rg> -n <cluster> --query "sku" -o json` | <https://learn.microsoft.com/en-us/azure/aks/free-standard-pricing-tiers> |
| COST-02 | Cost Optimization | Node pool VM sizing aligns with workload profile | `az aks nodepool list -g <rg> --cluster-name <cluster> --query "[].{name:name,mode:mode,vmSize:vmSize,count:count}" -o table` | <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service#cost-optimization> |
| COST-03 | Cost Optimization | Cluster autoscaler enabled for applicable pools | `az aks nodepool list -g <rg> --cluster-name <cluster> --query "[].{name:name,auto:autoScalerEnabled,min:minCount,max:maxCount}" -o table` | <https://learn.microsoft.com/en-us/azure/aks/cluster-autoscaler> |
| COST-04 | Cost Optimization | HPA/VPA used for rightsizing workloads | `kubectl get hpa -A`; `kubectl get vpa -A` | <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service#cost-optimization> |
| COST-05 | Cost Optimization | Cost analysis add-on enabled and used | `az aks show -g <rg> -n <cluster> --query "addonProfiles.costAnalysis.enabled" -o tsv` | <https://learn.microsoft.com/en-us/azure/aks/cost-analysis> |
| COST-06 | Cost Optimization | Spot node pools used intentionally where disruption-tolerant | `az aks nodepool list -g <rg> --cluster-name <cluster> --query "[?scaleSetPriority=='Spot'].{name:name,spotMaxPrice:spotMaxPrice}" -o table` | <https://learn.microsoft.com/en-us/azure/aks/spot-node-pool> |
| OPS-01 | Operational Excellence | IaC-driven cluster lifecycle (Bicep/Terraform) | `az deployment sub list -o table`; `az deployment group list -g <rg> -o table` | <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service#operational-excellence> |
| OPS-02 | Operational Excellence | GitOps/automated delivery used for cluster and workloads | `az k8s-configuration flux list -g <rg> -c <cluster> -t managedClusters -o table` | <https://learn.microsoft.com/en-us/azure/aks/gitops-flux2> |
| OPS-03 | Operational Excellence | Monitoring strategy includes logs, metrics, and diagnostics | `az aks show -g <rg> -n <cluster> --query "addonProfiles.omsagent.enabled" -o tsv`; `az monitor diagnostic-settings list --resource <aksResourceId>` | <https://learn.microsoft.com/en-us/azure/azure-monitor/containers/container-insights-overview> |
| OPS-04 | Operational Excellence | Testing in production/chaos strategy exists for critical services | `az chaos target list -g <rg> --location <location> -o table` | <https://learn.microsoft.com/en-us/azure/chaos-studio/chaos-studio-tutorial-aks-portal> |
| OPS-05 | Operational Excellence | Policy-based governance enforced for cluster/workload standards | `az policy assignment list --scope <aksResourceId> -o table` | <https://learn.microsoft.com/en-us/azure/governance/policy/concepts/policy-for-kubernetes> |
| PERF-01 | Performance Efficiency | Capacity planning covers SKU, scaling, IP, failover | `az aks show -g <rg> -n <cluster> --query "{kubernetesVersion:kubernetesVersion,networkProfile:networkProfile}" -o json`; `kubectl top nodes` | <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service#performance-efficiency> |
| PERF-02 | Performance Efficiency | Cluster autoscaler + HPA/KEDA strategy implemented | `az aks nodepool list -g <rg> --cluster-name <cluster> -o table`; `kubectl get hpa -A`; `kubectl get scaledobject -A` | <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service#performance-efficiency> |
| PERF-03 | Performance Efficiency | Workloads segmented across node pools for independent scaling | `kubectl get pods -A -o wide`; `az aks nodepool list -g <rg> --cluster-name <cluster> -o table` | <https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service#performance-efficiency> |
| PERF-04 | Performance Efficiency | High scale Container Insights mode used for large clusters | `az aks show -g <rg> -n <cluster> --query "addonProfiles.omsagent.config" -o json` | <https://learn.microsoft.com/en-us/azure/azure-monitor/containers/kubernetes-monitoring-enable#high-scale-mode> |
| PERF-05 | Performance Efficiency | LocalDNS considered/enabled for large cluster DNS performance | `kubectl -n kube-system get ds | findstr -i dns`; `kubectl -n kube-system get cm coredns -o yaml` | <https://learn.microsoft.com/en-us/azure/aks/dns-concepts> |

## AKS Best-Practices Categories (Operator and Developer)

| Check ID | Category | Checklist Item | Validation Commands | Learn Reference |
| --- | --- | --- | --- | --- |
| AKS-OP-01 | Multi-tenancy | Namespaces and quotas isolate tenants/workloads | `kubectl get ns`; `kubectl get resourcequota -A`; `kubectl get limitrange -A` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-cluster-isolation> |
| AKS-OP-02 | Multi-tenancy | Scheduler controls: taints/tolerations, affinity, anti-affinity | `kubectl get nodes -o json | jq '.items[].spec.taints'`; `kubectl get deploy -A -o yaml | findstr -i "affinity tolerations nodeSelector"` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-advanced-scheduler> |
| AKS-OP-03 | Multi-tenancy | Kubernetes RBAC and Azure RBAC least privilege applied | `kubectl get clusterrolebinding`; `az role assignment list --scope <aksResourceId> -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-identity> |
| AKS-OP-04 | Security | API server hardening and controlled admin paths | `az aks show -g <rg> -n <cluster> --query "apiServerAccessProfile" -o json`; `kubectl get clusterrolebinding -o wide` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-cluster-security> |
| AKS-OP-05 | Security | Container image scanning and trusted registries used | `az acr task list-runs -r <acrName> -o table`; `kubectl get pods -A -o jsonpath="{.items[*].spec.containers[*].image}"` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-container-image-management> |
| AKS-OP-06 | Security | Pod security controls reduce privilege escalation risk | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.securityContext}{' '}{end}{'\n'}{end}"` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |
| AKS-OP-07 | Network and storage | Network model and ingress/WAF posture align to risk profile | `az aks show -g <rg> -n <cluster> --query "networkProfile" -o json`; `kubectl get ingress -A` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-network> |
| AKS-OP-08 | Network and storage | Storage classes and backup strategy match workload RPO/RTO | `kubectl get sc`; `kubectl get pvc -A`; `az backup vault list -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-storage> |
| AKS-OP-09 | Enterprise-ready workloads | Multi-region BCDR pattern in place for mission-critical workloads | `az resource list -t Microsoft.ContainerService/managedClusters -o table`; `az acr replication list -r <acrName> -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-multi-region> |
| AKS-DEV-01 | Developer best practices | Requests/limits and probes are consistently defined | `kubectl get deploy -A -o yaml | findstr -i "requests limits livenessProbe readinessProbe"` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management> |
| AKS-DEV-02 | Developer best practices | Deployment reliability practices used (PDB, rolling updates, health checks) | `kubectl get pdb -A`; `kubectl get deploy -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{.spec.strategy.type}{'\n'}{end}"` | <https://learn.microsoft.com/en-us/azure/aks/best-practices-app-cluster-reliability> |
| AKS-DEV-03 | Developer best practices | Secret handling avoids inline sensitive material in manifests | `kubectl get secret -A`; `kubectl get deploy -A -o yaml | findstr -i "envFrom secretKeyRef"` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |

## Deeper Child-Page Checks (AKS Best-Practices Subpages)

### Hierarchy Mapping (Parent Page -> Child Page -> Check IDs)

| Parent Page | Child Page | Check IDs |
| --- | --- | --- |
| Cluster operator best practices | Cluster isolation | `AKS-ISO-01`, `AKS-ISO-02` |
| Cluster operator best practices | Basic scheduler | `AKS-SCHB-01`, `AKS-SCHB-02` |
| Cluster operator best practices | Advanced scheduler | `AKS-SCHA-01`, `AKS-SCHA-02` |
| Cluster operator best practices | Authentication and authorization | `AKS-ID-01`, `AKS-ID-02`, `AKS-ID-03` |
| Cluster operator best practices | Cluster security and upgrades | `AKS-CSEC-01`, `AKS-CSEC-02` |
| Cluster operator best practices | Container image management and security | `AKS-CIMG-01`, `AKS-CIMG-02` |
| Cluster operator best practices | Network connectivity | `AKS-NET-01`, `AKS-NET-02`, `AKS-NET-03` |
| Cluster operator best practices | Storage and backups | `AKS-STO-01`, `AKS-STO-02` |
| Cluster operator best practices | Business continuity and disaster recovery | `AKS-MR-01`, `AKS-MR-02`, `AKS-MR-03` |
| Developer best practices | Application developers to manage resources | `AKS-DEVRM-01` |
| Developer best practices | Pod security | `AKS-DEVPS-01`, `AKS-DEVPS-02` |
| Developer best practices | Deployment and cluster reliability | `AKS-RELY-01`, `AKS-RELY-02` |

### Normalized Child-Page Checks

| Parent Page | Child Page | Check ID | Checklist Item | Validation Commands | Learn Reference |
| --- | --- | --- | --- | --- | --- |
| Cluster operator best practices | Cluster isolation | AKS-ISO-01 | Tenant workloads are isolated by namespace with namespace-level RBAC boundaries | `kubectl get ns`; `kubectl get rolebinding -A`; `kubectl get clusterrolebinding` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-cluster-isolation> |
| Cluster operator best practices | Cluster isolation | AKS-ISO-02 | ResourceQuota and LimitRange controls are present for tenant namespaces | `kubectl get resourcequota -A`; `kubectl get limitrange -A` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-cluster-isolation> |
| Cluster operator best practices | Basic scheduler | AKS-SCHB-01 | Pod disruption budgets are configured for critical workloads | `kubectl get pdb -A`; `kubectl get deploy -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': replicas='}{.spec.replicas}{'\n'}{end}"` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-scheduler> |
| Cluster operator best practices | Basic scheduler | AKS-SCHB-02 | Node pressure is controlled with requests/limits and quota policy | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{' req='}{.resources.requests}{' lim='}{.resources.limits}{'; '}{end}{'\n'}{end}"`; `kubectl get resourcequota -A` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-scheduler> |
| Cluster operator best practices | Advanced scheduler | AKS-SCHA-01 | Taints and tolerations are intentionally used for workload segregation | `kubectl get nodes -o jsonpath="{range .items[*]}{.metadata.name}{': '}{.spec.taints}{'\n'}{end}"`; `kubectl get deploy -A -o yaml | findstr -i tolerations` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-advanced-scheduler> |
| Cluster operator best practices | Advanced scheduler | AKS-SCHA-02 | Node selectors, affinity, and anti-affinity are used for placement policy | `kubectl get deploy -A -o yaml | findstr -i "nodeSelector affinity antiAffinity"` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-advanced-scheduler> |
| Cluster operator best practices | Authentication and authorization | AKS-ID-01 | Microsoft Entra integration is enabled for cluster authn/authz | `az aks show -g <rg> -n <cluster> --query "aadProfile" -o json` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-identity> |
| Cluster operator best practices | Authentication and authorization | AKS-ID-02 | Least-privilege RBAC model avoids broad cluster-admin grants | `kubectl get clusterrolebinding -o wide`; `kubectl get rolebinding -A` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-identity> |
| Cluster operator best practices | Authentication and authorization | AKS-ID-03 | Workload identity is used instead of pod-managed secrets where possible | `az aks show -g <rg> -n <cluster> --query "securityProfile.workloadIdentity" -o json`; `kubectl get serviceaccount -A -o yaml | findstr -i azure.workload.identity` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-identity> |
| Cluster operator best practices | Cluster security and upgrades | AKS-CSEC-01 | AKS version and node image patch posture are current and supported | `az aks show -g <rg> -n <cluster> --query "{kubernetesVersion:kubernetesVersion,nodeResourceGroup:nodeResourceGroup}" -o json`; `az aks nodepool list -g <rg> --cluster-name <cluster> -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-cluster-security> |
| Cluster operator best practices | Cluster security and upgrades | AKS-CSEC-02 | API server access is restricted via private endpoint or authorized ranges | `az aks show -g <rg> -n <cluster> --query "apiServerAccessProfile" -o json` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-cluster-security> |
| Cluster operator best practices | Container image management and security | AKS-CIMG-01 | Images are pulled from approved registries only | `kubectl get pods -A -o jsonpath="{.items[*].spec.containers[*].image}"`; `az aks check-acr -g <rg> -n <cluster> --acr <acrName>` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-container-image-management> |
| Cluster operator best practices | Container image management and security | AKS-CIMG-02 | Image scanning and update automation are in place | `az acr task list-runs -r <acrName> -o table`; `az security assessment list --query "[?contains(displayName,'Container')].{name:displayName,status:status.code}" -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-container-image-management> |
| Cluster operator best practices | Network connectivity | AKS-NET-01 | Network plugin choice aligns with requirements and scale design | `az aks show -g <rg> -n <cluster> --query "networkProfile" -o json` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-network> |
| Cluster operator best practices | Network connectivity | AKS-NET-02 | Ingress endpoints are protected with WAF where internet-facing | `kubectl get ingress -A`; `az network application-gateway list -o table`; `az network front-door waf-policy list -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-network> |
| Cluster operator best practices | Network connectivity | AKS-NET-03 | Node/admin access paths are restricted and audited | `az aks show -g <rg> -n <cluster> --query "linuxProfile" -o json`; `az network nsg list -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-network> |
| Cluster operator best practices | Storage and backups | AKS-STO-01 | StorageClass defaults and CSI usage align with workload needs | `kubectl get storageclass`; `kubectl get pvc -A -o wide`; `kubectl get csidriver` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-storage> |
| Cluster operator best practices | Storage and backups | AKS-STO-02 | Backup approach covers PV data and cluster state where required | `az backup vault list -o table`; `az backup item list --vault-name <vault> -g <rg> -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-storage> |
| Cluster operator best practices | Business continuity and disaster recovery | AKS-MR-01 | Critical workload has multi-cluster deployment pattern across regions | `az resource list -t Microsoft.ContainerService/managedClusters --query "[].{name:name,location:location}" -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-multi-region> |
| Cluster operator best practices | Business continuity and disaster recovery | AKS-MR-02 | Global traffic routing and failover are implemented and testable | `az network front-door list -o table`; `az network traffic-manager profile list -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-multi-region> |
| Cluster operator best practices | Business continuity and disaster recovery | AKS-MR-03 | Container image geo-replication supports regional failover | `az acr replication list -r <acrName> -o table` | <https://learn.microsoft.com/en-us/azure/aks/operator-best-practices-multi-region> |
| Developer best practices | Application developers to manage resources | AKS-DEVRM-01 | Requests, limits, probes, and rollout strategy are consistently defined | `kubectl get deploy -A -o yaml | findstr -i "requests limits livenessProbe readinessProbe strategy"` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management> |
| Developer best practices | Pod security | AKS-DEVPS-01 | Pods run with non-root, read-only root FS, and no privilege escalation where feasible | `kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': '}{range .spec.containers[*]}{.name}{' sec='}{.securityContext}{'; '}{end}{'\n'}{end}"` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |
| Developer best practices | Pod security | AKS-DEVPS-02 | Secrets are externalized and not hardcoded in pod specs | `kubectl get deploy -A -o yaml | findstr -i "secretKeyRef envFrom"`; `kubectl get secretproviderclass -A` | <https://learn.microsoft.com/en-us/azure/aks/developer-best-practices-pod-security> |
| Developer best practices | Deployment and cluster reliability | AKS-RELY-01 | Deployment reliability controls exist (PDB, replicas, readiness, rolling updates) | `kubectl get pdb -A`; `kubectl get deploy -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': strategy='}{.spec.strategy.type}{', replicas='}{.spec.replicas}{'\n'}{end}"` | <https://learn.microsoft.com/en-us/azure/aks/best-practices-app-cluster-reliability> |
| Developer best practices | Deployment and cluster reliability | AKS-RELY-02 | Workload spread and disruption tolerance are configured | `kubectl get deploy -A -o yaml | findstr -i "topologySpreadConstraints maxUnavailable"`; `kubectl get poddisruptionbudget -A` | <https://learn.microsoft.com/en-us/azure/aks/best-practices-app-cluster-reliability> |

### Subpage Rollup Scoring Rules

- Group deeper checks by `Parent Page` and `Child Page`.
- For each group, compute:
	- `Total Checks`: count of all checks in the group.
	- `Scored Checks`: checks with status in `Meets`, `Partially meets`, `Does not meet`.
	- `Meets`, `Partially meets`, `Does not meet`, `Not applicable`, `Not assessed` counts.
	- `Compliance %`: `((Meets + (0.5 * Partially meets)) / Scored Checks) * 100`.
- If `Scored Checks` is `0`, set `Compliance %` to `N/A`.

## External Checklist Incorporation (the-aks-checklist.com)

Source:

- <https://www.the-aks-checklist.com/>

### Conflict Resolution Policy

- If an AKS Checklist item clashes with an existing Microsoft Learn-backed check, follow Microsoft Learn.
- In clashes, keep the existing check ID and Learn reference; add AKS Checklist reference as context only.
- Add only non-conflicting AKS Checklist items as new `AKSC-*` checks.

### Reconciled Overlaps (Mapped to Existing Checks)

| AKS Checklist Theme | Existing Check IDs (Microsoft Learn authoritative) |
| --- | --- |
| Managed Entra auth, disable local accounts, RBAC | `SEC-01`, `SEC-02`, `AKS-ID-01`, `AKS-ID-02` |
| Workload identity and ACR integration | `SEC-06`, `AKS-ID-03`, `AKS-CIMG-01` |
| API server private/authorized ranges | `SEC-03`, `AKS-CSEC-02` |
| Network policy and egress control | `SEC-04`, `SEC-09`, `AKS-NET-02`, `AKS-NET-03` |
| System/user nodepool isolation | `REL-04`, `REL-05` |
| Cluster autoscaler/HPA/KEDA | `COST-03`, `COST-04`, `PERF-02` |
| Storage class and backup posture | `AKS-STO-01`, `AKS-STO-02`, `REL-08` |
| Multi-region and traffic failover | `REL-02`, `REL-03`, `AKS-MR-01`, `AKS-MR-02`, `AKS-MR-03` |
| Defender and policy governance | `SEC-08`, `SEC-05`, `OPS-05` |

### Supplemental AKS Checklist Checks (Non-Conflicting Additions)

| Parent Page | Child Page | Check ID | Checklist Item | Validation Commands | Learn Reference | AKS Checklist Reference |
| --- | --- | --- | --- | --- | --- | --- |
| Cluster operator best practices | Networking | AKSC-NET-01 | Azure CNI subnet capacity and max pods per node are validated for IP exhaustion risk | `az aks show -g <rg> -n <cluster> --query "{networkPlugin:networkProfile.networkPlugin,maxPods:agentPoolProfiles[].maxPods,podCidr:networkProfile.podCidr,serviceCidr:networkProfile.serviceCidr}" -o json`; `az network vnet subnet show --ids <subnetResourceId> --query "{prefix:addressPrefix,ipConfigurations:ipConfigurations}" -o json` | <https://learn.microsoft.com/en-us/azure/aks/configure-azure-cni#plan-ip-addressing-for-your-cluster> | <https://www.the-aks-checklist.com/#section-networking> |
| Cluster operator best practices | Networking | AKSC-NET-02 | CIDR overlap checks are verified for pod/service/subnet/peered VNets | `az aks show -g <rg> -n <cluster> --query "{podCidr:networkProfile.podCidr,serviceCidr:networkProfile.serviceCidr,dnsServiceIP:networkProfile.dnsServiceIP}" -o json`; `az network vnet list -o json` | <https://learn.microsoft.com/en-us/azure/aks/configure-azure-cni#deployment-parameters> | <https://www.the-aks-checklist.com/#section-networking> |
| Cluster operator best practices | Networking | AKSC-NET-03 | Private Link or service endpoints are used for AKS-to-PaaS connectivity where required | `az network private-endpoint list -o table`; `az network vnet subnet list --resource-group <rg> --vnet-name <vnet> -o table` | <https://learn.microsoft.com/en-us/azure/private-link/private-link-overview> | <https://www.the-aks-checklist.com/#section-networking> |
| Cluster operator best practices | Cluster security and upgrades | AKSC-SEC-01 | KMS-based etcd encryption with customer-managed keys is enabled where compliance requires CMK | `az aks show -g <rg> -n <cluster> --query "securityProfile.azureKeyVaultKms" -o json` | <https://learn.microsoft.com/en-us/azure/aks/use-kms-etcd-encryption> | <https://www.the-aks-checklist.com/#section-cluster-security> |
| Cluster operator best practices | Cluster security and upgrades | AKSC-SEC-02 | Image Cleaner is enabled to remove stale and vulnerable cached images on nodes | `az aks show -g <rg> -n <cluster> --query "securityProfile.imageCleaner" -o json` | <https://learn.microsoft.com/en-us/azure/aks/image-cleaner> | <https://www.the-aks-checklist.com/#section-cluster-security> |
| Cluster operator best practices | Cluster operations | AKSC-OPS-01 | AKS auto-certificate rotation is enabled | `az aks show -g <rg> -n <cluster> --query "autoScalerProfile" -o json`; `az aks show -g <rg> -n <cluster> --query "securityProfile" -o json` | <https://learn.microsoft.com/en-us/azure/aks/certificate-rotation> | <https://www.the-aks-checklist.com/#section-cluster-operations> |
| Cluster operator best practices | Cluster operations | AKSC-OPS-02 | Control plane logs are enabled and routed to Azure Monitor diagnostics | `az monitor diagnostic-settings list --resource <aksResourceId> -o json`; `az aks show -g <rg> -n <cluster> --query "addonProfiles.omsagent.enabled" -o tsv` | <https://learn.microsoft.com/en-us/azure/aks/view-control-plane-logs> | <https://www.the-aks-checklist.com/#section-cluster-operations> |
| Cluster operator best practices | Cluster operations | AKSC-OPS-03 | ContainerLogV2 schema is enabled for container logging | `az monitor data-collection-rule list -o json`; `az monitor diagnostic-settings list --resource <aksResourceId> -o json` | <https://learn.microsoft.com/en-us/azure/azure-monitor/containers/container-insights-logging-v2> | <https://www.the-aks-checklist.com/#section-cluster-operations> |
| Cluster operator best practices | Cluster operations | AKSC-OPS-04 | Alerts are configured for critical AKS and workload metrics | `az monitor metrics alert list -g <rg> -o table`; `az monitor scheduled-query list -g <rg> -o table` | <https://learn.microsoft.com/en-us/azure/azure-monitor/insights/container-insights-metric-alerts> | <https://www.the-aks-checklist.com/#section-cluster-operations> |
| Cluster operator best practices | Cluster operations | AKSC-OPS-05 | Event Grid integration for AKS events is configured for automation workflows | `az eventgrid system-topic list -o table`; `az eventgrid event-subscription list --source-resource-id <aksResourceId> -o table` | <https://learn.microsoft.com/en-us/azure/event-grid/event-schema-aks> | <https://www.the-aks-checklist.com/#section-cluster-operations> |
| Cluster operator best practices | Business continuity and disaster recovery | AKSC-BCDR-01 | Availability zone support is enabled for control-plane resiliency strategy | `az aks show -g <rg> -n <cluster> --query "agentPoolProfiles[].availabilityZones" -o tsv` | <https://learn.microsoft.com/en-us/azure/aks/availability-zones> | <https://www.the-aks-checklist.com/#section-biz-continuity---disaster-recovery> |
| Cluster operator best practices | Business continuity and disaster recovery | AKSC-BCDR-02 | ACR zone redundancy and soft delete policy are enabled where required | `az acr show -n <acrName> --query "zoneRedundancy" -o tsv`; `az acr config soft-delete show -r <acrName> -o json` | <https://learn.microsoft.com/en-us/azure/container-registry/zone-redundancy> | <https://www.the-aks-checklist.com/#section-biz-continuity---disaster-recovery> |
| Cluster operator best practices | Business continuity and disaster recovery | AKSC-BCDR-03 | AKS backups are scheduled with retention policy aligned to RPO/RTO | `az backup policy list --resource-group <rg> --vault-name <vault> -o table`; `az backup item list --resource-group <rg> --vault-name <vault> -o table` | <https://learn.microsoft.com/en-us/azure/backup/azure-kubernetes-service-backup-overview> | <https://www.the-aks-checklist.com/#section-biz-continuity---disaster-recovery> |
| Developer best practices | Application deployment | AKSC-APP-01 | Startup probes are configured for slow-boot workloads | `kubectl get deploy -A -o yaml | findstr -i startupProbe` | <https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/> | <https://www.the-aks-checklist.com/#section-application-deployment> |
| Developer best practices | Application deployment | AKSC-APP-02 | PreStop lifecycle hooks are configured for graceful shutdown | `kubectl get deploy -A -o yaml | findstr -i preStop` | <https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/> | <https://www.the-aks-checklist.com/#section-application-deployment> |
| Developer best practices | Application deployment | AKSC-APP-03 | Deployments avoid naked pods and define replica targets | `kubectl get pod -A --show-labels`; `kubectl get deploy -A -o jsonpath="{range .items[*]}{.metadata.namespace}/{.metadata.name}{': replicas='}{.spec.replicas}{'\n'}{end}"` | <https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/> | <https://www.the-aks-checklist.com/#section-application-deployment> |
| Developer best practices | Image management | AKSC-IMG-01 | Only approved registries are allowed via policy/admission controls | `az policy assignment list --scope <aksResourceId> -o table`; `kubectl get validatingwebhookconfiguration` | <https://learn.microsoft.com/en-us/azure/governance/policy/concepts/rego-for-aks#built-in-policies> | <https://www.the-aks-checklist.com/#section-image-management> |
| Developer best practices | Image management | AKSC-IMG-02 | Container image scans are enforced in CI/CD before deployment | `az security assessment list --query "[?contains(displayName,'container')].{name:displayName,status:status.code}" -o table`; `az acr task list-runs -r <acrName> -o table` | <https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-containers-cicd> | <https://www.the-aks-checklist.com/#section-image-management> |
| Platform-specific | Windows | AKSC-WIN-01 | Windows node pools use Azure CNI and OS/image patch alignment is maintained | `az aks nodepool list -g <rg> --cluster-name <cluster> --query "[?osType=='Windows'].{name:name,orchestratorVersion:orchestratorVersion,osSKU:osSKU}" -o table`; `az aks show -g <rg> -n <cluster> --query "networkProfile.networkPlugin" -o tsv` | <https://learn.microsoft.com/en-us/azure/aks/windows-node-limitations#what-network-plug-ins-are-supported> | <https://www.the-aks-checklist.com/#section-windows> |

### External Hierarchy Mapping (Parent Page -> Child Page -> Check IDs)

| Parent Page | Child Page | Check IDs |
| --- | --- | --- |
| Cluster operator best practices | Networking | `AKSC-NET-01`, `AKSC-NET-02`, `AKSC-NET-03` |
| Cluster operator best practices | Cluster security and upgrades | `AKSC-SEC-01`, `AKSC-SEC-02` |
| Cluster operator best practices | Cluster operations | `AKSC-OPS-01`, `AKSC-OPS-02`, `AKSC-OPS-03`, `AKSC-OPS-04`, `AKSC-OPS-05` |
| Cluster operator best practices | Business continuity and disaster recovery | `AKSC-BCDR-01`, `AKSC-BCDR-02`, `AKSC-BCDR-03` |
| Developer best practices | Application deployment | `AKSC-APP-01`, `AKSC-APP-02`, `AKSC-APP-03` |
| Developer best practices | Image management | `AKSC-IMG-01`, `AKSC-IMG-02` |
| Platform-specific | Windows | `AKSC-WIN-01` |

## AKS Diagnostics Detectors

The audit also incorporates live findings from the AKS "Diagnose and solve problems" detectors. These are runtime assessments executed by Azure against the cluster.

- Extraction methods, detector categories, and interpretation rules are documented in [AKS Diagnostics Detectors Reference](./aks-diagnostics-detectors.md).
- Detector findings that align to existing checklist items must be cross-referenced in the Detailed Analysis table (update `Evidence Summary` and `Comments`).
- Detector findings that have no matching checklist item are reported in the dedicated **AKS Diagnostics Findings** section of the report.
- Critical or Warning findings may override a checklist item's status (see cross-reference rules in the detectors reference).

## Assessment Notes

- If a command requires unsupported tooling (example: `jq` on Windows), use an equivalent `az --query` or `kubectl -o jsonpath` expression.
- If command execution is blocked by RBAC, capture the exact error in evidence and mark `Not assessed`.
- Use `Not applicable` when a control legitimately does not apply to the workload architecture, and explain why in the report `Comments` column.
- For each failed or partial check, provide up to five remediation actions in priority order.
- For checks incorporated from the AKS Checklist, if guidance conflicts with existing checks, apply Microsoft Learn guidance as the final recommendation.
- AKS Diagnostics detector findings are point-in-time. Record the execution timestamp and note that results may change as cluster state evolves.
