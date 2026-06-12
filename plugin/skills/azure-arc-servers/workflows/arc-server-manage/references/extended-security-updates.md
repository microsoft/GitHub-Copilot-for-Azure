# Extended Security Updates (ESU) for Arc

Customers running Windows Server 2012 / 2012 R2 past end-of-life need
**Extended Security Updates** to keep getting security patches. ESU is
sold through Azure as a **license resource**, applied to Arc machines,
and consumed on the actual on-prem (or other-cloud) Windows Server.

This is the primary monetization path Microsoft offers for keeping
EOL Windows Server compliant. It's also the most common reason a
customer onboards a server to Arc in the first place.

> Feature flags: `enableextendedsecurityupdates`, `esushowcost`,
> `esustaticcostcontrol`, `esuyearoneinvoiceid` (see
> `featureFlags.md`).

## Mental model

```text
ESU License (ARM resource)
    ↓ assigned to
Arc machine (Microsoft.HybridCompute/machines)
    ↓ activates
Windows Update channel for ESU patches on the underlying OS
```

Two-step purchase + apply:

1. **Create the ESU license resource** at the subscription or RG level.
   This is the billable artifact. Type:
   `Microsoft.HybridCompute/licenses`.
2. **Link the license** to the Arc machines that should consume it. This
   is on the machine's
   `licenseProfiles/default.properties.esuProfile.assignedLicense`.

A single license covers a fixed number of cores. The portal shows the
estimated cost ahead of purchase when `esushowcost` is on.

## Eligibility

| Condition | Required |
|---|---|
| Machine is `Microsoft.HybridCompute/machines` (Arc) | Yes |
| Machine is `Connected` | Yes |
| OS is Windows Server 2012 or 2012 R2 | Yes (ESU is sold per-OS-line) |
| Subscription supports ESU | Confirmed per environment in `featureFlags.md` (`enableextendedsecurityupdates`) |
| Customer has paid for the right number of cores | Yes - over-subscribed licenses are flagged in the Overview status bar |

The portal's `meetsEsuPrerequisites` helper (in `Shared/ESU/`) gates
the ESU UI. If the user is on an unsupported OS (e.g. 2016), tell them
ESU isn't applicable - they're on a supported OS already.

## Buying flow

The portal walks: subscription -> RG -> license name -> edition
(Standard / Datacenter) -> core count -> year (Year 1 / Year 2 / Year 3)
-> invoice ID (Year 1 only, when `esuyearoneinvoiceid` is on).

CLI equivalent (rough):

```bash
az resource create \
    --resource-type "Microsoft.HybridCompute/licenses" \
    --resource-group <rg> \
    --name "esu-2012r2-prod" \
    --location <region> \
    --api-version 2025-02-19-preview \
    --properties '{
      "licenseType": "ESU",
      "licenseDetails": {
        "state": "Activated",
        "target": "Windows Server 2012 R2",
        "edition": "Datacenter",
        "type": "pCore",
        "processors": 16
      }
    }'
```

## Activation flow

After purchase, link the license to the machines:

```bash
az resource create \
    --resource-type "Microsoft.HybridCompute/machines/licenseProfiles" \
    --resource-group <rg> \
    --name "default" \
    --parent "machines/<machine-name>" \
    --api-version 2025-02-19-preview \
    --properties '{
      "esuProfile": {
        "assignedLicense": "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.HybridCompute/licenses/esu-2012r2-prod"
      }
    }'
```

After ARM accepts the assignment, the machine pulls ESU patches on its
next Windows Update cycle.

## Deactivation / state

License `state` can be `Activated`, `Deactivated`. Switching to
`Deactivated` stops billing but **also stops ESU patches**. The portal
surfaces a banner when a machine is associated with a deactivated
license (`esuLicenseDeactivated` flag in
`ArcServerOverviewStatusBar.tsx`).

## Cost handling

| Flag | Meaning |
|---|---|
| `esushowcost` | Show estimated cost in the buying wizard (Public clouds). |
| `esustaticcostcontrol` | Use a static per-environment cost (Fairfax / US Sec / US Nat) instead of the live cost API. |

Always show the user the cost before they purchase. ESU is one of the
more expensive line items in Azure billing per core.

## Common ESU issues

| Symptom | Cause | Fix |
|---|---|---|
| License purchased but machine still says "not eligible" | License not yet linked to the machine | Link via `licenseProfiles/default`. |
| Machine eligible but no patches arriving | `Connected` agent but Windows Update not pulling | On the machine: `wuauclt /detectnow`; check `%ProgramData%\AzureConnectedMachineAgent\Log\himds.log` for ESU activation token failures. |
| Over-subscribed (more cores assigned than purchased) | Customer added machines without expanding license | Expand the license `processors` or remove machines. The portal flashes a warning in the status bar. |
| License resource shows `Provisioning Failed` | Most often a region / RP issue | Re-create in a region known to support `Microsoft.HybridCompute/licenses` for the user's subscription. |

## Routing back

| Situation | Route to |
|---|---|
| Customer wants ESU on a Windows VM in Azure (not Arc) | Different mechanism entirely - Azure VMs get ESU via Azure Update Manager configuration, no `licenses` resource. Route to `azure-compute`. |
| Customer wants Pay-as-you-go instead | [pay-as-you-go.md](pay-as-you-go.md) |
| Customer wants ESU on 2008 R2 | EOL'd for ESU in mid-2023; tell them ESU 2008 R2 sales are closed. |
| Eligibility check needed across a fleet | KQL: filter `osName` for `Windows Server 2012*` and `properties.licenseProfile.esuProfile.assignedLicense` is null. |
