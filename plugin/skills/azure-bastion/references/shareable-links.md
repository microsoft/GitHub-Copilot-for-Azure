# Azure Bastion Shareable Links

Shareable links allow you to generate a unique URL that provides browser-based RDP or SSH access to a specific Azure VM through Bastion — without requiring the recipient to navigate the Azure portal or have Azure portal access.

## Overview

When you create a shareable link, Azure Bastion generates a unique, cryptographically random URL that points directly to a Bastion-mediated connection for a target VM. Anyone with the link and valid VM credentials can connect through their web browser.

**Key characteristics:**
- Access is browser-based only — no native client support through shareable links
- Recipients must still authenticate to the target VM (Windows credentials for RDP, SSH credentials for SSH)
- Links are tied to a specific VM and Bastion host
- The feature must be explicitly enabled on the Bastion host

## Requirements

- **Bastion SKU:** Standard or Premium — shareable links are **not** available on Developer or Basic SKUs
- **Feature enabled:** Shareable links must be enabled on the Bastion host before links can be generated
- **RBAC:** The person generating the link needs Contributor or Owner on the Bastion resource
- **VM state:** The target VM must be running when the link recipient connects

## Enabling Shareable Links

Shareable links are disabled by default. You must enable the feature on the Bastion host before creating any links.

### Azure CLI

```bash
# Enable shareable links on an existing Bastion host
az network bastion update \
  --resource-group MyRG \
  --name MyBastion \
  --enable-shareable-link true
```

### Azure Portal

1. Navigate to your Bastion resource in the Azure portal
2. Go to **Configuration** in the left menu
3. Check the **Shareable Link** option
4. Click **Apply**

### Bicep / ARM Template

```bicep
resource bastion 'Microsoft.Network/bastionHosts@2023-09-01' = {
  name: 'MyBastion'
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    enableShareableLink: true
    ipConfigurations: [
      {
        name: 'IpConf'
        properties: {
          subnet: {
            id: bastionSubnetId
          }
          publicIPAddress: {
            id: publicIpId
          }
        }
      }
    ]
  }
}
```

## Generating a Shareable Link

### Azure Portal

1. Navigate to your Bastion resource
2. Select **Shareable links** in the left menu
3. Click **Add** or **Create shareable link**
4. Select the target VM from the list
5. Click **Apply** — a unique URL is generated
6. Copy the URL and share it with the intended recipient

### Azure CLI

```bash
# Generate a shareable link for a VM (creates the link via REST API)
az rest --method put \
  --url "https://management.azure.com/subscriptions/{sub-id}/resourceGroups/MyRG/providers/Microsoft.Network/bastionHosts/MyBastion/createShareableLinks?api-version=2023-09-01" \
  --body '{
    "vms": [
      {
        "vm": {
          "id": "/subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyVM"
        }
      }
    ]
  }'
```

### Link Format

Generated links follow this pattern:
```
https://<bastion-dns-name>.bastion.azure.com/api/shareable-url/<unique-token>
```

The unique token is a cryptographically random string that maps to the specific VM.

## How Shareable Links Work

1. **Link creator** enables shareable links on the Bastion host and generates a link for a target VM
2. **Link recipient** opens the URL in a web browser
3. The browser connects over TLS (port 443) to the Bastion host
4. Bastion presents a login screen — the recipient enters **VM credentials** (not Azure credentials)
5. For RDP: Windows username/password; for SSH: Linux username and password or key
6. Bastion establishes the connection to the VM's private IP
7. The session runs in the browser, identical to portal-based Bastion access

## Security Considerations

### Authentication Is Always Required
A shareable link does **not** bypass VM authentication. The recipient must provide valid credentials for the target VM's operating system. The link only removes the need to navigate the Azure portal — it does not grant automatic access.

### Link Expiration
- Shareable links do **not** expire automatically by default
- Links remain valid as long as the Bastion host exists and has shareable links enabled
- To invalidate links, you must explicitly delete them or disable the shareable links feature

### Who Can Access the Link
- Anyone with the URL and valid VM credentials can connect
- There is no Azure AD authentication layer on the link itself — the security boundary is the VM's own authentication
- Treat shareable links like sensitive credentials — share through secure channels only

### Audit and Monitoring
- Connection attempts through shareable links are logged in Azure Bastion diagnostic logs
- Enable diagnostic settings on the Bastion host to send logs to Log Analytics, Storage, or Event Hubs
- Logs include: source IP, target VM, timestamp, connection duration, and authentication result

### Best Practices
1. **Limit distribution** — share links only with intended recipients through secure channels (encrypted email, secure messaging)
2. **Rotate links** — periodically delete and regenerate links for long-term access scenarios
3. **Monitor usage** — enable Bastion diagnostic logs and review connection patterns
4. **Use strong VM credentials** — since the link shifts the security boundary to VM-level authentication, enforce strong passwords or key-based auth
5. **Disable when not needed** — if shareable links are no longer required, disable the feature to prevent new link generation

## Use Cases

### Third-Party Contractor Access
Grant a contractor browser-based RDP/SSH access to a specific VM without giving them Azure portal access. The contractor only needs the shareable link URL and VM credentials.

### Support and Troubleshooting
Share a link with a support engineer so they can directly access a VM to diagnose issues, without provisioning Azure RBAC roles or portal access.

### Training and Demos
Distribute shareable links to training participants so they can access lab VMs through their browsers without Azure subscriptions.

### Temporary Project Access
Provide short-term VM access to team members who don't have Azure portal access. Delete the links when the project concludes.

## Limitations

- **Browser-based only** — shareable links open a browser session; native client connections (RDP/SSH/tunnel) are not supported through shareable links
- **No Azure AD on the link** — there is no way to require Azure AD authentication before the VM login screen; security depends on VM credentials
- **No automatic expiration** — links do not have a built-in TTL; you must manually revoke them
- **One link per VM** — each VM gets a single shareable link per Bastion host
- **Portal dependency for creation** — link generation currently requires the Azure portal or REST API; no first-class Azure CLI command yet
- **Standard/Premium only** — Developer and Basic SKUs do not support this feature

## Revoking Shareable Links

### Azure Portal

1. Navigate to your Bastion resource
2. Select **Shareable links** in the left menu
3. Select the link(s) to revoke
4. Click **Delete**

### Disable Feature Entirely

```bash
# Disable shareable links — all existing links stop working immediately
az network bastion update \
  --resource-group MyRG \
  --name MyBastion \
  --enable-shareable-link false
```

> **Warning:** Disabling shareable links invalidates **all** existing links for that Bastion host. There is no way to selectively disable links via CLI — use the portal to delete individual links.

### REST API

```bash
# Delete a specific shareable link
az rest --method post \
  --url "https://management.azure.com/subscriptions/{sub-id}/resourceGroups/MyRG/providers/Microsoft.Network/bastionHosts/MyBastion/deleteShareableLinks?api-version=2023-09-01" \
  --body '{
    "vms": [
      {
        "vm": {
          "id": "/subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyVM"
        }
      }
    ]
  }'
```

## Troubleshooting

### Link Not Working

1. **Feature enabled?** Verify shareable links are enabled on the Bastion host:
   ```bash
   az network bastion show -g MyRG -n MyBastion --query properties.enableShareableLink -o tsv
   ```
2. **SKU check:** Must be Standard or Premium:
   ```bash
   az network bastion show -g MyRG -n MyBastion --query sku.name -o tsv
   ```
3. **VM running?** The target VM must be in a running state. A deallocated VM cannot accept connections.
4. **Link deleted?** Check if the link still exists in the Bastion shareable links list in the portal.

### Authentication Issues

1. **Wrong credentials:** Shareable links authenticate against the VM OS, not Azure AD. Ensure you are using the correct local or domain credentials for the VM.
2. **NLA (Network Level Authentication):** For Windows VMs with NLA enabled, the RDP client in the browser must support NLA. This is handled automatically by Bastion.
3. **Locked account:** Too many failed attempts may lock the VM account. Check the VM's event logs.

### Performance Issues

1. **Scale units:** If many shareable link users are connecting simultaneously, increase scale units on the Bastion host.
2. **Browser compatibility:** Use a modern browser (Edge, Chrome, Firefox). Safari may have limited clipboard support.
3. **Network latency:** The user's proximity to the Azure region hosting the Bastion affects responsiveness. There is no mitigation other than choosing a geographically close region.
