# Arc Server Day-2 Management

Routes day-2 operations for already-onboarded Arc servers: agent
lifecycle, licensing (ESU / PayGo), Hotpatch, recommended policies,
management services.

## When to use

| Signal | Yes |
|---|---|
| "How do I upgrade the Arc agent?" | Yes |
| "Enable auto-upgrade for Arc agents" | Yes |
| "Buy / activate ESU for Windows Server 2012" | Yes |
| "Turn on Hotpatch for Windows Server 2025" | Yes |
| "Use Pay-as-you-go for Windows Server on Arc" | Yes |
| "Apply Software Assurance benefits on Arc" | Yes |
| "Install Update Manager / Defender / Insights on my Arc fleet" | Yes |
| "Assign the recommended Arc policies" | Yes |

If the user is **onboarding**: route to
[arc-server-onboard](../arc-server-onboard/arc-server-onboard.md).

If the agent is **broken**: route to
[arc-server-troubleshoot](../arc-server-troubleshoot/arc-server-troubleshoot.md).

## Routing

```text
Day-2 management intent?
├── Agent upgrade / auto-upgrade           → references/agent-upgrade.md
├── Extended Security Updates (ESU)        → references/extended-security-updates.md
├── Hotpatch (Windows Server 2025)         → references/hotpatch.md
├── Pay-as-you-go Windows Server licensing → references/pay-as-you-go.md
├── Install management services            → "Management services" below
├── Assign recommended policies            → "Recommended policies" below
└── Connect via SSH / RDP (Hybrid Conn)    → "Connect to an Arc server" below
```

## Management services

Source enum: `ManagementServiceKey` in
`Client/React/Views/ArcServers/Enums.d.ts`:

```ts
export const enum ManagementServiceKey {
    changeTrackingAndInventory = "changeTrackingAndInventory",
    azurePolicyAndMachineConfiguration = "azurePolicyAndMachineConfiguration",
    azureMonitorInsights = "azureMonitorInsights",
    updateManagement = "updateManagement",
    microsoftDefenderForCloud = "microsoftDefenderForCloud",
    hotpatch = "hotpatch",
}
```

| Service | Extension to install | What it gives you |
|---|---|---|
| **Update Management** | `AzureMonitorWindowsAgent` / `AzureMonitorLinuxAgent` + Azure Update Manager (no extension; capability ships with the agent on recent versions) | OS patching schedules, periodic assessment, pre-/post-scripts. |
| **Insights** | `AzureMonitorWindowsAgent` + Data Collection Rule | VM performance metrics + map view in Azure Monitor. |
| **Change Tracking & Inventory** | `ChangeTracking-Windows` / `ChangeTracking-Linux` | File / service / registry change history. |
| **Machine Configuration** | `ConfigurationforWindows` / `ConfigurationforLinux` (auto-installed by Policy) | Apply DSC-style configurations and audit compliance. |
| **Microsoft Defender for Cloud** | `MDE.Windows` / `MDE.Linux` (via Defender plan enablement) | EDR, vulnerability mgmt, threat detection. |
| **Hotpatch** | License profile flag + AUM schedule | See [references/hotpatch.md](references/hotpatch.md). |

Two ways to install at scale:

1. **Bake into the onboarding script** - the portal does this when the
   user picks "Management services to install" in the wizard.
2. **Azure Policy initiative** - apply "Configure to install ..."
   policies. Self-heal on new machines.

For an existing fleet, use Policy. Source: the recommended-policies blade
(`AssignRecommendedPolicies.ReactView.tsx`) wires up:

- `(72650e9f-...)` Configure Insights via DCR (Windows)
- `(5fe81c49-...)` Configure VM Insights for Windows
- `(4221adbc-...)` Deploy MDE for Arc Windows
- `(5752e6d6-...)` Configure DCR association
- `(1417908b-...)` Deploy MDE for Linux
- `(fc9b3da7-...)` / `(fad40cac-...)` / `(a8f3e6a6-...)` Linux equivalents
- `(630c64f9-...)` MDE for Linux

These IDs and the per-feature variants are gated by the
`machineconfigurationatscale` feature flag.

## Recommended policies

The portal exposes one click: **Assign Recommended Policies** on the Arc
server Overview. It applies a curated set of policies that:

- Install the AMA / DCR for Insights
- Install MDE for Defender for Cloud
- Enable periodic update assessment

CLI equivalent (rough):

```bash
az policy assignment create \
    --name "arc-recommended-windows" \
    --policy-set-definition "/providers/Microsoft.Authorization/policySetDefinitions/<initiative-id>" \
    --scope "/subscriptions/<sub>/resourceGroups/<rg>" \
    --mi-system-assigned \
    --location <region>
```

Then run a remediation task to apply to existing machines:

```bash
az policy remediation create \
    --name "arc-recommended-remediation" \
    --policy-assignment "arc-recommended-windows" \
    --resource-group <rg>
```

## Connect to an Arc server (SSH / RDP via Hybrid Connectivity)

Arc supports tunneled SSH and RDP through the Hybrid Connectivity
endpoint. No public IP required on the machine.

```bash
# Enable Hybrid Connectivity endpoint on the machine (one-time per machine)
az connectedmachine endpoint create \
    --resource-group <rg> \
    --machine-name <name> \
    --endpoint-name default

# SSH
az ssh arc \
    --resource-group <rg> \
    --name <machine-name> \
    --local-user <linux-user>

# RDP (Windows): generates a local listener
az connectedmachine run-command create ...   # for run-command
```

For users without the Az CLI extension, this is also surfaced on the
portal's **Connect** blade for an Arc server.

## Choosing a management licensing model

For Windows Server on Arc, three license models exist - they are
mutually exclusive on a given machine:

| Model | When to use | Reference |
|---|---|---|
| **Pay-as-you-go (PayGo)** | Customer doesn't have Windows Server licenses; wants to pay monthly through Azure billing. | [references/pay-as-you-go.md](references/pay-as-you-go.md) |
| **Software Assurance benefits** | Customer has SA on their existing Windows Server licenses; wants free Arc benefits (ESU, Hotpatch in some configurations). | Set on the machine via `licenseProfiles/default`. |
| **Extended Security Updates** | Customer is running Windows Server 2012 / 2012 R2 past EOL and needs continued security patches. | [references/extended-security-updates.md](references/extended-security-updates.md) |

These are configured on the `Microsoft.HybridCompute/machines/licenseProfiles/default`
subresource. The portal exposes them via the Overview blade and the
respective `Shared/PayGo`, `Shared/Licensing`, `Shared/Hotpatch`,
`Shared/ESU` components.

## Routing back / handoff

| Situation | Route to |
|---|---|
| Need to onboard more machines | [arc-server-onboard](../arc-server-onboard/arc-server-onboard.md) |
| Agent fell offline | [arc-server-troubleshoot](../arc-server-troubleshoot/arc-server-troubleshoot.md) |
| Wants to enroll subscription for Essential Machine Management | `azure-compute` skill > `essential-machine-management` workflow |
| Specific extension misbehaving | That extension's own troubleshooting (e.g. Defender, AMA) |
