# Arc Server Onboarding

Guided flow for connecting one or many existing servers to Azure Arc via
the **Connected Machine agent** (`azcmagent`).

## When to use

- User wants to **connect**, **onboard**, **enroll**, **register**, or
  **project** an existing server into Azure.
- User asks for an **install script**, **install command**, or
  **agent download link** for Arc.
- User wants to onboard **at scale** (multiple servers): Configuration
  Manager, Group Policy, Ansible, or a script handed to ops.
- User has an existing recommendation in hand and wants the deployable
  artifact.

> **Not for new VMs.** If the user wants Azure to provision a brand-new
> VM, route to `azure-compute`. Arc never creates a machine.

> **Not for Arc-private-cloud VMs.** If the user wants a VM on Azure
> Local / VMware / SCVMM via a Resource Bridge, route to
> `azure-local` / `arc-vmware` / `arc-scvmm` (proposed skills).

## Workflow

### Step 1 - Single server or at scale?

If the user said "a server" / "this machine" / "my laptop" -> single.
If the user said "all our servers" / "100 machines" / "fleet" / mentioned
Group Policy or Configuration Manager or Ansible -> at scale.
If unclear, ask one question:

> "Onboarding one machine, or rolling this out across many at once?"

At-scale path: load
[references/at-scale-onboarding.md](references/at-scale-onboarding.md).
Single-server path: continue below.

### Step 2 - Confirm prerequisites are met

Don't generate a script if a prereq is going to make it fail. Load
[references/prerequisites.md](references/prerequisites.md) and confirm:

- The user has at least the **Azure Connected Machine Onboarding** role
  on the target resource group.
- The `Microsoft.HybridCompute`, `Microsoft.GuestConfiguration`, and
  `Microsoft.HybridConnectivity` resource providers are registered in
  the target subscription. (Use `mcp__azure__resource_show` on the
  subscription's `providers` to check.)
- The target machine OS is supported (recent Windows Server / desktop
  Windows / supported Linux distro).
- The machine can reach the required endpoints (see
  [references/connectivity-options.md](references/connectivity-options.md)).

If any prereq is missing, surface it now and offer a fix. Do not
silently proceed.

### Step 3 - Depth probe (adaptive gather)

Classify the user's intent and ask **only** the questions that matter
for their path. Never re-ask anything the user already said.

| Signal in user's message | Path |
|---|---|
| "just try it", "lab", "POC", "one box", nothing specific | **Fast path** - assume defaults, ask only sub / RG / region. |
| "production", "many machines", "automate" | **Operations path** - ask about auth (Service Principal), connectivity, and management services. |
| "VNet", "Private Link", "Arc Gateway", "proxy", "no public internet", "air-gapped" | **Networking-deep path** - load [references/connectivity-options.md](references/connectivity-options.md) and ask the right network questions. |
| "compliance", "FedRAMP", "Gov cloud", "Mooncake", "sovereign" | **Compliance path** - confirm cloud (Public / USGov / China / Edge), pick the matching download endpoint, force Service Principal auth. |

### Step 4 - Gather minimum required inputs

For every path, you need:

| Input | Default if not given | Notes |
|---|---|---|
| **Subscription** | None - must ask | Use `mcp__azure__subscription_list` to show options. |
| **Resource group** | Propose `<machine-name>-arc-rg` or `arc-servers-rg` | Use `mcp__azure__group_list` to show existing. |
| **Region** | Propose `eastus` for Public, `usgovvirginia` for USGov, `chinanorth3` for China | Arc has regional residency for the resource record. Pick a region close to the machine. |
| **OS** | None - must ask if not obvious | Windows or Linux. Drives which script to generate. |
| **Authentication** | Interactive token (single machine) / Service Principal (multi or unattended) | See [references/connectivity-options.md](references/connectivity-options.md). |
| **Connectivity** | Public endpoint | Ask only if networking-deep signal. |
| **Tags** | `{ environment: <ask>, owner: <user> }` | Accept "none" without follow-up. |

For at-scale paths, add:

| Input | Default | Notes |
|---|---|---|
| **Deployment method** | Ask | One of: `Basic` (run script per machine), `ConfigurationManager`, `GroupPolicy`, `Ansible`. Source enum: `DeploymentOptions` in `Client/React/Views/ArcServers/Enums.d.ts`. |
| **Service Principal** | Required for all non-Basic at-scale methods | The interactive token flow does not work for unattended installs. |

For Edge / sovereign environments:

| Input | Notes |
|---|---|
| **Cloud** | Public / USGov / China / Edge / Air-gapped. Different download URLs and endpoint blocks. The portal handles this via feature flags (`enableSpecifiedArmEndpoint`, `enableAltDownload`, `enableAltHisEndpoint`, `enableAgcAltDownload` for air-gapped). |
| **Alt HIS endpoint** | Required for Edge / air-gapped. |
| **Alt download URL** | Required for Edge / air-gapped where the standard blob endpoint is unreachable. |

### Step 5 - Plan Card

> **GATE.** Do not output a script until the user has seen and approved
> the Plan Card.

Render a single markdown table summarizing every decision (asked +
defaulted). Example:

| Decision | Value | Source |
|---|---|---|
| Subscription | Contoso-Prod (00000000-...) | User |
| Resource group | `arc-servers-rg` (new) | Default |
| Region | eastus | Default |
| OS | Windows | User |
| Auth | Service Principal `arc-onboard-sp` | User |
| Connectivity | Public endpoint with proxy `http://proxy.contoso.com:8080` | User |
| Tags | `environment=prod`, `team=infra` | User |
| Management services to install | Update Manager, Defender for Cloud | Default for prod |
| Cloud | AzureCloud (Public) | Inferred |

Ask: *"Approve as-is, edit a row, or change output format?"*. Do not
generate until approved.

### Step 6 - Generate the script

Pick the script format that matches the user's deployment method:

| Deployment method | Script format |
|---|---|
| Basic / single | PowerShell (Windows) or Bash (Linux), one-file installer |
| Configuration Manager | PowerShell wrapped in a CM package |
| Group Policy | PowerShell + GPO setup steps |
| Ansible | YAML playbook (`win_shell` / `shell` tasks, `block`/`rescue` error handling) |

Load
[references/deployment-methods.md](references/deployment-methods.md) for
the canonical structure of each, then emit. Inline the actual values
from the Plan Card; do not leave `<placeholders>` unless the user asked
for a template.

**Source of truth.** The portal generates these scripts from
`src/HybridComputeExtension/Client/React/Views/ArcServers/Create/ScriptUx/Utilities/`.
If the user wants the exact portal script, send them to the **Add
server** wizard in the Arc Center
([portal link](https://portal.azure.com/#blade/Microsoft_Azure_HybridCompute/HybridVmAddBlade))
and tell them which deployment method tile to pick.

### Step 7 - Delivery

Ask once: *"Where should this script go?"* Three options:

| Option | Action |
|---|---|
| **Print here** | Render the script inline. Add a copy-block fence. |
| **Save locally** | Write to a file using available file-system tools; tell the user the path. |
| **GitHub PR** | Open a PR with the script under `scripts/arc-onboarding/`. |

### Step 8 - Tell the user what to do next

For all paths, end with a short "what happens after you run it" note:

1. `azcmagent connect` runs and prints a device-code URL (interactive
   auth) or authenticates non-interactively (Service Principal).
2. The machine appears in the Arc Center with status `Connecting`, then
   `Connected` within a minute.
3. Auto-upgrade is **enabled by default** on agent 1.41+.
4. Recommended next steps: enable Update Manager periodic assessment,
   assign the recommended Arc-server policy initiative, link a Data
   Collection Rule for Insights.

Route the user to [arc-server-manage](../arc-server-manage/arc-server-manage.md)
if they ask "what now?".

## Error handling

| Scenario | Action |
|---|---|
| Subscription does not have `Microsoft.HybridCompute` registered | Offer to register via `az provider register --namespace Microsoft.HybridCompute`. The portal does this automatically; the script does not. |
| User does not have onboarding role | Surface required role: **Azure Connected Machine Onboarding** (or higher). Link them to the IAM blade for the target RG. |
| User asked for Private Link + Arc Gateway in the same breath | Allowed but unusual - confirm both are intended. Both require additional setup; see [references/connectivity-options.md](references/connectivity-options.md). |
| Air-gapped / Edge cloud and no alt-download URL was provided | Hard-stop. Ask for the alt-download URL (blob endpoint reachable from the air-gapped network). |
| User on Windows Server 2012 / 2012 R2 | Confirm they're onboarding for ESU. Mention ESU eligibility - route to [arc-server-manage](../arc-server-manage/arc-server-manage.md) after onboarding succeeds. |
| Script fails on machine with "no network" / 403 / connection refused | Route to [arc-server-troubleshoot](../arc-server-troubleshoot/arc-server-troubleshoot.md). Do not regenerate the script. |
| Linux machine but user wants RDP | Likely confusion - clarify OS. |

## Routing back / handoff

| Situation | Route to |
|---|---|
| Script ran but agent shows Disconnected / Expired / Error | [arc-server-troubleshoot](../arc-server-troubleshoot/arc-server-troubleshoot.md) |
| Onboarding worked, now what? | [arc-server-manage](../arc-server-manage/arc-server-manage.md) |
| Need to onboard hundreds of machines via Group Policy | [references/at-scale-onboarding.md](references/at-scale-onboarding.md) |
| Deep network questions (Private Link DNS, gateway allowlist) | [references/connectivity-options.md](references/connectivity-options.md) and (proposed) `arc-private-link` / `arc-gateway` skills |
