# At-Scale Arc Server Onboarding

Load this when the user is onboarding many machines at once. The
single-server fast path is in
[arc-server-onboard.md](../arc-server-onboard.md); this file extends it
with the at-scale-specific decisions.

## When to use

| Scale | Recommendation |
|---|---|
| 1-5 machines | Single-server flow per machine. Don't over-engineer. |
| 5-50 machines, no central management | Basic script + a Service Principal, distributed via shared share / email. |
| 50+ machines, AD-joined Windows | **Group Policy** (Windows) or **Ansible** (mixed). |
| Any scale, ConfigMgr shop | **Configuration Manager**. |
| Any scale, multi-cloud (AWS / GCP machines) | Either at-scale script per cloud, **or** consider the AWS / GCP connector (proposed `arc-multicloud` skill) for inventory sync. |
| 100s of machines, want one firewall rule | Add **Arc Gateway** to whichever deployment method you pick. |

## Decisions you must collect before generating

| Decision | Why it matters |
|---|---|
| **Deployment method** | Drives the script template. See [deployment-methods.md](deployment-methods.md). |
| **Service Principal** | All non-Basic at-scale paths require non-interactive auth. The interactive token flow does not scale. |
| **Connectivity** | Public, Private Link, Arc Gateway. Affects script content and possibly DNS setup. |
| **Tag schema** | Apply consistent tags so the fleet is filterable post-onboarding (env, owner, datacenter). |
| **Management services** | Decide once for the fleet. Adding extensions post-onboarding via Policy is fine, but it's cleaner to bake them into the onboarding script. |
| **Naming** | The resource name = OS hostname. If hostnames collide (rare but possible across air-gapped sites), plan a rename strategy before onboarding. |
| **OU / collection / inventory scope** | Where the deployment tool targets the script. |

## Service Principal setup (one-time)

Create a single onboarding SP for the whole fleet. Scope it minimally.

```bash
# Create
az ad sp create-for-rbac \
    --name "arc-onboarding-sp" \
    --role "Azure Connected Machine Onboarding" \
    --scopes "/subscriptions/<sub>/resourceGroups/<rg>"
```

Capture `appId`, `password`, `tenant`. Store the secret in:

- For Group Policy: a sealed shared folder readable by SYSTEM on the GPO
  target machines (use `cipher.exe /E` or DPAPI-NG).
- For ConfigMgr: a CM script parameter / secret store.
- For Ansible: Ansible Vault.

**Rotate the secret every 6-12 months.** Expired SP secrets are the #2
cause of "we onboarded 200 servers and now half are showing Expired in
the Arc Center" - just before "DNS misconfiguration on Private Link".

## At-scale flow

### Step 1 - Pilot

Onboard 1-3 machines first using the chosen deployment method. Verify:

- The machines show up in the Arc Center within 5 minutes.
- Status flips to `Connected`.
- `agentVersion` is current.
- The expected extensions install.
- Run `azcmagent check` on a pilot machine - all endpoints should be reachable.

If any fail, fix before fanning out.

### Step 2 - Stage

Roll out to a representative subset (one OU, one site, one CM
collection). Watch the Arc Center for the next 24 hours. Use a Resource
Graph query to spot stragglers:

```kql
resources
| where type =~ "microsoft.hybridcompute/machines"
| where tags.deploymentBatch == "stage-2025-05"
| extend status = tostring(properties.status), agentVersion = tostring(properties.agentVersion)
| summarize count() by status
```

### Step 3 - Production

Fan out to the rest of the fleet. Continue to monitor with the same
query. Triage any non-`Connected` machines via
[arc-server-troubleshoot](../../arc-server-troubleshoot/arc-server-troubleshoot.md).

### Step 4 - Lock in

Once steady-state:

- Assign the **Azure Arc-enabled Servers recommended initiative**
  (Azure Policy) at the management group or subscription scope. The
  portal's `Assign Recommended Policies` blade does this; the policy
  IDs are in `ArcServerOverview.ReactView.tsx`.
- Enable **agent auto-upgrade** at the fleet level - see
  [../../arc-server-manage/references/agent-upgrade.md](../../arc-server-manage/references/agent-upgrade.md).
- Link a **Data Collection Rule** for Insights / Update Manager so new
  machines get the right config the moment they connect.

## Per-method specifics

### Group Policy

- Use a Computer Startup PowerShell script (not a Logon script).
- Pin the script to a single version per OU - don't auto-pull "latest"
  or you'll have skewed installs.
- The portal's GroupPolicyReviewComponents render the exact GPMC
  click-paths. Reproduce them in user guidance.
- Validation command: `gpresult /h gpresult.html` on a target machine.

### Configuration Manager

- Application detection method: registry key
  `HKLM\SOFTWARE\Microsoft\AzureConnectedMachineAgent`.
- User experience: Hidden, Whether or not a user is logged on.
- Allowed install time: any.
- Maximum allowed run time: 30 minutes (network can vary).

### Ansible

- Tag machines by readiness state in your inventory; only run the
  playbook against `arc_ready=true`.
- Use `serial: 25` to throttle so 1000 machines don't all open
  outbound 443 in the same second.
- The portal templates use `block` / `rescue` / `always` per step. Mirror
  it. Specifically: catch installer failures separately from `connect`
  failures, because the remediation is different.

### Basic + custom orchestrator (Terraform, Bicep, Salt, custom Bash)

The Basic PowerShell / Bash is a single self-contained script. Wrap
in whatever tool the user has. The non-obvious bit: pass the
correlation ID through so onboardings are traceable end-to-end.

## What to tell the user about timing

| Scale | Realistic onboarding window |
|---|---|
| 10 machines | minutes |
| 100 machines | 1-2 hours (depending on rollout cadence) |
| 1,000 machines | 1-3 days (staged) |
| 10,000+ machines | 1-2 weeks staged |

The bottleneck is **not** Azure - it's the user's deployment tool and
their willingness to fan out without observing the pilot.

## Source in this repo

- `Client/React/Views/ArcServers/Create/ScriptUx/ArcServerCreateAtScale.ReactView.tsx`
  (the at-scale wizard blade)
- `Client/React/Views/ArcServers/Create/ScriptUx/ArcServerCreateLoggerAtScale.ts`
  (telemetry hooks - shows what fields the portal cares about)
- `Client/React/Views/ArcServers/Create/ScriptUx/Components/ArcServerCreateAtScaleReviewTabComponents.tsx`
  (review tab)
- `Client/React/Views/ArcServers/Create/ScriptUx/Components/GroupPolicyReviewComponents.tsx`
  (Group Policy click-paths)
