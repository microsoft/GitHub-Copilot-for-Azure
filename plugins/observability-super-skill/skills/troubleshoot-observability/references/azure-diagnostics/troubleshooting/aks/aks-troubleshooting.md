# AKS Troubleshooting Guide

Primary AKS troubleshooting guide for incidents routed from [../../SKILL.md](../../SKILL.md).

> **Local adaptation:** [Execution boundaries](../../references/execution-boundaries.md)
> govern all linked recipes. Supplied sanitized evidence and bounded existing-tool
> reads come first. No script auto-run, installation, kubeconfig fetching,
> probes, debug pods or remediation under investigation permissions.

## When to Use This Guide

- lifecycle, access, node, `kube-system`, workload, ingress, DNS, or scaling issues
- `kubectl` cannot connect, nodes are `NotReady`, or pods are unhealthy

## Scenario Playbooks

| Scenario                                                      | Reference                                        |
| ------------------------------------------------------------- | ------------------------------------------------ |
| broad cluster investigation                                   | [general-diagnostics.md](general-diagnostics.md) |
| workload, crash, image pull, readiness, or pending pod issues | [pod-failures.md](pod-failures.md)               |
| node health, scaling, pressure, upgrade, or zone issues       | [node-issues.md](node-issues.md)                 |
| service, ingress, DNS, or network policy issues               | [networking.md](networking.md)                   |

## Tool Selection For Diagnostics

When gathering AKS diagnostic evidence, use the host-assigned Azure MCP AKS area for cluster and node-pool metadata, then separate Azure MCP areas such as AppLens, Monitor, or Resource Health when their advertised schemas fit the read. Use `az aks` and `kubectl` for every check those surfaces do not provide, including all Kubernetes-side inspection; the AKS area does not run `kubectl`.

Inspektor Gadget is a privileged, mutating diagnostic option outside read-only
permissions, not an automatic fallback. See [references/inspektor-gadget.md](references/inspektor-gadget.md)
for the preserved catalog and separate approval requirements.

See [references/aks-mcp.md](references/aks-mcp.md), [references/structured-input-modes.md](references/structured-input-modes.md), [references/command-flows.md](references/command-flows.md)

The optional, consent-gated `aks-skills` add-on is handled by the Workflow's
focused-skill checkpoint below; this baseline guide remains usable when it is
not installed or cannot execute.

## Required Inputs

- subscription or active Azure context
- resource group and cluster name
- symptom summary
- first observed time or recent change window
- impacted namespace, workload, service, or ingress when known

Reuse confirmed target/context or request the missing identifiers. Do not fetch
kubeconfig, change context, auto-select a discovered cluster, scan every namespace
or install/configure kubectl. Before separately approved Kubernetes reads, confirm
that the existing kubectl context matches the incident's cluster/subscription.
Otherwise continue from supplied sanitized evidence and name the context blocker.

## Scope Buckets

- Lifecycle: create, update, start, stop, upgrade, or provisioning failures
- API access: kubeconfig, auth, private endpoint, DNS, or reachability problems
- Nodes: missing nodes, `NotReady`, pressure, CNI, kubelet, certificate, or VMSS drift
- `kube-system`: CoreDNS, metrics-server, konnectivity, ingress, CNI, CSI, or add-on failures
- Workloads: `Pending`, `CrashLoopBackOff`, `OOMKilled`, PVC, quota, secret, readiness, or dependency issues
- Connectivity and DNS: pod -> service -> endpoints -> ingress/load balancer -> DNS -> network controls
- Scaling: node pool sizing, pending pods, autoscaler config, metrics, quota, or subnet constraints

## Evidence Order

1. The classified symptom selects the first read. For lifecycle, API-access, node, scaling, quota, upgrade, or broad and unclassified symptoms, start Azure-side: cluster state, resource health, recent operations, node pool state, detector or monitoring output.
2. For a clearly identified workload failure (a named pod in `CrashLoopBackOff`, `ImagePullBackOff`, `OOMKilled`, or a similar pod-local state), start with pod state, events, and current/previous logs — supplied or collected — then expand to node and Azure evidence only as the causal branch requires; no broad Azure sweep first. Otherwise Kubernetes-side state follows the Azure-side read: reachability, nodes, `kube-system`, events, affected namespace, pod detail, logs.
3. Use detector, warning-event, or metrics modes when the incoming data already matches them.
4. If evidence remains insufficient, return INCONCLUSIVE with the smallest missing
   check. [Inspektor Gadget](references/inspektor-gadget.md) is not a read-only fallback.

## Workflow

1. Get cluster context.
2. Classify the problem by scope bucket.
3. Optionally consider an already available focused skill if useful, within the
   same scope/permissions. [Optional AKS operations](optional-aks-operations.md)
   are not an installation or handoff prerequisite. Continue this guide when absent.
4. Follow the Evidence Order above.
5. Use the matching Azure MCP area for Azure-side metadata where its schema fits, then the documented `az`/`kubectl` flows for everything else.
6. Return evidence, failure domain, confidence, next checks, remediation, and escalation.

## Error Patterns

- No cluster context: ask for subscription, resource group, and cluster name.
- MCP unavailable: fall back to safe `az aks` and `kubectl` reads.
- `kubectl` blocked: separate auth problems from network reachability.
- Logs or metrics missing: use events, node state, and resource descriptions.
- Detector noise: ignore `emergingIssues`, prefer critical findings, rank the most actionable signal first.

## Safe Fallback Checks

When an existing tool cannot perform a read, continue evidence-only; do not
automatically fall back to scripts. The preserved **[`aks-baseline`](../../scripts/aks-baseline.sh)**
script requires inspection and separate explicit local-execution approval. It
collects cluster/Kubernetes state, not Resource Health, and may exceed incident scope:

```bash
# bash
./scripts/aks-baseline.sh -g <resource-group> -n <cluster-name> [--namespace <namespace>]
```

```powershell
# PowerShell
.\scripts\aks-baseline.ps1 -ResourceGroup <resource-group> -Cluster <cluster-name> [-Namespace <namespace>]
```

The preserved pod-evidence script collects raw logs and is not a baseline action;
review its limitations in the execution boundaries before any separately approved use:
[`../../scripts/pod-evidence.sh`](../../scripts/pod-evidence.sh) /
[`../../scripts/pod-evidence.ps1`](../../scripts/pod-evidence.ps1). Do not use
all-namespace auto-discovery to widen the retained scope:

```bash
../../scripts/pod-evidence.sh <pod-name> -n <namespace>
../../scripts/pod-evidence.sh --all-failing
```
```powershell
../../scripts/pod-evidence.ps1 <pod-name> -Namespace <namespace>
../../scripts/pod-evidence.ps1 -AllFailing
```

See [pod-failures.md](pod-failures.md) for how to interpret the digest.

Commands below are reference examples for separately approved local execution,
not automatic fallbacks. If kubectl is missing or unconfigured, report the gap
and use supplied evidence; do not install or configure it:

```bash
az aks show -g <resource-group> -n <cluster-name>
az aks nodepool list -g <resource-group> --cluster-name <cluster-name>
kubectl cluster-info
kubectl get nodes -o wide
kubectl get pods -n kube-system
kubectl get events -A --sort-by=.lastTimestamp
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --previous
```

Keep these read-only unless the user explicitly asks for remediation.

## Guardrails

- default to read-only diagnostics
- do not restart, delete, cordon, drain, scale, upgrade, or reconfigure resources unless the user explicitly asks for remediation
- do not conclude root cause without quoting the evidence that supports it

## Output Checklist

Return scope, observed impact, sanitized evidence, hypotheses and alternatives,
coverage gaps, next checks and unexecuted remediation options. Insufficient
evidence yields INCONCLUSIVE, not a certain root cause or numerical confidence.
Distinguish instructions loaded, operations executed and fallback used; mention
an optional skill only when its selection or absence explains the outcome.
