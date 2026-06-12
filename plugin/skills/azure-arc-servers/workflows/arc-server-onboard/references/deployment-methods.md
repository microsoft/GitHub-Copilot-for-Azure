# Arc Server Deployment Methods

The portal generates four flavors of onboarding artifact. Pick one based
on the user's deployment substrate.

Source enum: `DeploymentOptions` in
`Client/React/Views/ArcServers/Enums.d.ts`:

```ts
export const enum DeploymentOptions {
    Basic = "Basic",
    ConfigurationManager = "ConfigurationManager",
    GroupPolicy = "GroupPolicy",
    Ansible = "Ansible",
}
```

## Decision table

| User says | Pick |
|---|---|
| "I'll run it on this one box" | **Basic** |
| "We use SCCM / ConfigMgr / MECM" | **Configuration Manager** |
| "We use Group Policy / AD / GPO" | **Group Policy** |
| "We use Ansible / Tower / AWX / AAP" | **Ansible** |
| "We use Puppet / Chef / Salt / Terraform / Bicep" | Use the **Basic** PowerShell / Bash and wrap it in their existing tool. There is no first-party template for those. |
| "We use Intune" | Use the **Basic** PowerShell and deploy as a Win32 app or platform script. |

## 1. Basic (PowerShell or Bash)

A self-contained installer script. The user copies it to the machine
and runs it as admin / root. The portal generates this for every
single-server flow.

**Source templates:**
- `Client/React/Views/ArcServers/Create/ScriptUx/Utilities/Templates/WindowsScriptTemplate.ts`
- `Client/React/Views/ArcServers/Create/ScriptUx/Utilities/Templates/LinuxScriptTemplate.ts`

**Pipeline:**
1. Set environment variables for cloud, region, tenant, subscription,
   resource group, correlation ID, auth (Service Principal or token).
2. Download the agent installer from a known URL (or alt-download for
   Edge / air-gapped).
3. Install (`msiexec` on Windows, `apt` / `dnf` / `zypper` on Linux).
4. Optionally write `endpoints.json` for sovereign / Edge clouds.
5. Run `azcmagent connect` with all the right flags.
6. Optionally install management-services extensions (Update Manager,
   Defender, etc.) on the same machine in the same script.

**Auth modes:**
- **Interactive token** (default for single machine): the script prints
  a device-code URL; the user signs in once.
- **Service Principal**: the script reads `appId` / `clientSecret` from
  env vars and authenticates non-interactively. Required for any
  unattended path.

## 2. Configuration Manager

The portal generates a PowerShell script + the instructions for
packaging it as a CM application or package. Suitable for shops with
mature ConfigMgr practice.

**Required inputs:**
- Service Principal (interactive token doesn't work for CM-managed installs).
- A remote share path where the agent installer can sit, accessible to
  CM distribution points.

**Typical structure:**
1. Copy `AzureConnectedMachineAgent.msi` to a network share.
2. Create a CM application with detection rule "registry key
   `HKLM\SOFTWARE\Microsoft\AzureConnectedMachineAgent` exists".
3. Install command: `powershell.exe -ExecutionPolicy Bypass -File OnboardingScript.ps1`.
4. Deploy to the appropriate device collection.

## 3. Group Policy

The portal generates a PowerShell script + instructions for the GPMC
(Group Policy Management Console). Targeted at AD-joined Windows
servers.

**Required inputs:**
- Service Principal stored in a domain-readable location (often a
  read-only secret on the shared SYSVOL or a sealed shared folder).
- A remote share for the installer and script (the `RemoteShareName`
  and `RemoteServerDomainName` inputs you'll see in the portal map to
  this).

**Typical structure:**
1. Place the installer and `OnboardingScript.ps1` on a domain-readable
   share.
2. Create a Computer Configuration GPO with a Startup PowerShell Script
   pointing to the share.
3. Link the GPO to the OU containing the target servers.
4. Force a `gpupdate /force` or wait for next boot.

The portal's GroupPolicyReviewComponents render the click-through
instructions, available links to download
`DeployGPO.ps1`/`EnableCredSSP.ps1`, and the `gpresult` validation
steps. Mirror that in the generated guidance.

## 4. Ansible

A YAML playbook with `win_shell` / `shell` tasks and `block`/`rescue`
error handling. Source templates:

- `Client/React/Views/ArcServers/Create/ScriptUx/Utilities/Templates/AnsibleWindowsTemplate.ts`
- `Client/React/Views/ArcServers/Create/ScriptUx/Utilities/Templates/AnsibleLinuxTemplate.ts`

**Required inputs:**
- Service Principal (always - Ansible runs unattended).
- Tower / AWX / AAP inventory targeting the right hosts.

**Typical structure (Linux):**
```yaml
- hosts: arc_targets
  become: true
  tasks:
    - name: Download Arc agent install script
      get_url:
        url: "https://aka.ms/azcmagent"
        dest: /tmp/install_linux_azcmagent.sh
        mode: '0755'

    - name: Install the agent
      shell: bash /tmp/install_linux_azcmagent.sh

    - name: Connect to Azure
      shell: |
        azcmagent connect \
          --resource-group "{{ rg }}" \
          --tenant-id "{{ tenant_id }}" \
          --location "{{ region }}" \
          --subscription-id "{{ subscription_id }}" \
          --service-principal-id "{{ sp_app_id }}" \
          --service-principal-secret "{{ sp_secret }}" \
          --tags "{{ tags }}"
      register: connect_result
      failed_when: connect_result.rc != 0
```

The portal's Ansible templates wrap each step in `block` / `rescue`
with explicit `assert` tasks - mirror that pattern for production use.

## What the portal does that the agent (and your script) should match

Read this section if you're hand-rolling vs using the portal-generated
script.

1. **Correlation ID.** The portal injects a GUID per onboarding so that
   support can trace from the portal click to the Azure resource. Set
   `--correlation-id <guid>` on `azcmagent connect`.
2. **Tags.** The portal merges per-form tags + location tags + default
   tags. Pass them on `connect` with `--tags "k=v,k=v"`.
3. **Cloud parameter.** Public / USGov / China / Edge - each has its
   own value. The portal pulls this from `getEnvironmentValue` in the
   ReactView. The agent flag is `--cloud AzureCloud` (default),
   `AzureUSGovernment`, `AzureChinaCloud`, etc.
4. **Configuration profile (Automanage).** Optional. If the user picked
   an Automanage best-practices profile in the wizard, the script
   triggers it post-connect. This is gated by
   `arcservercreateautomanagemachine` and currently off in all
   environments per `featureFlags.md` - skip unless the user explicitly
   asks for Automanage.
5. **Management services.** The selected services (Update Manager,
   Defender, Insights, Change Tracking, Machine Config, Hotpatch) become
   `az connectedmachine extension create` commands appended to the
   script. The enum is `ManagementServiceKey`.
6. **TPM identity.** Behind `enabletpmservers`, off everywhere - skip.

## When to send the user to the portal instead

If the user wants:

- The **canonical** script with all sovereign / Edge / proxy / gateway
  / TPM blocks resolved automatically, OR
- A copy-paste Group Policy / Configuration Manager review screen, OR
- The agent download link signed with their tenant's correlation ID,

...tell them: open Azure portal, search for **Azure Arc**, click
**Manage servers** > **Add**. Pick the deployment method tile that
matches the choice above. The wizard generates the exact same script
the portal would generate.

Portal link:
[Add an Arc server](https://portal.azure.com/#blade/Microsoft_Azure_HybridCompute/HybridVmAddBlade).
