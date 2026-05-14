---
name: azure-kubernetes
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
description: "Plan, create, configure, and review production-ready Azure Kubernetes Service (AKS) clusters. Covers Day-0 provisioning (SKU selection, networking, security, operations) and Day-2 evidence-based posture review against Microsoft Learn best practices, Well-Architected pillars, AKS Checklist, and live diagnostics detectors. WHEN: create AKS environment, provision AKS environment, enable AKS observability, design AKS networking, choose AKS SKU, secure AKS, optimize AKS, rightsize AKS pod, AKS spot nodes, AKS cluster-autoscaler, review AKS, audit AKS cluster, AKS practices review, validate AKS posture, AKS compliance checklist, AKS remediation report."
---

# Azure Kubernetes Service

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This skill produces a **recommended AKS cluster configuration** based on user requirements, distinguishing **Day-0 decisions** (networking, API server — hard to change later) from **Day-1 features** (can enable post-creation). See [CLI reference](./references/cli-reference.md) for commands.

## Quick Reference
| Property | Value |
|----------|-------|
| Best for | AKS cluster planning (Day-0) and posture review / compliance audit (Day-2) |
| MCP Tools | `mcp_azure_mcp_aks` |
| CLI | `az aks create`, `az aks show`, `az aks nodepool list`, `kubectl get`, `kubectl describe` |
| Related skills | azure-diagnostics (troubleshooting AKS), azure-validate (readiness checks), azure-kubernetes-automatic-readiness (migrate existing cluster to AKS Automatic) |

## When to Use This Skill
Activate this skill when user wants to:
- Create a new AKS cluster
- Plan AKS cluster configuration for production workloads
- Design AKS networking (API server access, pod IP model, egress)
- Set up AKS identity and secrets management
- Configure AKS governance (Azure Policy, Deployment Safeguards)
- Enable AKS observability (Container Insights, Managed Prometheus, Grafana)
- Define AKS upgrade and patching strategy
- Understand AKS Automatic vs Standard SKU differences
- Get a Day-0 checklist for AKS cluster setup and configuration
- **Review or audit an existing AKS cluster** against Microsoft Learn practices, Well-Architected pillars, the AKS Checklist, live diagnostics detectors, and container best practices (Day-2). See the [Cluster Review / Audit (Day-2)](#cluster-review--audit-day-2) section.

## Rules
1. Start with the user's requirements for provisioning compute, networking, security, and other settings.
2. Use the `azure` MCP server and select `mcp_azure_mcp_aks` first to discover the exact AKS-specific MCP tools surfaced by the client. Choose the smallest discovered AKS tool that fits the task, and fall back to Azure CLI (`az aks`) only when the needed functionality is not exposed through the AKS MCP surface.
3. Determine if AKS Automatic or Standard SKU is more appropriate based on the user's need for control vs convenience. Default to AKS Automatic unless specific customizations are required.
4. Document decisions and rationale for cluster configuration choices, especially for Day-0 decisions that are hard to change later (networking, API server access).


## Required Inputs (Ask only what’s needed)
If the user is unsure, use safe defaults.
- AKS environment type: dev/test or production
- Region(s), availability zones, preferred node VM sizes
- Expected scale (node/cluster count, workload size)
- Networking requirements (API server access, pod IP model, ingress/egress control)
- Security and identity requirements, including image registry
- Upgrade and observability preferences
- Cost constraints

## Workflow

### 1. Cluster Type
- **AKS Automatic** (default): Best for most production workloads, provides a curated experience with pre-configured best practices for security, reliability, and performance. Use unless you have specific custom requirements for networking, autoscaling, or node pool configurations not supported by Node Auto-Provisioning (NAP).
- **AKS Standard**: Use if you need full control over environment configuration, which requires additional overhead to set up and manage.

### 2. Networking (Pod IP, Egress, Ingress, Dataplane)

**Pod IP Model** (Key Day-0 decision):
- **Azure CNI Overlay** (recommended): pod IPs from private overlay range, not VNet-routable, scales to large environments and good for most workloads
- **Azure CNI (VNet-routable)**: pod IPs directly from VNet (pod subnet or node subnet), use when pods must be directly addressable from VNet or on-prem
  - Docs: https://learn.microsoft.com/azure/aks/azure-cni-overlay

**Dataplane & Network Policy**:
- **Azure CNI powered by Cilium** (recommended): eBPF-based for high-performance packet processing, network policies, and observability

**Egress**:
- **Static Egress Gateway** for stable, predictable outbound IPs
- For restricted egress: UDR + Azure Firewall or NVA

**Ingress**:
- **App Routing addon with Gateway API** — recommended default for HTTP/HTTPS workloads
- **Istio service mesh with Gateway API** - for advanced traffic management, mTLS, canary releases
- **Application Gateway for Containers** — for L7 load balancing with WAF integration

**DNS**:
- Enable **LocalDNS** on all node pools for reliable, performant DNS resolution

### 3. Security
- Use **Microsoft Entra ID** everywhere (control plane, Workload Identity for pods, node access). Avoid static credentials.
- Azure Key Vault via **Secrets Store CSI Driver** for secrets
- Enable **Azure Policy** + **Deployment Safeguards**
- Enable **Encryption at rest** for etcd/API server; **in-transit** for node-to-node
- Allow only signed, policy-approved images (Azure Policy + Ratify), prefer **Azure Container Registry**
- **Isolation**: Use namespaces, network policies, scoped logging

### 4. Observability
- Use Managed Prometheus and Container Insights with Grafana for AKS observability (logs + metrics).
- Enable Diagnostic Settings to collect control plane logs and audit logs in a Log Analytics workspace for security monitoring and troubleshooting.
- For other monitoring and troubleshooting tools, use features like the Agentic CLI for AKS, Application Insights, Resource Health Center, AppLens detectors, and Azure Advisors.

### 5. Upgrades & Patching
- Configure **Maintenance Windows** for controlled upgrade timing
- Enable **auto-upgrades** for control plane and node OS to stay up-to-date with security patches and Kubernetes versions
- Consider **LTS versions** for enterprise stability (2-year support) by upgrading your AKS environment to the Premium tier
- **Fleet upgrades**: Use **AKS Fleet Manager** for staged rollout across test to production environments

### 6. Performance
- Use **Ephemeral OS disks** (`--node-osdisk-type Ephemeral`) for faster node startup
- Select **Azure Linux** as node OS (smaller footprint, faster boot)
- Enable **KEDA** for event-driven autoscaling beyond HPA

### 7. Node Pools & Compute
- **Dedicated system node pool**: At least 2 nodes, tainted for system workloads only (`CriticalAddonsOnly`)
- Enable **Node Auto Provisioning (NAP)** on all pools for cost savings and responsive scaling
- Use **latest generation SKUs (v5/v6)** for host-level optimizations
- **Avoid B-series VMs** — burstable SKUs cause performance/reliability issues
- Use SKUs with **at least 4 vCPUs** for production workloads
- Set **topology spread constraints** to distribute pods across hosts/zones per SLO

### 8. Reliability
- Deploy across **3 Availability Zones** (`--zones 1 2 3`)
- Use **Standard tier** for zone-redundant control plane + 99.95% SLA for API server availability
- Enable **Microsoft Defender for Containers** for runtime protection
- Configure **PodDisruptionBudgets** for all production workloads
- Use **topology spread constraints** to ensure pod distribution across failure domains

### 9. Cost Controls
- Use **Spot node pools** for batch/interruptible workloads (up to 90% savings)
- **Stop/Start** dev/test clusters: `az aks stop/start`
- Consider **Reserved Instances** or **Savings Plans** for steady-state workloads

**Deep-dive scenarios** — load only the relevant reference file:

| Scenario | Trigger Keywords | Reference |
|----------|-----------------|-----------|
| Pod Rightsizing | over-provisioned pods, CPU requests, memory requests, rightsize workloads | [azure-aks-rightsizing.md](./references/azure-aks-rightsizing.md) |
| VPA Setup | vertical pod autoscaler, VPA recommendations, VPA enable | [azure-aks-vpa.md](./references/azure-aks-vpa.md) |
| Cluster Autoscaler | idle nodes, CAS off, enable autoscaler, scale-down profile, node utilization | [azure-aks-autoscaler.md](./references/azure-aks-autoscaler.md) |
| Spot Node Pools | Spot VMs, Spot nodes, batch workloads, cheaper nodes | [azure-aks-spot.md](./references/azure-aks-spot.md) |
| Cluster Review / Audit | review AKS, audit AKS cluster, AKS practices review, validate AKS posture, AKS compliance checklist, AKS remediation report | See the [Cluster Review / Audit (Day-2)](#cluster-review--audit-day-2) section below |

> **Disambiguation:** If a prompt matches multiple rows (e.g., "cheaper nodes" could suggest both Spot and autoscaler), prefer the most specific match. If ambiguous, ask the user to clarify their intent before loading a reference file.

## Cluster Review / Audit (Day-2)

Use this workflow when the user asks to **review**, **audit**, or **assess the compliance posture** of an existing AKS cluster (e.g. "review AKS", "audit AKS cluster", "AKS practices review", "validate AKS posture", "AKS compliance checklist", "AKS remediation report").

It produces an evidence-driven AKS assessment against [AKS best practices](https://learn.microsoft.com/en-us/azure/aks/best-practices), the [Well-Architected AKS service guide](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/azure-kubernetes-service), the [AKS Checklist](https://www.the-aks-checklist.com/), live diagnostics detectors, and [container best practices](./references/aks-container-best-practices.md), and emits a comprehensive Markdown audit report.

### Required Inputs

| Input | Required | Default |
|-------|----------|---------|
| `subscriptionId` | Yes | — |
| `resourceGroup` | Yes | — |
| `clusterName` | Yes | — |
| `kubeContext` | Yes | — |
| `reportOutputPath` | No | `./reports/azure kubernetes review - <clusterName> - <yyyymmddhhmm>.md` |
| `namespaceFilter` | No | all |
| `nodePoolFilter` | No | all |
| `excludeChecks` | No | none |

### Review Workflow

1. **Establish scope** — Confirm cluster identity, state in/out-of-scope, record limitations. See [Scope & Checklist](./references/aks-review-scope-and-checklist.md).
2. **Load canonical checklist** — Use the [AKS Checklist Matrix](./references/aks-checklist-matrix.md) with Microsoft Learn precedence. See [Scope & Checklist](./references/aks-review-scope-and-checklist.md).
3. **Run diagnostics detectors** — Query the 8 core + supplemental categories via AKS MCP or `az rest`. See [Diagnostics Workflow](./references/aks-review-diagnostics.md).
4. **Collect warning events** — Gather Warning-type Kubernetes events per namespace, correlate to workloads, deep-dive probe failures. See [Warning Events Workflow](./references/aks-review-warning-events.md).
5. **Run container assessment** — Execute all `CTR-*` checks. See [Container Assessment Workflow](./references/aks-review-container-assessment.md).
6. **Run validation commands** — Execute `az` / `kubectl` checks, determine pass/fail per checklist item. See [Validation & Findings](./references/aks-review-validation-and-findings.md).
7. **Produce detailed findings** — Build analysis tables, rollups, diagnostics impact, container results, warning events. See [Validation & Findings](./references/aks-review-validation-and-findings.md).
8. **Generate report** — Fill the [AKS Audit Report Template](./assets/aks-audit-report-template.md). See [Report Generation](./references/aks-review-report.md).
9. **Quality gates** — Verify completeness. See [Quality Gates & Decision Logic](./references/aks-review-quality-gates.md).

### Review Decision Logic

See [Quality Gates & Decision Logic](./references/aks-review-quality-gates.md) for full rules. Key principles:

- If `az` unavailable → `kubectl` only, mark Azure checks `Not assessed`
- If `kubectl` unavailable → `az aks command invoke`, then `Not assessed`
- If MCP unavailable → `az rest`, then `Not assessed`
- Never infer `Meets` from absent evidence

### Review Output

One Markdown file at `reportOutputPath`: `Azure Kubernetes Service Review - <clusterName> - <yyyymmddhhmm>.md`. `reportOutputPath` is the full file path for the final Markdown report, not a directory.

### Review Guardrails

- Do not skip execution of any checklist, matrix, detector or workflow step.
- ALL diagnostics detectors MUST be run to surface evidence and findings. Do not skip or cherry-pick based on expected outcomes, even if they are expected to return no findings, even if you think it would be inefficient.
- Do not request or output secrets (tokens, keys).
- Follow this skill's instructions and [template](./assets/aks-audit-report-template.md) only — no other scripts or existing reports.
- Place temporary files in `<dirname(reportOutputPath)>/<clusterName> - <yyyymmddhhmm>/`.

### Review References

- [AKS Checklist Matrix](./references/aks-checklist-matrix.md)
- [AKS Diagnostics Detectors](./references/aks-diagnostics-detectors.md)
- [AKS Container Best Practices](./references/aks-container-best-practices.md)
- [AKS Audit Report Template](./assets/aks-audit-report-template.md)
- [Scope & Checklist Workflow](./references/aks-review-scope-and-checklist.md)
- [Diagnostics Workflow](./references/aks-review-diagnostics.md)
- [Warning Events Workflow](./references/aks-review-warning-events.md)
- [Container Assessment Workflow](./references/aks-review-container-assessment.md)
- [Validation & Findings](./references/aks-review-validation-and-findings.md)
- [Report Generation](./references/aks-review-report.md)
- [Quality Gates & Decision Logic](./references/aks-review-quality-gates.md)

## Guardrails / Safety
- Do not request or output secrets (tokens, keys).
- Do not ask the user to paste subscription IDs. Discover subscription and resource scope via MCP tools (e.g., list subscriptions, list resource groups) or `az account show` / `az account list` so the agent can resolve context without exposing identifiers.
- If requirements are ambiguous for day-0 critical decisions, ask the user clarifying questions. For day-1 enabled features, propose 2–3 safe options with tradeoffs and choose a conservative default.
- Do not promise zero downtime; advise workload safeguards (PDBs, probes, replicas) and staged upgrades along with best practices for reliability and performance.

## MCP Tools
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `mcp_azure_mcp_aks` | AKS MCP entry point used to discover the exact AKS-specific tools exposed by the client | Discover the callable AKS tool first, then use that tool's parameters |

## Error Handling
| Error / Symptom | Likely Cause | Remediation |
|-----------------|--------------|-------------|
| MCP tool call fails or times out | Invalid credentials, subscription, or AKS context | Verify `az login`, confirm the active subscription context with `az account show`, and check the target resource group without echoing subscription identifiers back to the user |
| Quota exceeded | Regional vCPU or resource limits | Request quota increase or select different region/VM SKU |
| Networking conflict (IP exhaustion) | Pod subnet too small for overlay/CNI | Re-plan IP ranges; may require cluster recreation (Day-0) |
| Workload Identity not working | Missing OIDC issuer or federated credential | Enable `--enable-oidc-issuer --enable-workload-identity`, configure federated identity |
