# MCP Integration Reference

Loaded when discovering Azure MCP capabilities, collecting live cluster metadata, or debugging the fallback chain.

---

## Capability Discovery

Inspect the host's available tool catalog, descriptions, and input schemas for an Azure MCP capability that advertises AKS operations. In GitHub Copilot this is surfaced as `mcp_azure_mcp_aks`; other hosts assign their own names. Invoke the matching capability under its host-assigned name and advertised schema.

- If the host exposes a list, learn, or discovery operation, use it.
- Otherwise, rely on the tool catalog and schema the host already supplied.
- Never infer that Azure MCP is absent because a literal tool name is missing.
- Do not translate names between hosts or create a mapping layer.

The currently documented Azure MCP AKS surface provides read-only operations for:

- AKS cluster details (get/list)
- AKS node-pool details (get/list)

It does **not** document an AKS Automatic readiness-assessment operation, a workload assessment response schema, or an assessment polling action. Earlier versions of this skill described such an API; it does not exist. See [Azure Kubernetes Service tools for the Azure MCP Server](https://learn.microsoft.com/azure/developer/azure-mcp-server/tools/azure-kubernetes).

---

## Role in Readiness Assessment

Use the discovered Azure MCP AKS capability only for operations its schema advertises:

1. Read cluster configuration and status.
2. Read node-pool configuration and status.
3. Collect sanitized workload manifests through a host capability with an equivalent allowlist projection, or pipe `kubectl` JSON through [`scripts/sanitize-readiness-input.jq`](../scripts/sanitize-readiness-input.jq) (requires `jq`) before the result reaches the model.
4. Evaluate cluster metadata and manifests locally against `constraint-spec-v1.yaml`.

Do not request `Secret` or ConfigMap resources. The assessment needs selected workload fields, Services, PodDisruptionBudgets, and StorageClass provisioners, not secret values. The bundled filter uses an allowlist projection so unrecognized fields (env values, `envFrom`, volume sources, non-AppArmor annotations, `managedFields`, `status`) are dropped by default.

Representative redacted Kubernetes read (run from the skill root):

```bash
set -o pipefail
kubectl get deployment,statefulset,daemonset,job,cronjob,pod,service,poddisruptionbudget,storageclass \
  -A -o json |
jq -f scripts/sanitize-readiness-input.jq
```

If `jq` is not installed, do not paste raw `kubectl -o json` output to the model. Ask the user for rendered manifests, or use a host Kubernetes read that supports field projection.

All assessment conclusions and suggested patches come from the bundled constraint spec and the collected manifests, not from an assumed MCP response contract.

---

## Fallback Chain

Attempt the applicable path without asking the user to identify tool availability:

```text
Cluster and node-pool metadata:
1. Inspect host tools for an Azure MCP AKS read capability
   -> invoke the matching capability under its host-assigned name and schema
   -> if unavailable or insufficient, use `az aks show` / `az aks nodepool list`

Workload manifests:
1. Use a host Kubernetes read with field projection, or the locally redacted `kubectl | jq` pipeline
   -> if cluster access is unavailable, use local, rendered, or user-provided manifests

Assessment:
1. Evaluate collected data locally against `constraint-spec-v1.yaml`
2. When the cluster is reachable, confirm which conditional rules are active:
   `kubectl get constraints` (Gatekeeper) — report Restricted-only/Windows rules only if present
```

CLI metadata fallback:

```bash
az aks show \
  --resource-group <resource-group> \
  --name <cluster>

az aks nodepool list \
  --resource-group <resource-group> \
  --cluster-name <cluster>
```

---

## Azure SRE Agent

Azure SRE Agent's built-in Azure operations, diagnostics, monitoring, and `kubectl` tools use the agent's managed identity and require no connector. Prefer those built-in capabilities when they satisfy the read. See [Tools in Azure SRE Agent](https://learn.microsoft.com/azure/sre-agent/tools).

Installing this plugin records its `.mcp.json` requirement but does not provision the external connector. **Connector setup required** is a non-blocking plugin status. If the external Azure MCP surface is needed:

1. Open the plugin details and select **Add as connector**, or go to **Builder > Connectors**.
2. Complete the connector authentication.
3. Wait for the connector status to show **Connected**.
4. Select the required Azure MCP tools for the agent.

See the official [plugin marketplace guidance](https://learn.microsoft.com/azure/sre-agent/plugin-marketplace#what-the-plugin-marketplace-does) and [MCP connector tutorial](https://learn.microsoft.com/azure/sre-agent/mcp-connector).

If a built-in Azure or Kubernetes read fails, check that the target resource group is in the agent's scope and that its user-assigned managed identity has the required RBAC. Do not tell an SRE Agent user to configure Azure MCP "in the editor" or default to local `az login` remediation. See [SRE Agent permissions](https://learn.microsoft.com/azure/sre-agent/permissions).

---

## Other Hosts

If capability discovery finds no Azure MCP AKS tool, explain that the current host does not expose that capability. Point to the host's MCP configuration flow or the official [Azure MCP Server setup overview](https://learn.microsoft.com/azure/developer/azure-mcp-server/get-started), use the explicit `az`/`kubectl` fallbacks, and continue with offline validation when live access is unavailable.

For CLI-backed hosts, verify:

```bash
az account show --query "{name:name, id:id, state:state}" -o table
kubectl config current-context
kubectl cluster-info
```

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| No Azure MCP AKS capability appears in the host catalog | External connector/server is unavailable, or the host uses a different built-in Azure surface | In Azure SRE Agent, use built-in Azure tools or configure the external connector only if needed; in other hosts, configure Azure MCP. Use `az` for metadata while unavailable |
| Discovered AKS capability lacks a readiness-assessment operation | Expected for the currently documented Azure MCP AKS surface | Use advertised cluster/node-pool reads, collect sanitized manifests through Kubernetes-native tools, and evaluate `constraint-spec-v1.yaml` locally |
| Azure or Kubernetes read fails in Azure SRE Agent | Agent UAMI lacks target scope or RBAC | Check managed resource groups and role assignments in [SRE Agent permissions](https://learn.microsoft.com/azure/sre-agent/permissions) |
| `HTTP 401 Unauthorized` in a CLI-backed host | Azure CLI session is not authenticated | Run `az login` and verify `az account show` |
| `HTTP 403 Forbidden` | Identity lacks read access | Grant the least-privilege read role at the target scope (for example, Azure Kubernetes Service Cluster User Role for `kubectl` access) |
| `HTTP 404 Not Found` | Wrong subscription, resource group, or cluster name | Verify the target with the discovered Azure capability or `az aks list -o table` |
| `kubectl` cannot read workloads | Missing context or Kubernetes RBAC | Verify context and read permissions, or use local/rendered manifests |
| `jq: command not found` | Sanitizer dependency missing | Install `jq`, or fall back to rendered manifests / a projecting host read; never send raw cluster JSON to the model |
