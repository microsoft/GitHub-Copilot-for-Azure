# Container Assessment Workflow

## Step 5: Run Container Best Practices Assessment

See [AKS Container Best Practices](./aks-container-best-practices.md) for complete checks, commands, and scoring.

### Namespace Setup

Separate system namespaces (`kube-system`, `kube-node-lease`, `kube-public`, `gatekeeper-system`) from application namespaces for distinct reporting.

### Check Categories

Execute all validation commands for:

| Category | Check IDs | Scope |
|----------|-----------|-------|
| Image Hygiene | `CTR-IMG-*` | Tag pinning, pull policies, private registries, ACR |
| Security Context | `CTR-SEC-*` | runAsNonRoot, readOnlyRootFilesystem, privileges, capabilities, seccomp |
| Resource Management | `CTR-RES-*` | CPU/memory requests/limits, QoS distribution, limit-to-request ratios |
| Health Probes & Lifecycle | `CTR-PROBE-*`, `CTR-LIFE-*` | Readiness/liveness/startup probes, preStop hooks, rolling updates |
| Pod Security | `CTR-POD-*` | Service account tokens, hostNetwork/PID/IPC, hostPath, PSS labels |
| Config Hygiene | `CTR-CFG-*` | Inline secrets, ConfigMap/Secret usage, naked pods, ports |
| Network | `CTR-NET-*` | NetworkPolicy coverage, default-deny, service types |
| Supply Chain | `CTR-ACR-*` | Vulnerability scanning, content trust, retention, webhooks |

### Counting Methodology

Count every **running container instance** (not unique specs) — includes scaled replicas and injected sidecars. Separately report sidecar/proxy container counts. State methodology explicitly in report.

### Sidecar-Aware Compliance

Where sidecars materially affect metrics (e.g., `runAsNonRoot`, readiness probes), report both sidecar-inclusive and application-only percentages.

### Scoring

- Compute per-namespace and cluster-wide statistics
- Thresholds: ≥80% = Meets, 50-79% = Partially meets, <50% = Does not meet
- Cross-reference with checklist matrix overlap mapping

### Fallback

If `kubectl` unavailable, use `az aks command invoke`. If also unavailable, mark `CTR-*` checks `Not assessed` except platform-level checks (`CTR-IMG-06`, `CTR-ACR-*`) assessable via `az` CLI.
