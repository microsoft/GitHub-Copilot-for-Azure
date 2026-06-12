# Arc-Enabled Servers vs Azure VMs

A common source of confusion. Read this if the user is talking about
"Arc servers" as if they were Azure VMs - or vice versa.

## The mental model

| | Azure VM | Arc-enabled server |
|---|---|---|
| Where does the machine live? | In Azure (a Microsoft datacenter) | Anywhere except Azure: on-prem, AWS, GCP, edge, a laptop |
| Who creates the OS? | Azure - you pick an image / size and Azure provisions it | You. The OS already exists. Arc only projects it. |
| ARM resource type | `Microsoft.Compute/virtualMachines` | `Microsoft.HybridCompute/machines` |
| Resource provider | `Microsoft.Compute` | `Microsoft.HybridCompute` |
| What you install | Nothing - the VM is the resource | `azcmagent` (Azure Connected Machine agent) |
| What gets billed for the VM itself | Compute hours + storage + networking | Nothing for the machine. You pay for the management services you opt into (Update Manager logs, Defender, ESU, etc.). |
| Lifecycle action "Stop" / "Delete" | Stops / deletes the actual VM | Stops / deletes the Azure resource. The underlying machine is unaffected. |

## Why a customer would choose Arc

- They already own the hardware (on-prem datacenter, edge device, factory floor).
- They run workloads in AWS or GCP and want one Azure-native control plane.
- They need Azure Policy, Defender for Servers, Update Manager, Machine
  Configuration, Change Tracking, or Monitor Insights on machines that
  cannot or should not move into Azure.
- They need to buy **Extended Security Updates** for Windows Server 2012 /
  2012 R2 - ESU is sold via an Arc license and applied to Arc machines.
- They want **Pay-as-you-go Windows Server licensing** on customer-owned
  hardware, billed through Azure.

## Why a customer would choose an Azure VM

- They want Azure to host the OS.
- They want VM-native features like availability sets, scale sets,
  Capacity Reservation Groups, ephemeral OS disks, GPU SKUs, etc.
- They don't have hardware of their own.

## Common confused phrasings and what they actually want

| What the user said | What they probably mean | Route to |
|---|---|---|
| "Create an Arc VM" | If they have a physical / non-Azure machine: Arc onboarding. If they mean a VM stamped onto Azure Local / VMware via Arc: a different skill (`azure-local`, `arc-vmware`). | Clarify, then this skill or `azure-local` / `arc-vmware`. |
| "Spin up an Arc server" | Same as above - clarify. | Clarify first. |
| "I want to manage my AWS EC2 instance from Azure" | Either install the Connected Machine agent on the EC2 instance (this skill) or use the AWS connector (multi-cloud sync). | This skill for single-instance; `arc-multicloud` (proposed) for bulk sync. |
| "Connect my on-prem servers to Azure" | This skill - onboard. | [arc-server-onboard](../workflows/arc-server-onboard/arc-server-onboard.md) |
| "My Arc server is offline" | Troubleshoot agent connectivity. | [arc-server-troubleshoot](../workflows/arc-server-troubleshoot/arc-server-troubleshoot.md) |
| "Patch my Arc servers" | Azure Update Manager, scoped to Arc. | [arc-server-manage](../workflows/arc-server-manage/arc-server-manage.md) |

## When the answer is "use both"

If the user wants a hybrid fleet (some Azure VMs, some on-prem), use
**Essential Machine Management** to enroll the subscription so everything
gets the same baseline of Insights / Update Manager / Change Tracking /
Machine Config. EMM is handled in the upstream `azure-compute` skill's
`essential-machine-management` workflow.
