# Arc Server Onboarding Prerequisites

Check these before generating an onboarding script. A failing prereq is
the most common cause of a "the script ran but the machine never showed
up" support call.

## On the Azure side

### Required resource providers (per subscription)

| Provider | Why |
|---|---|
| `Microsoft.HybridCompute` | The Arc machine resource itself. |
| `Microsoft.GuestConfiguration` | Required for Machine Configuration / policy assignment. |
| `Microsoft.HybridConnectivity` | Required for SSH / RDP via Arc and for Arc Gateway. |
| `Microsoft.AzureArcData` (optional) | Required only if the user will also use Arc-enabled SQL Server. |

Check with `az provider show -n Microsoft.HybridCompute --query registrationState`.
Register with `az provider register -n Microsoft.HybridCompute`.
Registration is async and can take a few minutes.

### Required RBAC role on the target resource group

| Role | When |
|---|---|
| **Azure Connected Machine Onboarding** (`b64e21ea-ac4e-4cdf-9dc9-5b892992bee7`) | Minimum role to run `azcmagent connect`. Sufficient if the user only needs to onboard. |
| **Azure Connected Machine Resource Administrator** (`cd570a14-e51a-42ad-bac8-bafd67325302`) | Required to manage the machine resource after onboarding (install / remove extensions, change tags, delete). |
| **Contributor** | A superset; works but is over-privileged. |

For at-scale onboarding via Service Principal, the SP needs **Azure
Connected Machine Onboarding** on the target RG.

### Region availability

Arc is available in every public Azure region. Sovereign and Edge clouds
vary - confirm the user's target region supports `Microsoft.HybridCompute`.

## On the machine side

### Supported OS

| OS family | Supported versions (high-water mark - check docs for exact list) |
|---|---|
| Windows Server | 2008 R2 SP1, 2012, 2012 R2, 2016, 2019, 2022, 2025 (2012 / 2012 R2 require ESU) |
| Windows client (x64) | Windows 10 / 11 (limited to specific edition lines) |
| RHEL / CentOS / Oracle / Rocky / AlmaLinux | 7+, 8+, 9+ |
| Ubuntu | 18.04 / 20.04 / 22.04 / 24.04 LTS |
| SLES | 12 SP5+, 15 |
| Debian | 10, 11, 12 |
| Amazon Linux | 2, 2023 |

ARM64 Linux is supported on a subset; ARM Windows is not.

> Always link the user to the
> [official supported-OS list](https://learn.microsoft.com/azure/azure-arc/servers/prerequisites#supported-operating-systems)
> for the authoritative version matrix.

### Hardware / runtime

- 2 GB RAM minimum, 4 GB recommended.
- Local administrator / root to install the agent.
- ~500 MB free disk under `%ProgramData%\AzureConnectedMachineAgent` or `/var/opt/azcmagent`.
- TLS 1.2 enabled (most modern OSes; explicit on older Windows Server).

### Conflicts to check before installing

- If the machine **is already an Azure VM** (`Microsoft.Compute/virtualMachines`),
  do **not** install `azcmagent` on it. An Azure VM is already projected into
  Azure through the Azure VM Guest Agent (the Linux Azure Agent `waagent`, or
  the Windows Guest Agent) and the Compute resource provider; running the
  Connected Machine agent on top is not a supported configuration and
  conflicts with the Guest Agent. Arc-enabled servers is only for machines
  that live **outside** Azure. (If the user actually wants to *create* a VM
  in Azure, that is the `azure-compute` skill.)
- The **Log Analytics agent (MMA)** / **Azure Monitor Agent (AMA)** can
  coexist, but a machine that already has direct LA workspace association
  should be migrated to Arc-managed associations to avoid double-ingest.
- Some EDR / AV products quarantine `azcmagent.exe` - check the user's
  endpoint protection allowlist if onboarding silently fails.

### Network egress (minimum endpoint set)

The agent must be able to reach:

| Endpoint | Purpose |
|---|---|
| `*.<region>.arc.azure.com` (HTTPS 443) | Per-region Hybrid Connectivity endpoint |
| `management.azure.com` (HTTPS 443) | ARM control plane |
| `login.microsoftonline.com` (HTTPS 443) | Entra ID auth |
| `<region>.his.arc.azure.com` (HTTPS 443) | Hybrid Identity Service |
| `pas.windows.net` (HTTPS 443) | Privileged Access Service (extension manifest) |
| `dc.services.visualstudio.com` (HTTPS 443) | Telemetry |
| `gbl.his.arc.azure.com` (HTTPS 443) | Global HIS for first-call discovery |
| Sovereign / Edge cloud equivalents | Sovereign clouds use parallel endpoints (`*.azure.us`, `*.azure.cn`). Edge clouds may override via the `enablealthisendpoint` / `enablespecifiedarmendpoint` feature flags. |

If the machine has no outbound internet, the user needs **Arc Private
Link Scope** and/or **Arc Gateway** - see
[connectivity-options.md](connectivity-options.md).

Run `azcmagent check` on the machine to validate connectivity to all of
the above in one shot.

### Optional but recommended

- **Time synchronization.** Skew > 5 minutes breaks Entra token auth.
- **Hostname stability.** The agent uses the OS hostname as the resource
  name. Renaming the host after onboarding causes a duplicate Arc
  resource (the old one will show Disconnected).
- **Static or DHCP-reserved IP** for machines that will use Arc-enabled
  SSH / RDP via Hybrid Connectivity.

## Checklist before generating the script

Pin this in your head:

- [ ] Subscription chosen, providers registered.
- [ ] User has onboarding role on target RG.
- [ ] OS confirmed supported.
- [ ] Network egress path planned (public / proxy / Private Link / Gateway / air-gapped).
- [ ] Auth method chosen (interactive token vs Service Principal).
- [ ] Tags decided (or "none").
- [ ] Management services chosen (or "none").

Only then proceed to script generation.
