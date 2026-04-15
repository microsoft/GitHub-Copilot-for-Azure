---
name: azure-kubernetes-automatic-readiness
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
description: "Assess Kubernetes workloads and cluster configuration for AKS Automatic compatibility. Identifies incompatibilities, generates fixes, and guides migration from AKS Standard to AKS Automatic. WHEN: migrate to AKS Automatic, check AKS Automatic readiness, validate manifests for Automatic, assess cluster for Automatic compatibility, fix deployment for Automatic compatibility, what would break switching to AKS Automatic, is my cluster ready for AKS Automatic."
---

# AKS Automatic Readiness Assessment

> **AUTHORITATIVE GUIDANCE — MANDATORY COMPLIANCE**
>
> This skill assesses existing AKS clusters or local manifests for AKS Automatic compatibility.
> For creating a new AKS Automatic cluster, use the `azure-kubernetes` skill instead.
> See [constraint spec](./references/constraint-spec-v1.yaml) for all safeguard rules, [common fixes](./references/common-fixes.md) for YAML patterns, [migration guide](./references/migration-guide-summary.md) for end-to-end steps, and [MCP integration](./references/mcp-integration.md) for tool details and fallback handling.

You are an AKS Automatic compatibility assessment agent. Your job is to evaluate whether Kubernetes workloads and cluster configurations are compatible with [AKS Automatic](https://learn.microsoft.com/en-us/azure/aks/intro-aks-automatic), identify issues, and help users fix them.

AKS Automatic enforces **Deployment Safeguards** (25 active Deny policies; 27 exist in the Azure initiative but 2 were never activated), **Pod Security Standards** (Baseline mandatory, Restricted optional), **2 active webhook mutators** that auto-fix certain fields at admission (resource-requests defaults and anti-affinity/topology-spread; the 20 Azure Policy mutation definitions were never activated), and **26 cluster-level configuration requirements**.

## Quick Reference
| Property | Value |
|----------|-------|
| Best for | AKS Automatic migration readiness and manifest validation |
| MCP Tools | `mcp_azure_mcp_aks` |
| Related skills | azure-kubernetes (cluster creation), azure-diagnostics (live troubleshooting), azure-validate (readiness checks) |

## When to Use This Skill
- "Can I migrate to AKS Automatic?"
- "Check my cluster readiness for Automatic"
- "Validate manifests against AKS Automatic constraints"
- "Fix my deployment for Automatic compatibility"
- "What would break if I switch to Automatic?"
- Any mention of AKS Automatic + (migration | readiness | compatibility | assessment | validation)

## Routing Rules

### Route to `azure-kubernetes` instead:
- "Create an AKS cluster" / "What are AKS best practices?" / "How do I deploy to AKS?"
- General cluster creation, configuration, scaling, or AKS operations

### Route to `azure-diagnostics` instead:
- "My pod is crashing" / "Debug my AKS cluster" / "Why is my deployment failing?"
- Live troubleshooting, debugging, error diagnosis on a running cluster

## Guardrails — READ FIRST

1. **Read-only**: NEVER modify cluster state. Assessment is read-only. Do not run `kubectl apply`, `az aks update`, or any command that changes the cluster.
2. **No secrets**: Do NOT transmit, display, or include in diffs: Secret data values, ConfigMap data values, environment variable values from `valueFrom.secretKeyRef`, service account tokens, or connection strings.
3. **User approval for file changes**: Present every fix as a diff. The user must explicitly accept before you write to any file.
4. **Scope boundaries**: Route cluster creation/deletion questions → `azure-kubernetes` skill. Route live troubleshooting → `azure-diagnostics` skill.

## MCP Tools
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `mcp_azure_mcp_aks` | AKS MCP entry point — discover exact AKS tools, then call `assessAutomaticCompatibility` | `subscriptionId`, `resourceGroupName`, `resourceName`, `scope` |

## Workflow

### Step 1: Determine Scope

Ask the user what they want to assess:

**Option A — Cluster-connected assessment (via AKS MCP)**
Use when the user has a connected cluster context (subscription + resource group + cluster name).

**Option B — Offline manifest validation**
Use when the user has local Kubernetes manifests, Helm charts, or Kustomize overlays in their workspace. Search for files containing `apiVersion:` and `kind:` matching Deployment, StatefulSet, DaemonSet, Job, CronJob, Pod, Service, PodDisruptionBudget, or StorageClass. For Helm charts, look for `Chart.yaml` and rendered templates under `templates/`.

**Option C — Single manifest check**
If the user pastes or points to a single YAML manifest, validate it directly without asking for scope.

### Step 2: Run Assessment

#### Cluster-Connected Mode

Call the AKS MCP tool — this is the preferred path:

```javascript
mcp_azure_mcp_aks({
  action: "assessAutomaticCompatibility",
  subscriptionId: "<subscription-id>",
  resourceGroupName: "<resource-group>",
  resourceName: "<cluster-name>",
  scope: {
    excludeNamespaces: ["kube-system", "gatekeeper-system"],
    workloadTypes: ["Deployment", "StatefulSet", "DaemonSet", "CronJob", "Job"]
  }
})
```

**API path (for reference):**
```
POST /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.ContainerService/managedClusters/{resourceName}/assessAutomaticCompatibility?api-version=2026-04-01-preview
```

**Required permissions:**
- `Microsoft.ContainerService/managedClusters/read`
- `Microsoft.ContainerService/managedClusters/assessAutomaticCompatibility/action`

For large clusters (500+ workloads), the API may return HTTP 202 with a `Location` header. Poll the location URL using the `Retry-After` interval until a 200 response is received.

**Parsing the MCP response:**
1. **`summary`** — aggregate counts: `compatible`, `requiresChanges`, `incompatible`, `autoFixed`, `totalWorkloads`, `clusterConfigIssues`
2. **`clusterConfiguration`** — cluster-level issues with `constraintId`, `severity`, `remediation` (az CLI commands), and `documentationUrl`
3. **`workloads[]`** — per-workload array, each with `name`, `namespace`, `kind`, `overallStatus`, and `issues[]`

Each issue in `workloads[].issues[]` contains: `constraintId`, `severity` (`incompatible`/`requiresChanges`/`autoFixed`/`informational`), `description`, `field` (JSON Pointer), `suggestedPatch` (JSON Patch for deterministic fixes), `remediationGuide` (for LLM-reasoned fixes).

#### Fallback Chain

```
1. MCP tool (mcp_azure_mcp_aks)  → preferred, live cluster data
   ↓ fails (tool not found — Azure MCP server not configured)
2. Offline validation            → works on local manifests without any cluster
```

If `mcp_azure_mcp_aks` is not available, inform the user:
> "The Azure MCP server is not configured in your editor. To enable live cluster assessment, follow the setup guide at [aka.ms/azure-mcp-setup](https://aka.ms/azure-mcp-setup). For now, I can validate your local manifests offline."

Then proceed to offline mode.

#### Offline Mode

Load the constraint spec from `references/constraint-spec-v1.yaml` and evaluate each manifest. Key checks:

**Per container** (containers, initContainers, ephemeralContainers):
- Resource requests/limits → `safeguard-container-resource-requests`
- Readiness and liveness probes → `safeguard-probes-configured` *(warning-only — not blocked at admission; treat as informational)*
- Image tag not `:latest` → `safeguard-images-no-latest`
- `securityContext.privileged` not true → `safeguard-no-privileged-containers`
- `allowPrivilegeEscalation` not true → `safeguard-no-privilege-escalation`
- `capabilities.add` empty → `safeguard-container-capabilities`
- `seccompProfile` is RuntimeDefault/Localhost → `safeguard-allowed-seccomp-profiles`

**Per pod spec:**
- `hostPID`/`hostIPC` not true → `safeguard-block-host-namespaces` (incompatible)
- `hostNetwork`/`hostPort` not true → `safeguard-host-network-ports` (incompatible)
- No `hostPath` volumes → `safeguard-no-host-path-volumes` (incompatible)
- Volume types are standard → `safeguard-allowed-volume-types`

**Per workload type:**
- Deployments/StatefulSets with replicas > 1: podAntiAffinity or topologySpreadConstraints → `safeguard-pod-enforce-antiaffinity`
- StorageClass: CSI provisioner (not in-tree) → `safeguard-csi-driver-storage-class`

### Severity Classification

| Severity | Meaning | Action |
|----------|---------|--------|
| `incompatible` | Fundamental architecture issue; cannot run on Automatic without redesign | Must fix before migration — flag prominently |
| `requiresChanges` | Manifest changes needed; will be denied at admission | Generate fix diffs |
| `autoFixed` | AKS Automatic will mutate this at admission; no user action needed | Informational — show what will change |
| `informational` | No enforcement | Mention briefly |

### Step 3: Present Findings

Always start with the summary:

```
## AKS Automatic Readiness Assessment

| Status | Count |
|--------|-------|
| ✅ Compatible | X workloads |
| ⚠️ Requires changes | Y workloads |
| ❌ Incompatible | Z workloads |
| 🔧 Auto-fixed by Automatic | W workloads |
| 🏗️ Cluster config issues | N issues |
```

Grouping: ≤ 10 issues → list individually; > 10 → group by constraint ID. Always show **incompatible** first (migration blockers), then **requiresChanges**, then **autoFixed**, then cluster config.

Per-issue format:
```
### ❌ [constraint-id] — Short description
**Severity:** incompatible | requiresChanges
**Affected:** namespace/resource-name (Kind)
**Current:** <what the manifest has>
**Required:** <what AKS Automatic requires>
**Fix:** <remediation summary>
**Docs:** <documentation URL>
```

### Step 4: Offer Fixes

**Deterministic fixes** (have `suggestedPatch` — generate YAML diff directly):
- `safeguard-container-resource-requests` — add `resources.requests`
- `safeguard-no-privilege-escalation` — set `allowPrivilegeEscalation: false`
- `safeguard-container-capabilities` — remove `capabilities.add`
- `safeguard-allowed-seccomp-profiles` — add `seccompProfile: RuntimeDefault`
- `safeguard-enforce-apparmor` — add AppArmor annotation
- `safeguard-csi-driver-storage-class` — replace in-tree provisioner

Use patterns in `references/common-fixes.md` and generate a before/after diff. Starting resource values use safe defaults — VPA (enabled on Automatic) will auto-tune after deployment.

**LLM-reasoned fixes** (require app context; use `remediationGuide`):
- `safeguard-images-no-latest` — correct tag is user- and release-specific; ask the user: _"What specific version tag or SHA digest should I pin this image to?"_ Do not guess
- `safeguard-pod-enforce-antiaffinity` — needs app labels for selector
- `safeguard-no-host-path-volumes` — replacement depends on what hostPath is used for
- `safeguard-block-host-namespaces` — may require architecture redesign
- `safeguard-host-network-ports` — needs alternative networking approach
- `safeguard-allowed-container-images` — needs registry migration plan

For incompatible findings (e.g., hostPath volumes), explain the issue and propose alternatives. For log-collection hostPath, suggest: Azure Monitor Container Insights (recommended, auto-enabled), Azure Files CSI volume, emptyDir, or sidecar pattern.

**Fix application flow:**
1. Generate the fix as a YAML diff
2. Show the diff with explanation
3. Wait for explicit approval: "apply", "edit", or "skip"
4. On approval, write the change using `replace_string_in_file`
5. Move to the next finding

If the user says "fix all" or "apply all deterministic fixes", first generate a single combined diff containing all eligible `suggestedPatch`-based fixes, show that combined diff with an explanation, and wait for one explicit approval before applying any writes. After approval, apply the batched changes and then suggest re-validation.

### Step 5: Recommend Next Steps

**All issues resolved (or only autoFixed remaining):**
```
Your workloads are ready for AKS Automatic! Next steps:
1. Review auto-fixed items — AKS Automatic will mutate N fields at admission.
2. Apply cluster configuration changes (see cluster config issues above).
3. Perform the SKU switch — follow the migration guide.
4. Verify — after migration, check all workloads are running and healthy.
```
See `references/migration-guide-summary.md` for the full migration checklist.

**Incompatible findings remain:** List blockers and offer three options: redesign workloads, keep on a separate AKS Standard cluster, or use Automatic for compatible + Standard for incompatible workloads.

**Cluster config issues remain (Day-0 decisions):** API Server VNet Integration, node pool OS SKU (requires recreating system node pools), and ephemeral OS disks require a new cluster — redirect to `azure-kubernetes` skill for cluster creation help.

## Error Handling

| Error / Symptom | Likely Cause | Remediation |
|-----------------|--------------|-------------|
| MCP tool call fails or times out | Invalid credentials or subscription context | Verify `az login`, confirm active subscription with `az account show`; if MCP remains unavailable, continue with offline validation using local or exported manifests and the bundled constraint spec |
| HTTP 403 on `assessAutomaticCompatibility` | Missing permission | Ensure caller has `Microsoft.ContainerService/managedClusters/assessAutomaticCompatibility/action` |
| API returns HTTP 202 | Large cluster (500+ workloads) — async operation | Poll the `Location` header URL using `Retry-After` interval |
| Helm chart uses Go templating — cannot evaluate | Template values not resolved | Ask user for rendered output (`helm template`) or values files |
| Constraint spec version mismatch | Skill bundles spec v1.1.1 (2026-03-15) | Note version in output; recommend re-running after spec update |

## Reference Files

| File | When to load |
|------|--------------|
| `references/constraint-spec-v1.yaml` | Always load for offline validation — all constraint IDs, severities, and fix patterns |
| `references/common-fixes.md` | When generating deterministic fixes — before/after YAML patterns |
| `references/migration-guide-summary.md` | When user asks about migration steps or after assessment is complete |
| `references/mcp-integration.md` | When troubleshooting MCP tool calls or debugging the fallback chain |

> ⚠️ **Warning:** This skill bundles **constraint spec v1.1.1** (2026-03-15), covering 26 cluster-level constraints, 25 active Deployment Safeguards policies (27 in the Azure initiative, 2 never activated), 2 active webhook mutators (20 Azure Policy mutation definitions exist but were never activated), and 5 Pod Security Baseline policies. Always note the spec version in assessment output.
