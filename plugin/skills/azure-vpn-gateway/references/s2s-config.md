# Site-to-Site VPN Configuration

## S2S VPN Setup Checklist

Use this checklist for every site-to-site VPN deployment. Complete each step in order.

### Prerequisites

- [ ] Azure VNet created with a non-overlapping address space relative to on-premises
- [ ] GatewaySubnet created (/27 or larger recommended)
- [ ] Public IP address allocated for the VPN gateway
- [ ] On-premises VPN device public IP address known and reachable
- [ ] On-premises network address prefixes documented
- [ ] Shared key (PSK) agreed upon and securely stored
- [ ] On-premises VPN device validated against [Azure compatibility list](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-about-vpn-devices)

### Step 1: Create the VPN Gateway

```bash
# Create public IP for gateway
az network public-ip create \
  --name <pip-name> \
  --resource-group <rg> \
  --allocation-method Static \
  --sku Standard \
  --zone 1 2 3

# Create VPN gateway (takes 30-45 minutes)
az network vnet-gateway create \
  --name <gw-name> \
  --resource-group <rg> \
  --vnet <vnet-name> \
  --gateway-type Vpn \
  --vpn-type RouteBased \
  --sku VpnGw2AZ \
  --generation Generation2 \
  --public-ip-addresses <pip-name> \
  --no-wait

# Check provisioning status
az network vnet-gateway show \
  --name <gw-name> \
  --resource-group <rg> \
  --query provisioningState
```

### Step 2: Create the Local Network Gateway

The local network gateway represents your on-premises VPN device in Azure.

```bash
az network local-gateway create \
  --name <lgw-name> \
  --resource-group <rg> \
  --gateway-ip-address <on-prem-public-ip> \
  --local-address-prefixes 10.1.0.0/16 10.2.0.0/16
```

For BGP-enabled connections, add BGP settings:

```bash
az network local-gateway create \
  --name <lgw-name> \
  --resource-group <rg> \
  --gateway-ip-address <on-prem-public-ip> \
  --local-address-prefixes 10.1.0.0/16 \
  --bgp-peering-address <on-prem-bgp-ip> \
  --asn <on-prem-asn>
```

### Step 3: Create the VPN Connection

```bash
az network vpn-connection create \
  --name <conn-name> \
  --resource-group <rg> \
  --vnet-gateway1 <gw-name> \
  --local-gateway2 <lgw-name> \
  --shared-key <psk> \
  --connection-protocol IKEv2
```

### Step 4: Configure the On-Premises Device

Configure the on-premises VPN device with:
- Azure gateway public IP (obtained from `az network public-ip show`)
- Shared key (same PSK as step 3)
- IKE/IPsec parameters matching Azure defaults (or custom policy)
- Traffic selectors for Azure VNet address space

### Step 5: Verify Connectivity

```bash
# Check connection status (should show "Connected")
az network vpn-connection show \
  --name <conn-name> \
  --resource-group <rg> \
  --query connectionStatus

# Check data transfer
az network vpn-connection show \
  --name <conn-name> \
  --resource-group <rg> \
  --query "{status:connectionStatus, inBytes:ingressBytesTransferred, outBytes:egressBytesTransferred}"
```

## Optional: Enable BGP

BGP provides dynamic route exchange, eliminating the need to maintain static routes when address spaces change.

```bash
# Enable BGP on the VPN gateway (at creation time)
az network vnet-gateway create \
  --name <gw-name> \
  --resource-group <rg> \
  --vnet <vnet-name> \
  --gateway-type Vpn \
  --vpn-type RouteBased \
  --sku VpnGw2AZ \
  --public-ip-addresses <pip-name> \
  --asn 65515

# Enable BGP on the connection
az network vpn-connection update \
  --name <conn-name> \
  --resource-group <rg> \
  --enable-bgp true

# Verify BGP peers
az network vnet-gateway list-bgp-peer-status \
  --name <gw-name> \
  --resource-group <rg>

# View learned BGP routes
az network vnet-gateway list-learned-routes \
  --name <gw-name> \
  --resource-group <rg>

# View advertised BGP routes to a peer
az network vnet-gateway list-advertised-routes \
  --name <gw-name> \
  --resource-group <rg> \
  --peer <peer-ip>
```

### BGP Configuration Notes

- Azure VPN Gateway default ASN: **65515**
- The BGP peer IP on the Azure side is automatically assigned from the GatewaySubnet range
- On-premises ASN must be different from Azure ASN (do not use 65515)
- Reserved ASNs to avoid: 0, 23456, 64496-64511, 65535, 4294967295
- Azure reserved: 65515 (default), 65520 (multi-site)

## Multi-Site S2S VPN

A single route-based VPN gateway can connect to multiple on-premises sites.

```bash
# Site 1
az network local-gateway create --name site1-lgw --resource-group <rg> \
  --gateway-ip-address <site1-ip> --local-address-prefixes 10.1.0.0/16
az network vpn-connection create --name site1-conn --resource-group <rg> \
  --vnet-gateway1 <gw-name> --local-gateway2 site1-lgw --shared-key <psk1>

# Site 2
az network local-gateway create --name site2-lgw --resource-group <rg> \
  --gateway-ip-address <site2-ip> --local-address-prefixes 10.2.0.0/16
az network vpn-connection create --name site2-conn --resource-group <rg> \
  --vnet-gateway1 <gw-name> --local-gateway2 site2-lgw --shared-key <psk2>
```

Each site counts toward the S2S tunnel limit for the gateway SKU.

## NAT Rules for Overlapping Address Spaces

When on-premises networks have overlapping IP ranges, use VPN Gateway NAT rules:

```bash
# Create ingress SNAT rule (translate on-prem source to new range)
az network vnet-gateway nat-rule add \
  --name <rule-name> \
  --resource-group <rg> \
  --gateway-name <gw-name> \
  --internal-mappings 10.1.0.0/24 \
  --external-mappings 172.16.1.0/24 \
  --type Static \
  --mode IngressSnat

# Associate NAT rule with a connection
az network vpn-connection update \
  --name <conn-name> \
  --resource-group <rg> \
  --ingress-nat-rule <nat-rule-resource-id>
```

## Troubleshooting S2S Connectivity

### Connection Shows "Connecting" (Not Connected)

1. **Verify on-prem device config** — public IP, PSK, and IKE parameters must match
2. **Check IKE version** — ensure both sides use IKEv2
3. **Verify firewall rules** — allow UDP 500 (IKE), UDP 4500 (NAT-T), and ESP (protocol 50) to the on-prem public IP
4. **Check for NAT** — if the on-prem device is behind NAT, ensure NAT-T is enabled
5. **Reset the gateway** — `az network vnet-gateway reset --name <gw-name> --resource-group <rg>`

### Connection Shows "Connected" but No Traffic

1. **Check routing** — verify local network gateway prefixes include all on-prem ranges
2. **Check NSGs** — NSG rules on Azure VMs must allow traffic from on-prem source IPs
3. **Check on-prem routing** — on-prem router must have routes pointing to the VPN tunnel for Azure address space
4. **Check UDRs** — user-defined routes must not black-hole VPN traffic
5. **Ping test** — test with ICMP (ensure ICMP is allowed by both NSGs and on-prem firewall)

### Intermittent Connectivity

1. **DPD timers** — mismatched Dead Peer Detection settings cause tunnel flapping
2. **SA lifetime mismatch** — both sides should agree on IKE and IPsec SA lifetimes
3. **MTU issues** — VPN overhead reduces effective MTU to ~1400 bytes; enable PMTUD or clamp MSS
4. **ISP stability** — check internet connectivity stability independent of the VPN

### Diagnostic Tools

```bash
# Network Watcher VPN diagnostics
az network watcher troubleshooting start \
  --resource <gw-resource-id> \
  --resource-type vpnGateway \
  --storage-account <storage-acct> \
  --storage-path <blob-container-sas-uri>

# Check gateway health
az network vnet-gateway show \
  --name <gw-name> \
  --resource-group <rg> \
  --query "{state:provisioningState, bgp:enableBgp, activeActive:activeActive}"
```

## Additional References

- [Create S2S VPN connection](https://learn.microsoft.com/azure/vpn-gateway/tutorial-site-to-site-portal)
- [Validated VPN devices](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-about-vpn-devices)
- [Troubleshoot S2S VPN](https://learn.microsoft.com/azure/vpn-gateway/vpn-gateway-troubleshoot-site-to-site-cannot-connect)
