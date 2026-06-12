# Hotpatch on Arc-enabled Windows Server

Hotpatch lets Windows Server install security updates **without
rebooting**, dramatically reducing patch-window pain for production
fleets. On Arc, it's available for Windows Server 2025 Datacenter:
Azure Edition (and for some 2022 SKUs on Azure Local).

> Feature flags: `arcserverhotpatching`, `arcserverenablehotpatch`,
> `hotpatchatscale`, `hciHotpatching`, `vmwareHotpatching`,
> `scvmmHotpatching` (per-domain). See `featureFlags.md`.

## Mental model

Hotpatch is **not** a separate product. It's a property of the OS that
gets toggled on, plus an opt-in for the **Hotpatch update channel** in
Azure Update Manager. The machine needs to be:

1. Arc-Connected.
2. Running a supported Hotpatch-eligible Windows Server SKU.
3. Have an ESU or Software Assurance / PayGo license attached (Hotpatch
   is a paid capability).
4. Configured to use Hotpatch via the license profile / management
   plane.

Source enum: `HotpatchEnablementStatus` in
`Client/React/Views/ArcServers/Enums.d.ts`:

```ts
export const enum HotpatchEnablementStatus {
    Unknown = "Unknown",
    PendingEvaluation = "PendingEvaluation",
    Enabled = "Enabled",
    Disabled = "Disabled",
    ActionRequired = "ActionRequired",
}
```

## Eligibility

The portal's `meetsHotpatchPrerequisites` helper (in `Shared/Hotpatch/`)
gates the UI. Reproduce its checks before recommending Hotpatch:

| Check | Required |
|---|---|
| Agent status `Connected` | Yes |
| OS is Windows Server 2025 Datacenter: Azure Edition (or supported Azure Local / VMware / SCVMM variant) | Yes |
| Agent version >= the Hotpatch threshold (current; see source) | Yes |
| Machine has a paid license model (PayGo, SA benefits, ESU) | Yes |
| Subscription / region supports Hotpatch enrollment | Yes - check `getHotpatchSubscriptionStatus` |

If any check fails, the portal returns `ActionRequired` and the status
bar guides the user to remediate. Mirror that in your explanation.

## Enable flow

1. **Enable on the machine** - sets a flag on
   `licenseProfiles/default.properties.softwareAssurance.softwareAssuranceCustomer = true`
   (or the equivalent Hotpatch flag depending on license type).
2. **Switch the update channel** - the machine's Azure Update Manager
   schedule needs to use the Hotpatch maintenance configuration.
3. **Apply patches** - next AUM run installs Hotpatches; only Latest
   Cumulative Update (LCU) months trigger reboot.

### CLI sketch

```bash
# Step 1: flip license profile flag (PATCH)
az resource patch \
    --resource-type "Microsoft.HybridCompute/machines/licenseProfiles" \
    --resource-group <rg> \
    --name "default" \
    --parent "machines/<machine-name>" \
    --api-version 2025-02-19-preview \
    --properties '{ "softwareAssurance": { "softwareAssuranceCustomer": true } }'

# Step 2: associate the machine with a Hotpatch-enabled AUM maintenance config
az maintenance assignment create \
    --resource-id "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.HybridCompute/machines/<name>" \
    --maintenance-configuration-id "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Maintenance/maintenanceConfigurations/hotpatch-monthly"
```

The exact REST shapes drift; trust the portal's network trace if you
need to verify.

## Status interpretation

| `HotpatchEnablementStatus` | Tell the user |
|---|---|
| `Unknown` | Status hasn't been evaluated yet. Wait a few minutes after enabling. |
| `PendingEvaluation` | Machine is being checked. Refresh in ~5 minutes. |
| `Enabled` | Patches install without reboot. Look for "Hotpatch Edition" in `winver`. |
| `Disabled` | Hotpatch is off. Show the eligibility checklist. |
| `ActionRequired` | Eligible but blocked. Common: license not attached, agent too old, AUM schedule not on Hotpatch channel. |

## At-scale Hotpatch enablement

The `hotpatchatscale` feature flag enables a fleet-level enablement
blade (Manage services at-scale). For at-scale enablement without the
portal:

1. Filter the fleet to Hotpatch-eligible machines via Resource Graph:
   ```kql
   resources
   | where type =~ "microsoft.hybridcompute/machines"
   | extend osName = tostring(properties.osName)
   | where osName has "Windows Server 2025"
   | project id, name, resourceGroup, subscriptionId
   ```
2. Apply the license profile PATCH and AUM assignment via the same
   automation tool used for onboarding (Ansible / scripted CLI).

## Hotpatch on Azure Local / VMware / SCVMM

Each Arc-stamped VM domain has its own Hotpatch flag (`hciHotpatching`,
`vmwareHotpatching`, `scvmmHotpatching`). The flow is conceptually
identical (license profile + AUM channel), but those scenarios belong
in the respective skills (`azure-local`, `arc-vmware`, `arc-scvmm`)
because the surrounding eligibility checks differ.

## Common Hotpatch issues

| Symptom | Cause | Fix |
|---|---|---|
| Status stays `PendingEvaluation` for > 1 hour | Agent isn't reporting back evaluation result | `azcmagent show` for status; check Defender / EDR isn't blocking himds. |
| `Enabled` but reboot still required | Month's update is an LCU month, not a Hotpatch month | Expected - LCU months reboot. |
| Hotpatch enabled but billing went up unexpectedly | Hotpatch implies a paid license; SA / PayGo / ESU cost increased | Confirm the customer agreed to the license model. |

## Routing back

| Situation | Route to |
|---|---|
| Customer wants Hotpatch on Azure Local | (proposed) `azure-local` skill |
| Customer wants Hotpatch on VMware / SCVMM VMs | (proposed) `arc-vmware` / `arc-scvmm` |
| Customer doesn't have any of PayGo / SA / ESU | They need to attach one - see [pay-as-you-go.md](pay-as-you-go.md) or [extended-security-updates.md](extended-security-updates.md) first. |
| Hotpatch enabled but a specific patch failed | That's an AUM / Windows Update troubleshooting issue, not Arc; route to the AUM docs. |
