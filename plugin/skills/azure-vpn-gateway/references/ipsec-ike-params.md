# IPsec/IKE Parameters

## Overview

Azure VPN Gateway supports both default IPsec/IKE parameters and custom policies. Understanding these parameters is essential for interoperability with third-party VPN devices and compliance requirements.

## Default IPsec/IKE Parameters

When no custom policy is specified, Azure VPN Gateway negotiates using a set of default proposals. The gateway tries the proposals in order and selects the first match with the peer device.

### IKE Phase 1 (Main Mode) Defaults

| Parameter | Default Values |
|-----------|---------------|
| IKE Version | IKEv2 (IKEv1 for policy-based only) |
| Encryption | AES-256, AES-192, AES-128 |
| Integrity/PRF | SHA-384, SHA-256, SHA-1 |
| DH Group | DHGroup24, ECP384, ECP256, DHGroup14, DHGroup2 |
| SA Lifetime | 28,800 seconds (8 hours) |

### IKE Phase 2 (Quick Mode / IPsec) Defaults

| Parameter | Default Values |
|-----------|---------------|
| Encryption | AES-256-GCM, AES-128-GCM, AES-256-CBC, AES-192-CBC, AES-128-CBC |
| Integrity | SHA-256, SHA-1 (not used with GCM) |
| PFS Group | PFS24, ECP384, ECP256, PFS2, PFS1, None |
| SA Lifetime | 27,000 seconds (7.5 hours) |
| SA Size | 102,400,000 KB |

## Custom IPsec/IKE Policy

Custom policies let you specify exact algorithms for compliance or interoperability. When you set a custom policy, the gateway offers **only** the algorithms you specify.

### Supported Algorithms

#### IKE Phase 1 Encryption
- AES-256, AES-192, AES-128, DES3 (legacy, avoid)

#### IKE Phase 1 Integrity
- SHA-384, SHA-256, SHA-1, MD5 (legacy, avoid)

#### IKE Phase 1 DH Groups
- DHGroup24 (2048-bit MODP), DHGroup14 (2048-bit MODP), DHGroup2 (1024-bit, legacy)
- ECP384 (384-bit elliptic curve), ECP256 (256-bit elliptic curve)
- DHGroup2048, DHGroup1 (avoid)

#### IPsec Phase 2 Encryption
- AES-256-GCM (recommended), AES-128-GCM (recommended)
- AES-256-CBC, AES-192-CBC, AES-128-CBC
- DES3 (legacy, avoid), DES (legacy, avoid), None (null encryption)

#### IPsec Phase 2 Integrity
- SHA-256 (recommended), SHA-1
- GCMAES-256, GCMAES-128 (used when GCM encryption is selected)
- MD5 (legacy, avoid)

#### PFS Groups
- PFS24, ECP384, ECP256, PFS2048, PFS2, PFS1, None

### Recommended Secure Configuration

For new deployments, use this configuration as a baseline:

```
IKE Phase 1:  AES-256 + SHA-256 + DHGroup14 (or ECP256)
IPsec Phase 2: AES-256-GCM + GCMAES-256 + PFS2048 (or ECP256)
SA Lifetime:   28800 seconds (Phase 1), 27000 seconds (Phase 2)
```

### CLI: Create Connection with Custom IPsec/IKE Policy

```bash
# Create S2S connection with custom IPsec/IKE policy
az network vpn-connection create \
  --name <conn-name> \
  --resource-group <rg> \
  --vnet-gateway1 <gw-name> \
  --local-gateway2 <lgw-name> \
  --shared-key <psk>

# Apply custom IPsec/IKE policy to existing connection
az network vpn-connection ipsec-policy add \
  --connection-name <conn-name> \
  --resource-group <rg> \
  --ike-encryption AES256 \
  --ike-integrity SHA256 \
  --dh-group DHGroup14 \
  --ipsec-encryption GCMAES256 \
  --ipsec-integrity GCMAES256 \
  --pfs-group ECP256 \
  --sa-lifetime 27000 \
  --sa-max-size 102400000

# List IPsec policies on a connection
az network vpn-connection ipsec-policy list \
  --connection-name <conn-name> \
  --resource-group <rg>

# Clear all custom policies (revert to defaults)
az network vpn-connection ipsec-policy clear \
  --connection-name <conn-name> \
  --resource-group <rg>
```

## UsePolicyBasedTrafficSelectors

For connecting to policy-based on-prem devices from a route-based gateway, enable this flag:

```bash
az network vpn-connection update \
  --name <conn-name> \
  --resource-group <rg> \
  --use-policy-based-traffic-selectors true
```

This creates policy-based traffic selectors for each on-prem prefix combination while keeping the route-based gateway. Useful for connecting to legacy Cisco ASA, older Palo Alto, or other policy-based devices.

## DPD (Dead Peer Detection)

- Azure VPN Gateway sends DPD keepalives every **45 seconds** by default
- If no response after **several retries**, the tunnel is marked as disconnected
- On-prem devices should be configured with compatible DPD timers
- Very aggressive DPD timers (<10s) may cause flapping on high-latency links

## Connection Mode Settings

Azure VPN Gateway supports:
- **Default** — gateway can be either initiator or responder
- **InitiatorOnly** — gateway always initiates the IKE connection
- **ResponderOnly** — gateway never initiates, only responds

```bash
az network vpn-connection update \
  --name <conn-name> \
  --resource-group <rg> \
  --connection-mode InitiatorOnly
```

## Troubleshooting IKE/IPsec Failures

### Common Issues

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| Tunnel stays Connecting | IKE Phase 1 mismatch | Verify encryption, integrity, and DH group match on both sides |
| Tunnel connects then drops | Phase 2 rekey failure | Check IPsec SA lifetime and PFS settings match |
| Tunnel up but no traffic | Traffic selectors wrong | Verify local/remote address prefixes on both sides |
| Intermittent disconnects | DPD timeout mismatch | Align DPD timers; check internet stability |
| Slow throughput | Small packets or CBC mode | Use GCM algorithms; test with larger packets |

### Diagnostic Commands

```bash
# Check connection status
az network vpn-connection show \
  --name <conn-name> \
  --resource-group <rg> \
  --query "{status:connectionStatus, inBytes:ingressBytesTransferred, outBytes:egressBytesTransferred}"

# Use Network Watcher VPN troubleshoot
az network watcher troubleshooting start \
  --resource <gw-resource-id> \
  --resource-type vpnGateway \
  --storage-account <sa-name> \
  --storage-path <container-uri>
```

## Additional References

- [About IPsec/IKE policy](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-ipsecikepolicy-rm-powershell)
- [Cryptographic requirements](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-about-compliance-crypto)
- [VPN device configuration samples](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-about-vpn-devices#devicetable)
