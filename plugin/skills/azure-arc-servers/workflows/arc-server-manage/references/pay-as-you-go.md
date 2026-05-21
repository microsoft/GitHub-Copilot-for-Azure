# Pay-as-you-go Windows Server on Arc

Lets customers pay for Windows Server licensing **through their Azure
bill**, even when the Windows Server is running on customer-owned
hardware. Eliminates the need to buy retail Windows Server licenses up
front.

> Feature flags: `arcserverpaygo` (Arc Servers), `hcipaygo` (Azure
> Local), `vmwarepaygo` (VMware), `scvmmpaygo` (SCVMM). All on in
> Public clouds (MPAC / PROD / PREV / RC) per `featureFlags.md`.

## Mental model

Pay-as-you-go (PayGo) is **alternative to Software Assurance** for
licensing Windows Server on Arc-managed machines. The customer doesn't
buy retail Windows Server licenses; they activate PayGo on the Arc
machine, and Azure bills them monthly per core.

The activation is recorded on
`Microsoft.HybridCompute/machines/licenseProfiles/default.properties.productProfile`
(Windows Server PayGo) or
`...softwareAssurance` (SA benefits flag, equivalent at the protocol
level for some capabilities).

```text
On-prem Windows Server (no retail license)
            +
Arc agent (Connected)
            +
PayGo activated on licenseProfile
            =
Azure billing handles WS licensing per month
```

## Eligibility

The portal's `arePayGoPrerequisitesMet` helper (`Shared/PayGo/`) gates
the UI. Reproduce its checks:

| Check | Required |
|---|---|
| Agent status `Connected` | Yes |
| OS is Windows Server (2019, 2022, 2025) | Yes |
| Machine is **not** an Azure VM (Azure VMs use Hybrid Benefit, not PayGo) | Yes |
| Subscription supports PayGo (region availability) | Yes |
| User has the right role to PATCH license profile | Yes (`Azure Connected Machine Resource Administrator` or higher) |

Linux is not in scope - PayGo is a Windows Server-only feature.

## Enable flow

```bash
# PATCH the license profile to set Windows Server PayGo
az resource patch \
    --resource-type "Microsoft.HybridCompute/machines/licenseProfiles" \
    --resource-group <rg> \
    --name "default" \
    --parent "machines/<machine-name>" \
    --api-version 2025-02-19-preview \
    --properties '{
      "productProfile": {
        "subscriptionStatus": "Enabled",
        "productType": "WindowsServer",
        "productFeatures": [
          { "name": "WindowsServerLicense", "subscriptionStatus": "Enabled" }
        ]
      }
    }'
```

The portal flips the same property; source patterns in
`ArcServerOverviewStatusBar.tsx` and `Shared/PayGo/`.

## Status

`SubscriptionStatus` enum (`Shared/Licensing/Enums`):

| Value | Meaning |
|---|---|
| `Unknown` | Not yet evaluated. |
| `Enabling` | Activation in progress (a few minutes). |
| `Enabled` | Billing is active. |
| `Disabling` | Deactivation in progress. |
| `Disabled` | PayGo is off. Customer is using their own license / SA / nothing. |
| `Failed` | Activation failed - read the error in `licenseProfile.properties.licenseStatus`. |

## Disable

To stop PayGo billing (customer brought their own license, or
decommissioned the machine):

```bash
az resource patch \
    --resource-type "Microsoft.HybridCompute/machines/licenseProfiles" \
    --resource-group <rg> \
    --name "default" \
    --parent "machines/<machine-name>" \
    --api-version 2025-02-19-preview \
    --properties '{ "productProfile": { "subscriptionStatus": "Disabled" } }'
```

Disabling stops Azure billing for Windows Server. The customer is
then responsible for having a separate valid license on the machine
(retail, SA, etc.) - or they're out of compliance.

## At-scale enablement

For a fleet, the portal exposes a **Manage services at-scale** flow.
Behind the scenes it iterates the PATCH above. CLI / scripted
equivalent:

```bash
# Resource Graph: find eligible Windows Server Arc machines without PayGo
resources
| where type =~ "microsoft.hybridcompute/machines"
| extend osName = tostring(properties.osName)
| where osName has "Windows Server"
| extend licenseStatus = tostring(properties.licenseProfile.productProfile.subscriptionStatus)
| where licenseStatus != "Enabled"
| project id, name, resourceGroup, osName, licenseStatus

# Iterate and PATCH each
```

## PayGo vs SA Benefits vs ESU (decision aid)

| Scenario | Use |
|---|---|
| Windows Server with SA in your EA | **SA Benefits** (free for Arc capabilities) |
| Windows Server, no SA, want OPEX licensing through Azure | **PayGo** |
| Windows Server 2012 / 2012 R2 past EOL | **ESU** (see [extended-security-updates.md](extended-security-updates.md)) |
| Windows Server with retail license, no Azure integration desired | None - leave the license profile alone |

These are mutually exclusive on a given machine for the Windows Server
licensing dimension. ESU is orthogonal to current-version licensing -
you can have ESU on a 2012 machine without PayGo.

## Common PayGo issues

| Symptom | Cause | Fix |
|---|---|---|
| Status stuck in `Enabling` for > 30 min | Agent not reporting evaluation back | `azcmagent show` on the machine; check Defender / EDR. |
| `Failed` with `LicenseValidationFailed` | OS doesn't match a billable Windows Server SKU | Confirm the OS - PayGo doesn't apply to Windows client or Linux. |
| Billing showed up but customer expected SA Benefits | Customer activated PayGo when they meant SA | Disable PayGo, enable SA via `softwareAssuranceCustomer: true`. |
| At-scale PATCH partially failed | Some machines lacked the right role for the executor | Use a managed identity with `Azure Connected Machine Resource Administrator` scope at the RG / sub. |

## Routing back

| Situation | Route to |
|---|---|
| Wants PayGo on Azure Local VMs | (proposed) `azure-local` skill (`hcipaygo` flag) |
| Wants PayGo on VMware / SCVMM Arc VMs | (proposed) `arc-vmware` / `arc-scvmm` |
| Wants Hotpatch enabled (PayGo is a prereq) | [hotpatch.md](hotpatch.md) |
| Has SA, not interested in PayGo | Use SA Benefits flag instead (`softwareAssuranceCustomer: true`). No separate workflow needed. |
| Wants Hybrid Benefit for Azure VMs | That's `azure-compute`, not Arc. |
