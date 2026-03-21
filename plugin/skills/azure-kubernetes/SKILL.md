---
name: azure-kubernetes
license: MIT
metadata:
  author: Microsoft
  version: "1.0.1"
description: "Plan and create production-ready AKS clusters: Day-0 decisions, SKU selection (Automatic vs Standard), networking, security, and operations. WHEN: provision AKS cluster, design AKS networking, choose AKS SKU, configure AKS security, set up AKS observability, plan AKS upgrades, AKS Day-0 checklist. DO NOT USE FOR: debugging AKS issues (use azure-diagnostics), deploying apps to AKS (use azure-deploy), AKS monitoring queries (use azure-kusto)."
---

# Azure Kubernetes Service

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This skill produces a **recommended AKS cluster configuration** based on user requirements, distinguishing **Day-0 decisions** (networking, API server — hard to change later) from **Day-1 features** (can enable post-creation). See [CLI reference](./references/cli-reference.md) and [cluster configuration guide](./references/cluster-configuration.md) for details.

## Quick Reference
| Property | Value |
|----------|-------|
| Best for | AKS cluster planning and Day-0 decisions |
| MCP Tools | `mcp_azure_mcp_aks` |
| CLI | `az aks create`, `az aks show`, `kubectl get`, `kubectl describe` |
| Related skills | azure-diagnostics (troubleshooting), azure-deploy (app deployment), azure-kusto (monitoring queries) |

## When to Use This Skill
Activate when user wants to:
- Create a new AKS cluster or plan production configuration
- Design AKS networking (API server access, pod IP model, egress)
- Choose between AKS Automatic and Standard SKU
- Set up AKS identity, secrets, or governance (Azure Policy, Deployment Safeguards)
- Enable AKS observability (monitoring, Prometheus, Grafana)
- Define AKS upgrade strategy or cost controls
- Get a Day-0 checklist for AKS cluster setup

## Rules
1. Start with user requirements for compute, networking, security, and other settings.
2. Use `mcp_azure_mcp_aks` to invoke Azure APIs for AKS operations; fall back to Azure CLI (`az aks`) only when MCP tools lack the required functionality.
3. Default to **AKS Automatic** unless specific customizations require AKS Standard.
4. Document decisions and rationale, especially for Day-0 decisions (networking, API server access) that are hard to change later.

## Workflow

### 1. Cluster Type
- **AKS Automatic** (default): Curated experience with pre-configured best practices. Use unless you need customizations not supported by Node Auto Provisioning (NAP).
- **AKS Standard**: Full control over cluster configuration; additional overhead to set up and manage.

### 2–9. Detailed Configuration
See [cluster configuration guide](./references/cluster-configuration.md) for networking, security, observability, upgrades, performance, node pools, reliability, and cost controls.

## Guardrails / Safety
- Do not request or output secrets, tokens, or keys.
- If requirements are ambiguous for Day-0 critical decisions, ask the user clarifying questions. For Day-1 features, propose 2–3 safe options with tradeoffs and choose a conservative default.
- Do not promise zero downtime; advise workload safeguards (PDBs, probes, replicas) and staged upgrades.

## MCP Tools
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `mcp_azure_mcp_aks` | Create and query AKS clusters at subscription scope | `subscription_id`, `resource_group` |

## Error Handling
| Error / Symptom | Likely Cause | Remediation |
|-----------------|--------------|-------------|
| MCP tool call fails or times out | Invalid credentials, subscription, or cluster context | Verify `az login`, check subscription ID and resource group |
| Quota exceeded | Regional vCPU or resource limits | Request quota increase or select different region/VM SKU |
| Networking conflict (IP exhaustion) | Pod subnet too small for overlay/CNI | Re-plan IP ranges; may require cluster recreation (Day-0) |
| Workload Identity not working | Missing OIDC issuer or federated credential | Enable `--enable-oidc-issuer --enable-workload-identity`, configure federated identity |
