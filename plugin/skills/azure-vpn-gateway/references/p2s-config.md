# Point-to-Site VPN Configuration

## Overview

Point-to-site (P2S) VPN connects individual client devices (laptops, tablets, phones) to an Azure VNet over an encrypted tunnel. Unlike S2S VPN, P2S does not require an on-premises VPN device or a public IP — it works from any internet connection.

## P2S Tunnel Protocols

| Protocol | Platforms | Port | Notes |
|----------|-----------|------|-------|
| **OpenVPN** | Windows, macOS, Linux, iOS, Android | TCP 443 or UDP 1194 | Recommended. Most flexible, widest platform support. |
| **IKEv2** | Windows, macOS | UDP 500, 4500 | Native OS support. Best for macOS. |
| **SSTP** | Windows only | TCP 443 | Firewall-friendly but limited to Windows. |

### Protocol Selection Guidance

- **Multi-platform:** Use OpenVPN. Works everywhere and can traverse most firewalls via TCP 443.
- **macOS clients:** Use IKEv2 for native integration, or OpenVPN for cross-platform consistency.
- **Windows-only, strict firewall:** SSTP works over TCP 443, passing through most corporate firewalls. However, OpenVPN on TCP 443 is equally firewall-friendly and supports more platforms.
- **You can enable multiple protocols** on the same gateway. The client chooses at connection time.

## Authentication Methods

### 1. Azure Certificate Authentication

Client presents a certificate signed by a trusted root CA to authenticate.

**Setup Steps:**

```bash
# Configure P2S with certificate auth
az network vnet-gateway update \
  --name <gw-name> \
  --resource-group <rg> \
  --address-prefixes 172.16.0.0/24 \
  --client-protocol OpenVPN IkeV2 \
  --root-cert-name <root-cert-name> \
  --root-cert-data <base64-encoded-root-cert>
```

**Certificate workflow:**
1. Generate a self-signed root certificate (or use enterprise PKI root)
2. Export root cert public key as Base64 and upload to Azure
3. Generate client certificates signed by the root cert
4. Install client cert on each client device
5. Download and install VPN client configuration

**Revoke a client certificate:**

```bash
az network vnet-gateway revoked-cert create \
  --name <cert-name> \
  --resource-group <rg> \
  --gateway-name <gw-name> \
  --thumbprint <cert-thumbprint>
```

### 2. Microsoft Entra ID (Azure AD) Authentication

Users authenticate with their Entra ID credentials. Supports MFA and Conditional Access.

**Requirements:**
- OpenVPN protocol only
- Azure VPN Client application (Windows, macOS) or OpenVPN client
- Entra ID tenant with VPN application registration

**Setup Steps:**
1. Register the Azure VPN enterprise application in your Entra ID tenant
2. Grant admin consent for the VPN application
3. Configure the VPN gateway with Entra ID settings:

```bash
az network vnet-gateway update \
  --name <gw-name> \
  --resource-group <rg> \
  --address-prefixes 172.16.0.0/24 \
  --client-protocol OpenVPN \
  --aad-tenant "https://login.microsoftonline.com/<tenant-id>" \
  --aad-audience "<vpn-app-id>" \
  --aad-issuer "https://sts.windows.net/<tenant-id>/"
```

**Benefits:**
- Users sign in with corporate credentials
- Supports MFA enforcement
- Conditional Access policies apply (device compliance, location, risk)
- No certificate distribution needed

### 3. RADIUS Authentication

Delegates authentication to an existing RADIUS server (NPS, FreeRADIUS, etc.).

**Setup Steps:**

```bash
az network vnet-gateway update \
  --name <gw-name> \
  --resource-group <rg> \
  --address-prefixes 172.16.0.0/24 \
  --client-protocol OpenVPN IkeV2 \
  --radius-server <radius-server-ip> \
  --radius-secret <radius-secret>
```

**Use cases:**
- Integration with existing enterprise identity (AD, LDAP) via RADIUS
- OTP/token-based MFA through RADIUS
- Multiple RADIUS servers for redundancy

### Authentication Selection Guidance

| Requirement | Recommended Auth |
|------------|-----------------|
| Entra ID users, MFA, Conditional Access | Entra ID auth |
| Existing PKI infrastructure | Certificate auth |
| Existing RADIUS/NPS infrastructure | RADIUS auth |
| Non-Windows clients without Entra ID | Certificate auth |
| Maximum security with zero trust | Entra ID auth + Conditional Access |

## Client Address Pool

The P2S address pool provides IP addresses to connecting clients. Choose a range that does not overlap with:
- VNet address space
- On-premises address ranges
- Other connected VNet ranges

Common choices: `172.16.0.0/24`, `192.168.100.0/24`

For large user bases, use a larger pool: `172.16.0.0/16` (supports 65,534 concurrent connections, subject to SKU limits).

## Download VPN Client Configuration

```bash
# Generate VPN client configuration package
az network vnet-gateway vpn-client generate \
  --name <gw-name> \
  --resource-group <rg> \
  --processor-architecture Amd64

# This returns a URL to download a ZIP file containing:
# - OpenVPN profile (*.ovpn)
# - IKEv2 configuration files
# - SSTP configuration (Windows)
```

For Entra ID auth, clients use the **Azure VPN Client** app (available from Microsoft Store or direct download).

## Custom DNS for P2S Clients

To configure custom DNS servers pushed to P2S clients:

```bash
az network vnet-gateway update \
  --name <gw-name> \
  --resource-group <rg> \
  --custom-routes 10.0.0.0/8 \
  --vpn-client-root-certificates <cert-data>
```

For DNS resolution of Azure private endpoints from P2S clients, point DNS to:
- Azure DNS Private Resolver inbound endpoint in the VNet
- Or a custom DNS server in the VNet that forwards to Azure DNS (168.63.129.16)

## P2S Connection Limits by SKU

| SKU | Max P2S Connections |
|-----|---------------------|
| Basic | 128 |
| VpnGw1/1AZ | 250 |
| VpnGw2/2AZ | 500 |
| VpnGw3/3AZ | 1,000 |
| VpnGw4/4AZ | 5,000 |
| VpnGw5/5AZ | 10,000 |

## Troubleshooting P2S

### Client Cannot Connect

1. **Check protocol** — ensure client uses a protocol enabled on the gateway
2. **Certificate issues** — verify client cert is not expired and is signed by a root cert uploaded to Azure
3. **Entra ID issues** — verify tenant ID, audience, and issuer are correct; check admin consent was granted
4. **Firewall blocking** — ensure UDP 500/4500 (IKEv2), TCP 443 (SSTP/OpenVPN), or UDP 1194 (OpenVPN) are open
5. **Client address pool exhausted** — enlarge the pool if near the SKU's concurrent connection limit

### Client Connects but Cannot Reach Resources

1. **Routing** — VNet resources must have routes back to the P2S client address pool (automatic with VPN gateway)
2. **NSG rules** — Azure VMs must allow traffic from the P2S client address pool
3. **DNS resolution** — P2S clients may not resolve Azure private DNS zones unless custom DNS is configured
4. **Split tunneling** — by default, P2S uses forced tunneling. If split tunneling is needed, configure custom routes

### Check Connected P2S Clients

```bash
az network vnet-gateway list-bgp-peer-status \
  --name <gw-name> \
  --resource-group <rg>
```

## Additional References

- [About P2S VPN](https://learn.microsoft.com/azure/vpn-gateway/point-to-site-about)
- [Configure P2S with certificate auth](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-howto-point-to-site-resource-manager-portal)
- [Configure P2S with Entra ID auth](https://learn.microsoft.com/azure/vpn-gateway/point-to-site-entra-gateway)
- [Azure VPN Client](https://learn.microsoft.com/azure/vpn-gateway/point-to-site-entra-vpn-client-windows)
