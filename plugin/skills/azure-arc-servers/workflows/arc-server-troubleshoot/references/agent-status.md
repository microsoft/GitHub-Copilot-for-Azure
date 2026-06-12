# Arc Agent Status Reference

Each of the four agent statuses, what it means, and the most likely
remediation. Source: `AgentStatus` enum used across the
HybridComputeExtension (`Utilities/Enums.ts`,
`Client/React/Views/ArcServers/Blades/Overview/ArcServerOverviewStatusBar.tsx`).

## `Connected`

Agent has reported in within the last 5 minutes. The Overview blade
renders a green pill.

Nothing to fix at the agent layer. If the user has a complaint, look at:
- Extensions (`Microsoft.HybridCompute/machines/extensions`)
- Recommended policies (`Assign Recommended Policies` blade)
- Updates (Azure Update Manager)
- Defender (Microsoft Defender for Cloud)

## `Disconnected`

Agent has not reported in for ~5-15 minutes. Could be transient
(machine rebooting, blip in connectivity) or persistent (broken).

### Causes, in order of likelihood

| Cause | Signal | Fix |
|---|---|---|
| Machine is off / rebooting | `lastStatusChange` < 30 min ago, no other symptom | Wait 5 minutes. If still down, check the machine. |
| `himds` / agent service stopped | Verifiable on machine: Windows `Get-Service himds`, Linux `systemctl status himds` | Restart the service. Investigate why it stopped (check Event Viewer / journalctl). |
| Outbound proxy / firewall changed | `azcmagent check` shows failed endpoints | Re-allow the endpoints in [connectivity-options.md](../../arc-server-onboard/references/connectivity-options.md#network-egress-minimum-endpoint-set). |
| Proxy credentials expired | `azcmagent show` reports `407 Proxy Authentication Required` | Reconfigure proxy with `azcmagent config set proxy.url ...`. |
| Machine clock skew > 5 min | Token validation fails; `azcmagent logs` shows `nbf` / `exp` errors | Fix NTP / `w32time`. |
| DNS failure | `azcmagent check` shows resolution failures | Restore DNS - especially common with Private Link split-horizon DNS. |
| Disk full | `himds.exe` cannot write logs and crashes | Free disk space. |
| OS upgrade broke the agent service | Service won't start at all | Reinstall the agent. Don't re-onboard - that creates a duplicate. Use the in-place agent installer. |

### Fast diagnostic command

```bash
# Windows
azcmagent show; azcmagent check

# Linux
sudo azcmagent show; sudo azcmagent check
```

`azcmagent check` covers DNS, TLS, endpoint reachability, and proxy
validation in one shot. Read its output before anything else.

## `Expired`

Agent's Entra token has expired and it can't get a new one. The machine
is essentially unauthenticated even if the network is fine.

### Causes, in order of likelihood

| Cause | Signal | Fix |
|---|---|---|
| **Service Principal client secret expired** | The SP used for onboarding has a `passwordCredentials[].endDateTime` in the past. `azcmagent logs` shows `AADSTS7000222`. | Rotate the SP secret. Update it on every affected machine (env var / GPO / Ansible Vault / CM secret). Then `azcmagent connect` (no `--force` needed; supply the new secret). |
| **Tenant deleted the SP** | Resource Graph query `azureresources/identities` shows the SP gone. | Recreate the SP, scope it to the RG, re-connect. |
| **Machine moved tenants** (rare) | `azcmagent show` reports a different `Tenant ID` than expected | Disconnect (`azcmagent disconnect`) and re-onboard to the correct tenant. |
| Machine was offline for > 60 days | The agent's own refresh token aged out completely | Disconnect + re-onboard. |

### Fleet-wide secret rotation

If a single SP onboarded hundreds of machines, you have one secret to
rotate. Push the new secret via the same channel you onboarded
(GPO / CM / Ansible Vault), then run `azcmagent connect` on each
machine non-destructively to re-auth.

```bash
# Non-destructive re-auth with new SP secret
azcmagent connect \
    --resource-group "$RG" \
    --tenant-id "$TENANT" \
    --location "$REGION" \
    --subscription-id "$SUB" \
    --service-principal-id "$SP_APP_ID" \
    --service-principal-secret "$NEW_SECRET"
```

If the machine resource already exists, the agent will simply re-auth
against it; you won't create a duplicate.

## `Error`

Agent reported in, but its own self-report says something is wrong.
`properties.errorDetails` will have a structured error code + message.

### Common error codes

| Code | Meaning | Fix |
|---|---|---|
| `AZCM0007` | Failed to renew certificate | Restart `himds`. If recurring, re-onboard. |
| `AZCM0011` | Cannot reach HIS endpoint | Check `azcmagent check`; fix DNS / firewall to `*.his.arc.azure.com`. |
| `AZCM0028` | Identity certificate expired | Re-auth via `azcmagent connect`. |
| `AZCM0039` | Time skew | Fix NTP. |
| Resource provider not registered | `errorDetails.code` references `Microsoft.HybridCompute` registration | Register the RP in the subscription (`az provider register -n Microsoft.HybridCompute`). |

The full code list moves over time; consult the
[official azcmagent troubleshooting docs](https://learn.microsoft.com/azure/azure-arc/servers/troubleshoot-agent-onboard)
for the current set.

### When to disconnect + re-onboard vs repair in place

| Situation | Action |
|---|---|
| Agent service won't start at all | Reinstall agent in place (don't re-onboard - keeps the resource record stable). |
| Agent is connected but to the wrong RG / sub | `azcmagent disconnect`, delete stale resource, re-onboard to correct target. |
| Agent's identity is fundamentally broken (rotated tenant, corrupt cert store) | `azcmagent disconnect --force-local-only`, delete stale resource in ARM, re-onboard. |
| Just a transient network blip | Don't do anything destructive. Let it self-heal. |

`azcmagent disconnect` removes the Azure resource. Use
`--force-local-only` only when you have to clean the agent state but
**not** the Azure resource (e.g. the resource is already gone or you'll
delete it manually).

## `lastStatusChange` heuristics

The `properties.lastStatusChange` timestamp tells you how long the
machine has been in its current state.

| Time since `lastStatusChange` | Read |
|---|---|
| < 5 min | Probably transient. Don't act yet. |
| 5-30 min | Worth investigating. |
| 30 min - 24 hr | Definitely broken. |
| > 24 hr | Either the machine is truly offline, or the customer doesn't realize the machine was decommissioned. Consider deleting the resource. |
