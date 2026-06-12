# Arc Connected Machine Agent - Upgrade

The `azcmagent` ships ~monthly. Newer agents enable newer extensions
(Insights, Hotpatch, etc.). Two upgrade modes: **automatic** (recommended)
and **manual**.

## Automatic upgrade (default on 1.41+)

When the user onboards on agent 1.41 or newer, auto-upgrade is **on by
default**. The agent self-updates from the published feed on a rolling
basis (Microsoft staggers the rollout to limit blast radius).

The portal exposes a per-machine toggle on the
**Properties** blade (file: `ArcServerProperties.ReactView.tsx`) and a
fleet-level toggle on the **Manage agent auto-upgrade** blade
(`AgentAutoUpgrade/`). Feature flag: `agentautoupgrade`.

Toggle states live on `properties.agentConfiguration.extensionsAllowList`
and `properties.agentUpgrade.enableAutomaticUpgrade`. The exact API
shape is in `Client/React/Views/ArcServers/Hooks.ts`.

### Source enum

`AutoUpgradeAction` in `Client/React/Views/ArcServers/Enums.d.ts`:

```ts
export const enum AutoUpgradeAction {
    Enable = "Enable",
    Disable = "Disable",
}
```

### CLI

```bash
# Enable automatic agent upgrade (PATCH sets the desired state)
az resource patch \
    --resource-type "Microsoft.HybridCompute/machines" \
    --resource-group <rg> \
    --name <machine-name> \
    --api-version 2025-02-19-preview \
    --properties '{"agentUpgrade":{"enableAutomaticUpgrade":true}}'

# Read the current auto-upgrade setting
az resource show \
    --resource-type "Microsoft.HybridCompute/machines" \
    --resource-group <rg> \
    --name <machine-name> \
    --api-version 2025-02-19-preview \
    --query "properties.agentUpgrade.enableAutomaticUpgrade"
```

For a fleet, prefer Azure Policy: there is a built-in initiative
"Configure Arc Agent for auto-upgrade" that scopes to a subscription or
management group.

## Manual upgrade

For machines that are **not** on auto-upgrade, or for an emergency
out-of-band patch:

### From the machine

```bash
# Windows / Linux
azcmagent upgrade
```

`azcmagent upgrade` downloads and installs the latest agent. Requires
outbound 443 to the agent download endpoint.

### From the portal

The Overview status bar surfaces an "Outdated agent" prompt when the
machine's `agentVersion` is older than the significant version line
defined in `ConnectedWindowsMachineAgentSignificantVersion` /
`ConnectedLinuxMachineAgentSignificantVersion`
(`Client/React/Views/ArcServers/Enums.d.ts`).

The current significant versions in source (drift over time, verify
with the running portal):

```ts
export const enum ConnectedWindowsMachineAgentSignificantVersion {
    ExtensionsSupportAdded = "0.7.0.0",
    FqdnSupportAdded = "0.8.0.0",
    InsightsSupportAdded = "0.9.0.0",
    VmUuIdSupportAdded = "0.7.20079.002",
}
```

These mark thresholds where capabilities switch on. Below
`InsightsSupportAdded`, the portal does not offer Insights enablement.

### From a deployment tool (at scale)

Wrap `azcmagent upgrade` in the same tool you used for onboarding
(Ansible, ConfigMgr, GPO computer-startup script). Run during a known
maintenance window - the agent restarts during upgrade.

```yaml
# Ansible snippet
- name: Upgrade Arc agent
  shell: azcmagent upgrade
  register: upgrade_result
  failed_when: upgrade_result.rc != 0 and ('already up to date' not in upgrade_result.stdout)
```

The `failed_when` clause treats "already up to date" as success so a
nightly run is idempotent.

## When upgrade fails

| Symptom | Cause | Fix |
|---|---|---|
| `azcmagent upgrade: 403` | Outbound 443 blocked or proxy needs new allowlist | Add the download endpoint to the proxy allowlist. |
| `azcmagent upgrade: signature verification failed` | Time skew | Fix NTP, retry. |
| Agent upgrades, then service won't start | Disk full or AV quarantine | Free disk, restore quarantined files, reinstall. |
| Agent upgrades but extensions break | Extension version incompatible with new agent | Update extension to `--auto-upgrade-minor-version true` model so it auto-bumps. |

For systemic upgrade failures across a fleet, look at the upstream
deployment tool's logs, not Arc - Arc's job is just to expose the new
agent feed.

## Special case: very old agents (< 1.0)

Agents older than ~1.0 don't have `azcmagent upgrade` at all. For these
the only option is:

1. Uninstall the agent (`AzureConnectedMachineAgent.msi /uninstall`
   or `dpkg -r azcmagent` / `rpm -e azcmagent`).
2. Reinstall the latest from the agent download URL.
3. Run `azcmagent connect` with the same RG / sub / region - the
   existing Arc resource will be reattached (no duplicate).

For very large legacy fleets, this is best driven by a one-time
deployment-tool campaign.

## Telemetry

When the portal observes an outdated agent, it traces the event with
action `ShowOutdatedAgentStatusBar` (see
`ArcServerOverviewStatusBar.tsx`). That tells you which customers have
been notified - useful when triaging "I never knew my agent was
outdated".
