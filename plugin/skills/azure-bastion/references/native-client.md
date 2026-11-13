# Azure Bastion Native Client Support

Native client support allows you to connect to Azure VMs using your local RDP and SSH applications — such as Windows Remote Desktop (`mstsc.exe`), PuTTY, OpenSSH, or any SSH client — through an Azure Bastion tunnel, instead of relying on the browser-based portal experience.

## Overview

By default, Azure Bastion provides browser-based RDP/SSH from the Azure portal. Native client support extends this by creating an encrypted tunnel from your workstation through the Bastion host to the target VM. Your local client application communicates through this tunnel, giving you full-featured RDP/SSH with local clipboard, drive redirection, audio, and multi-monitor support.

**Key benefit:** You get the security of Bastion (no public IP on VMs, TLS-encrypted traffic, Azure AD integration) combined with the full feature set of your native RDP/SSH client.

## Prerequisites

1. **Azure Bastion SKU:** Standard or Premium — native client is **not** available on Developer or Basic SKUs
2. **Azure CLI:** Version 2.32.0 or later installed on your workstation
3. **SSH extension (for SSH):** Install via `az extension add --name ssh`
4. **Network access:** Your workstation must have outbound access on port 443 to the Bastion host
5. **Azure authentication:** You must be signed in with `az login` and have appropriate RBAC permissions (Reader role on the VM, Bastion, VNet, and NIC resources)

```bash
# Verify Azure CLI version
az --version

# Install or update the SSH extension
az extension add --name ssh --upgrade

# Sign in to Azure
az login
```

## az network bastion rdp

Use `az network bastion rdp` to connect to a Windows VM using your native RDP client (mstsc.exe on Windows).

### Basic Usage

```bash
# Connect by target resource ID
az network bastion rdp \
  --name MyBastion \
  --resource-group MyRG \
  --target-resource-id /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyWindowsVM
```

### Connect by IP Address (Standard/Premium)

```bash
# Connect to a VM by its private IP (requires IP-based connection enabled)
az network bastion rdp \
  --name MyBastion \
  --resource-group MyRG \
  --target-ip-address 10.0.1.4
```

### Full Parameter Reference

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--name` / `-n` | Yes | Name of the Bastion host |
| `--resource-group` / `-g` | Yes | Resource group containing the Bastion host |
| `--target-resource-id` | Yes* | Full ARM resource ID of the target VM |
| `--target-ip-address` | Yes* | Private IP of the target VM (requires IP-based connection) |
| `--configure` | No | Configure RDP file settings before connecting |
| `--disable-gateway` | No | Disable RD Gateway usage |

> *Provide either `--target-resource-id` or `--target-ip-address`, not both.

### What Happens Under the Hood

1. Azure CLI authenticates with your Azure credentials
2. A secure WebSocket tunnel is established from your machine to the Bastion host over port 443
3. Bastion forwards the connection to the target VM's private IP on port 3389
4. Your local `mstsc.exe` (Remote Desktop) launches and connects through the tunnel
5. You authenticate to the VM with Windows credentials (or Kerberos SSO if configured)

## az network bastion ssh

Use `az network bastion ssh` to connect to a Linux (or Windows with OpenSSH) VM using your local SSH client.

### Connect with SSH Key

```bash
az network bastion ssh \
  --name MyBastion \
  --resource-group MyRG \
  --target-resource-id /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyLinuxVM \
  --auth-type ssh-key \
  --username azureuser \
  --ssh-key ~/.ssh/id_rsa
```

### Connect with Password

```bash
az network bastion ssh \
  --name MyBastion \
  --resource-group MyRG \
  --target-resource-id /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyLinuxVM \
  --auth-type password \
  --username azureuser
# You will be prompted for the password interactively
```

### Connect with Azure AD Authentication

Azure AD (Entra ID) authentication allows passwordless SSH using your Azure identity. The target VM must have the AADSSHLoginForLinux extension installed.

```bash
# Install the AAD SSH login extension on the VM (one-time setup)
az vm extension set \
  --publisher Microsoft.Azure.ActiveDirectory \
  --name AADSSHLoginForLinux \
  --resource-group MyRG \
  --vm-name MyLinuxVM

# Connect using Azure AD auth
az network bastion ssh \
  --name MyBastion \
  --resource-group MyRG \
  --target-resource-id /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyLinuxVM \
  --auth-type AAD
```

**Required RBAC for AAD SSH:**
- `Virtual Machine Administrator Login` — full sudo access
- `Virtual Machine User Login` — standard user access

### Full Parameter Reference

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--name` / `-n` | Yes | Name of the Bastion host |
| `--resource-group` / `-g` | Yes | Resource group containing the Bastion host |
| `--target-resource-id` | Yes* | Full ARM resource ID of the target VM |
| `--target-ip-address` | Yes* | Private IP of the target VM |
| `--auth-type` | Yes | Authentication type: `ssh-key`, `password`, or `AAD` |
| `--username` | Cond. | SSH username (required for `ssh-key` and `password` auth) |
| `--ssh-key` | Cond. | Path to SSH private key file (required for `ssh-key` auth) |

## az network bastion tunnel

The tunnel command creates a local port forward through Bastion, allowing any local application to communicate with the target VM's port. This is the most flexible native client option.

### Basic Tunnel for RDP

```bash
# Forward local port 50001 to VM's port 3389 (RDP)
az network bastion tunnel \
  --name MyBastion \
  --resource-group MyRG \
  --target-resource-id /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyVM \
  --resource-port 3389 \
  --port 50001
```

Then connect your RDP client to `localhost:50001`.

### Tunnel for SSH

```bash
# Forward local port 50022 to VM's port 22 (SSH)
az network bastion tunnel \
  --name MyBastion \
  --resource-group MyRG \
  --target-resource-id /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyLinuxVM \
  --resource-port 22 \
  --port 50022
```

Then connect: `ssh -p 50022 azureuser@localhost`

### Tunnel for Database Access

```bash
# Forward local port 54321 to VM's PostgreSQL port 5432
az network bastion tunnel \
  --name MyBastion \
  --resource-group MyRG \
  --target-resource-id /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/MyDBServer \
  --resource-port 5432 \
  --port 54321
```

Then connect with psql: `psql -h localhost -p 54321 -U dbadmin mydb`

### Full Parameter Reference

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--name` / `-n` | Yes | Name of the Bastion host |
| `--resource-group` / `-g` | Yes | Resource group containing the Bastion host |
| `--target-resource-id` | Yes* | Full ARM resource ID of the target VM |
| `--target-ip-address` | Yes* | Private IP of the target VM |
| `--resource-port` | Yes | Port on the target VM to connect to |
| `--port` | Yes | Local port on your workstation to listen on |
| `--timeout` | No | Timeout in seconds for idle tunnel (default: no timeout) |

## Use Cases

### File Transfer via RDP
Native RDP supports drive redirection — map a local drive to the remote session for file transfer. This is not available in browser-based Bastion RDP.

### Using PuTTY or Other SSH Clients
Create a tunnel with `az network bastion tunnel` on port 22, then point PuTTY at `localhost:<local-port>`. This lets you use PuTTY's saved sessions, key agent, and X11 forwarding.

### Forwarding Database Ports
Tunnel arbitrary ports (MySQL 3306, PostgreSQL 5432, SQL Server 1433) to access databases running on VMs without exposing them publicly.

### SCP / SFTP File Transfer
With a tunnel active on port 22, use `scp` or `sftp` through `localhost:<local-port>` for file operations.

## Comparison: Browser-Based vs. Native Client

| Feature | Browser-Based | Native Client |
|---------|--------------|---------------|
| SKU required | All SKUs | Standard / Premium |
| Clipboard copy/paste | Text only | Full (depends on client) |
| Drive/file redirection | No | Yes (RDP) |
| Multi-monitor | No | Yes (RDP) |
| Audio redirection | No | Yes (RDP) |
| Arbitrary port forwarding | No | Yes (tunnel) |
| AAD/Entra ID SSH login | No | Yes |
| Performance | Good | Better (native rendering) |
| Requires Azure CLI | No | Yes |
| Works from any browser | Yes | No (requires CLI + client) |

## Troubleshooting

### Tunnel Not Connecting

1. **Verify SKU:** Native client requires Standard or Premium. Check with:
   ```bash
   az network bastion show -g MyRG -n MyBastion --query sku.name -o tsv
   ```
2. **Check Azure CLI version:** Must be 2.32.0+. Run `az --version`.
3. **Port conflict:** Ensure the local port is not already in use. Try a different `--port` value.
4. **Firewall:** Your workstation must allow outbound 443 to the Bastion public IP.

### Authentication Failures

1. **RBAC permissions:** You need at minimum Reader on the VM, NIC, Bastion, and VNet resources.
2. **AAD SSH:** Ensure the `AADSSHLoginForLinux` extension is installed and healthy on the VM.
3. **SSH key mismatch:** Verify the private key matches the public key configured on the VM.
4. **Expired token:** Run `az login` again if your Azure session has expired.

### Timeout / Disconnection

1. **Idle timeout:** Bastion tunnels may disconnect after extended idle periods. Keep the session active or re-establish the tunnel.
2. **Scale units:** If many users are connecting simultaneously, the Bastion host may be at capacity. Increase scale units:
   ```bash
   az network bastion update -g MyRG -n MyBastion --scale-units 4
   ```
3. **Network instability:** Bastion uses WebSocket over TLS. Unstable internet connections or proxy servers that interfere with WebSocket can cause drops.

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `Bastion Host SKU does not support native client` | Basic or Developer SKU | Upgrade to Standard |
| `Target resource not found` | Incorrect resource ID | Verify the full ARM resource ID |
| `Port already in use` | Local port conflict | Choose a different `--port` |
| `Authorization failed` | Missing RBAC permissions | Grant Reader role on required resources |
