# Arc Server Troubleshooting

The Arc machine is registered but not in a healthy `Connected` state, or
extensions are misbehaving, or the onboarding script ran but no resource
appeared. Diagnose, then fix.

## When to use

| Signal in user's message | Yes |
|---|---|
| "Agent is disconnected / expired / error" | Yes |
| "Machine shows offline in Arc" | Yes |
| "azcmagent connect failed" | Yes |
| "Extension stuck in `Creating` / `Failed`" | Yes |
| "I ran the script but nothing shows up in the portal" | Yes |
| "Onboarding worked yesterday but agent stopped reporting" | Yes |

If the user is **about** to onboard and hasn't run a script yet, route
to [arc-server-onboard](../arc-server-onboard/arc-server-onboard.md).

## Workflow

### Step 1 - Get the agent status

The status comes from `properties.status` on the
`Microsoft.HybridCompute/machines` resource. The portal uses these values
(source: `AgentStatus` enum in `Utilities/Enums`):

| Status | Meaning | First action |
|---|---|---|
| `Connected` | Agent reported in within the last 5 minutes. | Healthy. If user has a complaint, look at extensions, not agent. |
| `Disconnected` | Agent has not reported in 5-15+ minutes. | Check `lastStatusChange`. Network or service issue. See [agent-status.md](references/agent-status.md). |
| `Expired` | Agent has not reported in for hours / days. The Entra token has aged out. | Re-auth required. Most often Service Principal secret expired. |
| `Error` | Agent reported, but its self-report says something is wrong. | Read `errorDetails`. |

Fastest way to see it:

```bash
mcp__azure__resource_show \
  --resource-id "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.HybridCompute/machines/<name>"
```

Or for a fleet:

```kql
resources
| where type =~ "microsoft.hybridcompute/machines"
| extend status = tostring(properties.status)
| where status != "Connected"
| project name, resourceGroup, status,
          lastStatusChange = properties.lastStatusChange,
          errorDetails = properties.errorDetails
```

### Step 2 - Route by status

| Status | Where to go next |
|---|---|
| `Disconnected`, `Expired`, `Error` | [references/agent-status.md](references/agent-status.md) walks each case. |
| `Connected` but extension is broken | Skip to "Extension troubleshooting" below. |
| Resource does not exist at all | Skip to "The script ran but nothing appeared" below. |

### Step 3 - Get on the machine

For almost every non-`Connected` case, the fastest fix path is **on the
machine**. The agent self-diagnoses better than ARM can:

```text
# Windows
& "$env:ProgramFiles\AzureConnectedMachineAgent\azcmagent.exe" show
& "$env:ProgramFiles\AzureConnectedMachineAgent\azcmagent.exe" check
& "$env:ProgramFiles\AzureConnectedMachineAgent\azcmagent.exe" logs

# Linux
sudo azcmagent show
sudo azcmagent check
sudo azcmagent logs
```

`azcmagent show` reports the current state and the most recent error.
`azcmagent check` runs end-to-end connectivity probes to the required
Azure endpoints. `azcmagent logs` zips up the recent logs into a tar
file the user can attach to a support ticket.

### Step 4 - Match the symptom to a remediation

Load [references/common-issues.md](references/common-issues.md) and find
the row for the user's symptom.

### Step 5 - Verify the fix took

After remediation:

1. On the machine: `azcmagent show` reports `Status: Connected`.
2. In ARM: status flips to `Connected` within ~2 minutes
   (`mcp__azure__resource_show` to confirm).
3. The portal Overview blade shows the green status pill.

If status flips back to `Disconnected` later, the underlying issue
wasn't fixed - re-diagnose.

## Extension troubleshooting (when agent is Connected but extension is bad)

Extensions are children of the machine: type
`Microsoft.HybridCompute/machines/extensions`. They have their own
`provisioningState` (`Creating`, `Succeeded`, `Failed`, `Deleting`).

### Inspect

```bash
# Via CLI
az connectedmachine extension list \
    --machine-name <name> \
    --resource-group <rg> \
    --output table

# Via Resource Graph for a fleet
resources
| where type =~ "microsoft.hybridcompute/machines/extensions"
| where properties.provisioningState != "Succeeded"
| project id, name, provisioningState = properties.provisioningState,
          publisher = properties.publisher,
          extensionType = properties.type,
          version = properties.typeHandlerVersion
```

### Common extension-level issues

| Symptom | Most likely cause | Fix |
|---|---|---|
| Extension stuck in `Creating` for > 30 min | Agent can't reach the extension distribution endpoint | `azcmagent check`; if `pas.windows.net` fails, fix proxy / firewall |
| Extension shows `Failed` with `404` | Stale extension version pinned | Update with `--type-handler-version` to the latest, or `--auto-upgrade-minor-version true` |
| Extension uninstall hangs | Extension's `Disable` script is failing | Force-uninstall: `az connectedmachine extension delete --force` |
| Many extensions failing on the same machine | Disk full / antivirus quarantine | Free space; check EDR quarantine for `extension*.exe` |
| Same extension failing across many machines | Extension was rolled out with a bad config | Roll back via Azure Policy "Configure to install ..." set to `Audit` while you fix |

For specific extension issues (Azure Monitor Agent, Microsoft Defender,
Azure Update Manager), defer to that service's own troubleshooting.

## The script ran but nothing appeared

If `azcmagent connect` printed success but no resource is in ARM:

| Check | Action |
|---|---|
| Did the script actually call `azcmagent connect`? | `azcmagent show` - if `Status: Disconnected (Not yet connected)`, the script bailed early. Scroll the script output for the error. |
| Did the script point at the right subscription? | Re-read the script - the `--subscription-id` and `--resource-group` flags must match where the user is looking. |
| Did auth succeed? | If interactive: did the user actually complete the device-code prompt? If SP: did the secret pass? Failure surfaces as `Authentication failed` in the script output. |
| Did the user have onboarding role? | Re-check role on the target RG. The script does **not** create the RG; missing RG also produces a clean failure. |
| Is the user looking in the right tenant? | Multi-tenant Service Principals sometimes connect to the wrong tenant. Confirm with `azcmagent show`. |

## Routing back / handoff

| Situation | Route to |
|---|---|
| Fundamental network gap (no egress, no Private Link) | [../arc-server-onboard/references/connectivity-options.md](../arc-server-onboard/references/connectivity-options.md) - re-onboard with the right path. |
| Service Principal secret expired | Rotate the secret, then re-run `azcmagent connect`. |
| Agent is many versions behind and won't upgrade | [../arc-server-manage/references/agent-upgrade.md](../arc-server-manage/references/agent-upgrade.md) |
| Onboarded the wrong machine / want to start over | `azcmagent disconnect` on the machine, then `mcp__azure__resource_delete` on the resource, then re-onboard. |
| User is convinced it's an Azure-side outage | Have them check [Azure Status](https://azure.status.microsoft/) for `Azure Arc`. If status shows degraded, they should open a support case rather than re-diagnose. |
