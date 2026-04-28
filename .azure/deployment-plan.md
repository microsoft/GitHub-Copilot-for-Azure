# Azure Deployment Plan

> **Status:** Planning

Generated: 2026-04-14

---

## 1. Project Overview

**Goal:** Create and deploy a new production Node.js/TypeScript web application on Azure VMSS with Azure SQL backend, autoscaling, and Application Gateway load balancing.

**Path:** New Project

---

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | Production |
| Scale | Large (high traffic, autoscaling) |
| Budget | Balanced |
| **Subscription** | Playground - 01 (`4b0a7581-9eea-4d30-a166-f8fac23b6edd`) |
| **Location** | East US |
| OS | Linux (Ubuntu) |
| VM Size | Standard_D4s_v5 (4 vCPUs, 16 GB RAM) |
| Hosting Model | VMSS (Flexible orchestration) |

---

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| Web App | SSR Web Server | Node.js / TypeScript / Express | `src/web/` |
| Database | Relational DB | Azure SQL | (managed service) |

---

## 4. Recipe Selection

**Selected:** Bicep

**Rationale:** User preference for native Azure IaC. Bicep provides first-class ARM integration, strong typing, and is ideal for VMSS + networking + SQL deployments.

---

## 5. Architecture

**Stack:** VMSS (Virtual Machine Scale Set) + Azure SQL

### Service Mapping

| Component | Azure Service | SKU / Config |
|-----------|---------------|--------------|
| Web App (VMSS) | Microsoft.Compute/virtualMachineScaleSets | Standard_D4s_v5, Flexible orchestration, 2–6 instances |
| Load Balancer | Microsoft.Network/applicationGateways | Application Gateway v2 (L7, TLS offload) |
| Database | Microsoft.Sql/servers + databases | Azure SQL S2 (50 DTU) |
| Virtual Network | Microsoft.Network/virtualNetworks | /16 VNet with subnets for VMSS, AppGW, SQL |
| NSG | Microsoft.Network/networkSecurityGroups | Allow HTTP/HTTPS inbound, restrict SSH |
| Public IP | Microsoft.Network/publicIPAddresses | Standard SKU, static, for AppGW frontend |

### Supporting Services

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | Monitoring & APM |
| Key Vault | Secrets management (DB connection string) |
| Managed Identity | VMSS-to-SQL and VMSS-to-KeyVault auth |

### Autoscale Configuration

| Setting | Value |
|---------|-------|
| Metric | CPU percentage |
| Scale-out threshold | 70% avg CPU for 5 min |
| Scale-in threshold | 30% avg CPU for 10 min |
| Min instances | 2 |
| Max instances | 6 |
| Cooldown | 5 minutes |

### Network Architecture

```
Internet → Public IP → Application Gateway (L7/TLS) → VMSS Subnet → VM instances
                                                                    ↓
                                                              SQL Private Endpoint
```

---

## 6. Provisioning Limit Checklist

### Resource Inventory & Quota Validation

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| Microsoft.Compute vCPUs (standardDSv5Family) | 24 (6×4 max) | 24 | 350 | ✅ Fetched from: az vm list-usage |
| Microsoft.Compute vCPUs (Total Regional) | 24 | 180 | 350 | ✅ Fetched from: az vm list-usage |
| Microsoft.Compute/virtualMachines | 6 (max) | 47 | 25,000 | ✅ Fetched from: az vm list-usage |
| Microsoft.Network/virtualNetworks | 1 | 62 | 1,000 | ✅ Fetched from: az network list-usages |
| Microsoft.Network/publicIPAddresses | 1 | 70 | 1,000 | ✅ Fetched from: az network list-usages |
| Microsoft.Network/networkSecurityGroups | 2 | 216 | 5,000 | ✅ Fetched from: az network list-usages |
| Microsoft.Network/loadBalancers (Standard) | 1 (AppGW) | 49 | 1,000 | ✅ Fetched from: az network list-usages |
| Microsoft.Sql/servers | 1 | 2 | 20 per region | ✅ Fetched from: Azure Resource Graph + official docs |
| Microsoft.KeyVault/vaults | 1 | ~1 | 10,000 per region | ✅ Fetched from: official docs |
| Microsoft.OperationalInsights/workspaces | 1 | ~1 | 50 per region | ✅ Fetched from: official docs |

**Status:** ✅ All resources within limits

---

## 7. Execution Checklist

### Phase 1: Planning
- [x] Analyze workspace (new project)
- [x] Gather requirements (production, large, balanced, Linux)
- [x] Confirm subscription and location with user (Playground - 01, eastus)
- [x] Prepare resource inventory
- [x] Fetch quotas and validate capacity
- [x] Scan codebase (N/A — new project)
- [x] Select recipe (Bicep)
- [x] Plan architecture (VMSS + AppGW + SQL)
- [ ] **User approved this plan**

### Phase 2: Execution
- [ ] Research components (load Bicep references)
- [ ] Generate infrastructure files (`infra/main.bicep`, modules)
- [ ] Generate application code (`src/web/` — Express/TypeScript app)
- [ ] Generate custom-data script (cloud-init to bootstrap Node.js on VMs)
- [ ] Generate application configuration
- [ ] Apply security hardening (NSG rules, Key Vault, managed identity)
- [ ] ⛔ Update plan status to "Ready for Validation"

### Phase 3: Validation
- [ ] Invoke azure-validate skill
- [ ] All validation checks pass
- [ ] Update plan status to "Validated"

### Phase 4: Deployment
- [ ] Invoke azure-deploy skill
- [ ] Deployment successful
- [ ] Report deployed endpoint URLs
- [ ] Update plan status to "Deployed"

---

## 8. Files to Generate

| File | Purpose | Status |
|------|---------|--------|
| `.azure/deployment-plan.md` | This plan | ✅ |
| `infra/main.bicep` | Root Bicep template | ⏳ |
| `infra/modules/vmss.bicep` | VMSS + autoscale config | ⏳ |
| `infra/modules/network.bicep` | VNet, subnets, NSG, AppGW | ⏳ |
| `infra/modules/sql.bicep` | Azure SQL Server + Database | ⏳ |
| `infra/modules/monitoring.bicep` | Log Analytics + App Insights | ⏳ |
| `infra/modules/keyvault.bicep` | Key Vault + secrets | ⏳ |
| `infra/cloud-init.yaml` | VM bootstrap script (Node.js setup) | ⏳ |
| `src/web/package.json` | Node.js dependencies | ⏳ |
| `src/web/tsconfig.json` | TypeScript config | ⏳ |
| `src/web/src/index.ts` | Express app entry point | ⏳ |

---

## 9. Cost Estimate

| Resource | Unit Cost | Monthly Estimate |
|----------|-----------|-----------------|
| VMSS (2–6× Standard_D4s_v5) | $0.192/hr per VM | $280–$840 |
| Application Gateway v2 | ~$0.246/hr + data | ~$180 |
| Azure SQL S2 (50 DTU) | ~$75/mo | ~$75 |
| Log Analytics (5 GB/day) | ~$2.30/GB | ~$350 |
| Key Vault | ~$0.03/10K ops | <$5 |
| **Total estimate** | | **~$885–$1,450/mo** |

> 💡 Consider 1-year reserved instances for VMSS to save ~35%.

---

## 10. Next Steps

> Current: Awaiting user approval

1. User approves this plan
2. Generate all infrastructure and application files
3. Validate with azure-validate
4. Deploy with azure-deploy
