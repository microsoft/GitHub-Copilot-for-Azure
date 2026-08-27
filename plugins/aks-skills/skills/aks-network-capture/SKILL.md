---
name: aks-network-capture
description: "Collects bounded packet captures from AKS nodes and Azure network configuration for wire-level evidence. WHEN: \"capture packets on an AKS node\", \"take a pcap\", \"run tcpdump on AKS\", \"prove where packets drop\". Use for explicit packet-capture intent after read-only diagnostics, not general AKS connectivity or ingress troubleshooting."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# AKS Network Capture

## Quick Reference

| Use | Requires | Safety |
| --- | --- | --- |
| AKS pcap evidence | `kubectl`; `az` for Azure evidence | Bounded, pinned, least privilege |

## When to Use This Skill

Use for explicit packet capture after read-only checks, not generic connectivity failures.

## MCP Tools

None. Run scripts from the skill root.

## Workflow/Steps

1. Install [Bash](scripts/setup-capture-configmap.sh) / [PowerShell](scripts/setup-capture-configmap.ps1).
2. Capture nodes or pods with [Bash](scripts/create-capture.sh) / [PowerShell](scripts/create-capture.ps1).
3. Generate traffic if needed with [Bash](scripts/generate-test-traffic.sh) / [PowerShell](scripts/generate-test-traffic.ps1).
4. Retrieve the exact run with [Bash](scripts/retrieve-captures.sh) / [PowerShell](scripts/retrieve-captures.ps1).
5. Gather Azure evidence with [Bash](scripts/collect-azure-network-info.sh) / [PowerShell](scripts/collect-azure-network-info.ps1).

The ConfigMap runs [run-capture.sh](scripts/run-capture.sh) inside its pinned Linux image.

```bash
./scripts/create-capture.sh --name dns-debug --tcpdump-filter "udp port 53" --duration 120s
```

```powershell
./scripts/create-capture.ps1 -Name dns-debug -TcpdumpFilter "udp port 53" -Duration 120s
```

## Error Handling

| Error | Action |
| --- | --- |
| Invalid input | Correct it before retrying. |
| Missing/stale ConfigMap | Run setup again. |
| Capture/retrieval failure | Inspect Job logs; missing evidence is not success. |
