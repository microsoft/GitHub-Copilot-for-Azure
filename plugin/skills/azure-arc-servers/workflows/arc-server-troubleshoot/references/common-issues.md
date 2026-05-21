# Common Arc Server Issues - Lookup Table

Symptom -> most likely cause -> fix. Listed in rough order of frequency.

## Onboarding failures

| Symptom (during onboarding) | Cause | Fix |
|---|---|---|
| Script exits with `Failed to connect to Azure: Forbidden` | User / SP missing onboarding role on target RG | Assign **Azure Connected Machine Onboarding** on the RG. |
| Script exits with `Resource provider 'Microsoft.HybridCompute' not registered` | RP not registered in target subscription | `az provider register -n Microsoft.HybridCompute` (also register `Microsoft.GuestConfiguration`, `Microsoft.HybridConnectivity`). Wait 1-2 min. |
| `Failed to download agent: 403 / 404` (Edge / air-gapped) | The default download URL isn't reachable from the air-gapped network | Use alt-download URL (`enablealtdownload` / `enableagcaltdownload`); host the agent installer on an internal blob endpoint. |
| `azcmagent connect: timeout connecting to login.microsoftonline.com` | No outbound 443 or proxy not set | Configure proxy via `azcmagent config set proxy.url ...`, or switch connectivity to Private Link / Arc Gateway. |
| `azcmagent connect: AADSTS90002 Tenant not found` | Wrong tenant ID passed | Re-run with the correct tenant from `az account show --query tenantId`. |
| `azcmagent connect: AADSTS7000215 Invalid client secret` | SP secret typo or expired | Rotate / re-fetch the SP secret; supply on `--service-principal-secret`. |
| Resource shows up but immediately goes `Disconnected` | First heartbeat failed - usually DNS to `*.his.arc.azure.com` | Run `azcmagent check` on machine; fix DNS or proxy. |
| Onboarding succeeds for the user but the resource appears in a wrong tenant | SP belongs to a different tenant than the user expected | Disconnect, re-onboard with correct `--tenant-id`. |
| Group Policy onboarding works on first 80%, fails on remaining 20% | GPO script timed out (default 30s on slow disks) | Increase Computer Configuration > Administrative Templates > System > Group Policy > "Specify maximum wait time for Group Policy scripts" to 5+ minutes. |
| Linux install fails with package manager error | Distro repository unreachable through firewall | Use the alt-download method - download `azcmagent_<dist>_<arch>.<ext>` directly and `dpkg -i` / `rpm -i`. |
| Windows install fails with MSI 1603 | MSI installer logging needed | Re-run with `msiexec /i ... /l*v install.log` and read the MSI log. Usually a missing pre-req (TLS 1.2, .NET) or AV quarantine. |

## Steady-state failures

| Symptom (after a healthy onboarding) | Cause | Fix |
|---|---|---|
| Machine flips `Connected` <-> `Disconnected` every few minutes | Unreliable network (Wi-Fi roaming, flaky VPN) | Wire the machine or stabilize VPN. Arc tolerates short blips but constant flapping looks unhealthy. |
| `Expired` after exactly 90 days | SP secret was created with default 90-day expiry | Rotate SP secret. Set a longer expiry or use certificate-based SP. |
| Extension stays `Creating` for hours | Manifest endpoint (`pas.windows.net`) unreachable | `azcmagent check`; fix proxy / firewall. |
| Many extensions show `Failed` after a Defender for Cloud rollout | Defender's MDE extension conflicts with existing AV (CrowdStrike, etc.) | Set MDE EDR to passive mode or exclude conflicting AV per Defender guidance. |
| Update Manager reports "No update data" indefinitely | AzureMonitorWindowsAgent / Linux extension not installed | Install the extension via `az connectedmachine extension create --publisher Microsoft.Azure.Monitor --type AzureMonitorWindowsAgent`. |
| Run Command failed | `Microsoft.HybridConnectivity` not registered, or machine doesn't have GuestConfig extension | Register the RP; assign the recommended policies to install GuestConfig. |
| SSH / RDP via Arc fails | Hybrid Connectivity endpoint not configured, or NSG blocks the loopback | `azcmagent config set extensions.allowlist <ext>`; enable Hybrid Connectivity endpoint via `az connectedmachine endpoint create`. |
| Tags reverted to "(none)" | A Policy assignment is enforcing tag values | Check policy assignments at sub / RG scope; either include the desired tags in the policy default or set tags via the policy itself. |
| Machine shows up duplicated in Arc | Hostname changed; agent registered a second resource | Delete the old resource via `mcp__azure__resource_delete`. Document a hostname-pinning policy to prevent recurrence. |

## "Phantom" machines

| Symptom | Cause | Fix |
|---|---|---|
| Resource exists in ARM but the machine doesn't anymore (decommissioned) | Someone deleted the VM without disconnecting the agent | `mcp__azure__resource_delete` on the Arc resource. |
| Duplicate resource for the same physical machine | Hostname change, OS reinstall, or onboarded twice | Confirm which is current (check `lastStatusChange`), delete the stale one. |
| Machine shows in two different RGs | Onboarded twice with different target RGs | Pick the canonical one (usually the more recent); disconnect from the wrong one with `azcmagent disconnect`. |

## Permissions / RBAC

| Symptom | Cause | Fix |
|---|---|---|
| User can see machine but can't install extensions | User has Reader, not Resource Administrator | Assign **Azure Connected Machine Resource Administrator** on the machine or its RG. |
| User can't see machine in browse | No role on the subscription / RG | Assign Reader at the appropriate scope. |
| Policy "Configure to install..." fails to install extension | The policy's managed identity doesn't have the right role on the target RG | Add **Azure Connected Machine Resource Administrator** to the policy's MI. |

## Decision tree: "I don't know what's wrong"

1. Run `azcmagent show` on the machine. Read the `Status` line.
2. If not `Connected`, run `azcmagent check`. Read every failed check.
3. If `check` is all green but status is wrong, run `azcmagent logs`
   and grep for `ERROR`.
4. If logs are inconclusive, look at `properties.errorDetails` from
   `mcp__azure__resource_show`.
5. If still inconclusive, disconnect + re-onboard. Don't keep poking
   at a broken state - a clean reconnect is fast and frequently fixes
   it.
6. If a clean reconnect also fails, you've narrowed it to a real
   network or auth problem - open a support case with `azcmagent logs`
   bundle attached.
