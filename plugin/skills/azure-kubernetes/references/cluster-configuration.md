# AKS Cluster Configuration Guide

Detailed configuration guidance for AKS clusters, organized by domain.

## Networking (Pod IP, Egress, Ingress, Dataplane)

**Pod IP Model** (Key Day-0 decision):
- **Azure CNI Overlay** (recommended): pod IPs from private overlay range, not VNet-routable, scales to large clusters and good for most workloads
- **Azure CNI (VNet-routable)**: pod IPs directly from VNet (pod subnet or node subnet), use when pods must be directly addressable from VNet or on-prem
  - Docs: https://learn.microsoft.com/azure/aks/azure-cni-overlay

**Dataplane & Network Policy**:
- **Azure CNI powered by Cilium** (recommended): eBPF-based for high-performance packet processing, network policies, and observability

**Egress**:
- **Static Egress Gateway** for stable, predictable outbound IPs
- For restricted egress: UDR + Azure Firewall or NVA

**Ingress**:
- **App Routing addon with Gateway API** — recommended default for HTTP/HTTPS workloads
- **Istio service mesh with Gateway API** — for advanced traffic management, mTLS, canary deployments
- **Application Gateway for Containers** — for L7 load balancing with WAF integration

**DNS**:
- Enable **LocalDNS** on all node pools for reliable, performant DNS resolution

## Security

- Use **Microsoft Entra ID** everywhere (control plane, Workload Identity for pods, node access). Avoid static credentials.
- Azure Key Vault via **Secrets Store CSI Driver** for secrets
- Enable **Azure Policy** + **Deployment Safeguards**
- Enable **Encryption at rest** for etcd/API server; **in-transit** for node-to-node
- Allow only signed, policy-approved images (Azure Policy + Ratify), prefer **Azure Container Registry**
- **Isolation**: Use namespaces, network policies, scoped logging

## Observability

- Use Azure Monitor and Container Insights for AKS monitoring enablement (logs + Prometheus + Grafana).

## Upgrades & Patching

- Configure **Maintenance Windows** for controlled upgrade timing
- Enable **auto-upgrades** for cluster and node OS to stay up-to-date with security patches and Kubernetes versions
- Consider **LTS versions** for enterprise stability (2-year support) by upgrading your cluster to the AKS Premium tier
- **Multi-cluster upgrades**: Use **AKS Fleet Manager** for staged rollout across test → production clusters

## Performance

- Use **Ephemeral OS disks** (`--node-osdisk-type Ephemeral`) for faster node startup
- Select **Azure Linux** as node OS (smaller footprint, faster boot)
- Enable **KEDA** for event-driven autoscaling beyond HPA

## Node Pools & Compute

- **Dedicated system node pool**: At least 2 nodes, tainted for system workloads only (`CriticalAddonsOnly`)
- Enable **Node Auto Provisioning (NAP)** on all pools for cost savings and responsive scaling
- Use **latest generation SKUs (v5/v6)** for host-level optimizations
- **Avoid B-series VMs** — burstable SKUs cause performance/reliability issues
- Use SKUs with **at least 4 vCPUs** for production workloads
- Set **topology spread constraints** to distribute pods across hosts/zones per SLO

## Reliability

- Deploy across **3 Availability Zones** (`--zones 1 2 3`)
- Use **Standard tier** for zone-redundant control plane + 99.95% SLA for API server availability
- Enable **Microsoft Defender for Containers** for runtime protection
- Configure **PodDisruptionBudgets** for all production workloads
- Use **topology spread constraints** to ensure pod distribution across failure domains

## Cost Controls

- Use **Spot node pools** for batch/interruptible workloads (up to 90% savings)
- **Stop/Start** dev/test clusters: `az aks stop` / `az aks start`
- Consider **Reserved Instances** or **Savings Plans** for steady-state workloads
