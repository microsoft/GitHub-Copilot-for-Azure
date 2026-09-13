# Optional AKS Operations Add-on

The base Azure plugin owns AKS recommendation, Day-0 planning, cluster setup,
application deployment, readiness, and basic operations. The sibling
`aks-skills` plugin is optional and contains focused, deeper operational
workflows.

## Capability and consent flow

1. Check the host-provided available-skill inventory. If the host supports an
   approved read-only capability query, that query may be used instead. Do not
   run a CLI merely to discover skills and do not guess availability from an
   `aks-` name prefix.
2. If the focused skill is available, invoke it through the host's native skill
   capability. Do not install or load every AKS operational skill.
3. If it is missing and useful, explain the task-specific benefit and ask for
   consent before installation. After approval, use the host-supported plugin
   manager or installation path. Do not invent a host-specific command or
   bypass host policy.
4. If the customer declines, or the host cannot install or execute the add-on,
   continue the base workflow with available Azure/Kubernetes reads or supplied
   evidence. Do not dead-end or imply that optional execution occurred.

Installation consent does not approve resource mutation, packet capture, or
other execution. Apply each focused skill's own approval gates separately.

## Focused routing

| Skill | Use only when |
|-------|---------------|
| `aks-troubleshooting` | The customer has an open AKS incident that benefits from deeper target-bound investigation. |
| `aks-known-issues` | The supplied or retrieved failure includes an exact, fully qualified catalog signature. Do not use it for a generic symptom, quota issue, or incomplete wrapper error. |
| `aks-network-capture` | The customer explicitly requests and separately approves a packet capture (`pcap`) workflow. Generic connectivity troubleshooting stays in baseline diagnostics. |
| `aks-gpu-inference` | An existing AKS GPU or inference deployment has a Day-2 incident. Initial GPU cluster, provider, or model setup stays with the base setup workflow. |
