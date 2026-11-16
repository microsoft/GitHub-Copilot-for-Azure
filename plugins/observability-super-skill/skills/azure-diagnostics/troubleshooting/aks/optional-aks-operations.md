# Optional AKS Operations Handoff

Baseline AKS intake, Azure-side health checks, Kubernetes evidence, and safe
remediation reference material remain in this guide. An already available
`aks-skills` specialist is optional, never a dependency. Follow
[execution boundaries](../../references/execution-boundaries.md); do not install
or configure an add-on during investigation.

## Select the focused skill

| Skill | Exact boundary |
|-------|----------------|
| `aks-troubleshooting` | A live AKS incident in any scope bucket, including workload crashes, node, networking, ingress, upgrade, or scaling problems, where deeper target-bound operational investigation would help. An application-level cause does not exclude an AKS workload incident. |
| `aks-known-issues` | An exact, fully qualified catalog signature is present. A quota error, unqualified capacity symptom, or incomplete wrapper is not enough; an exact fully qualified catalog capacity signature remains eligible. |
| `aks-network-capture` | The customer explicitly requests packet capture and separately approves the bounded `pcap` plan. Generic network troubleshooting stays here. |
| `aks-gpu-inference` | An existing AKS GPU or inference deployment has a Day-2 incident. Initial setup stays in `airunway-aks-setup`. |

## Host and consent flow

1. Use the host-provided available-skill inventory, or an approved read-only
   host capability query. Do not require a CLI just to inspect availability and
   do not guess from literal skill-name prefixes.
2. If present and applicable, use only a supported host-native mechanism within
   retained scope/permissions. Availability is not proof of activation/execution;
   no deterministic sibling invocation is assumed.
3. If missing, continue this guide with existing authorized reads or supplied
   evidence. Do not install, offer installation as a checkpoint, or pretend the
   optional skill executed.

Installing the plugin does not approve resource changes or packet capture.
Follow the selected workflow's separate execution and mutation approvals.
