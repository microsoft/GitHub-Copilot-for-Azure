# ExpressRoute Circuit Provisioning

## Circuit Creation Workflow

ExpressRoute circuit provisioning involves coordination between Azure and a connectivity provider (unless using ExpressRoute Direct).

### Provider-Based Circuit Flow

```
1. Create circuit in Azure        → CircuitProvisioningState: Succeeded
                                    ServiceProviderProvisioningState: NotProvisioned
2. Send service key to provider   → Provider begins layer 2 setup
3. Provider provisions circuit    → ServiceProviderProvisioningState: Provisioning
4. Provider completes setup       → ServiceProviderProvisioningState: Provisioned
5. Configure peering in Azure     → Peering active, BGP sessions established
6. Connect gateway to circuit     → VNet connectivity live
```

### Create a Circuit

```bash
# Create ExpressRoute circuit via provider
az network express-route create \
  --name <circuit-name> \
  --resource-group <rg> \
  --provider <provider-name> \
  --peering-location <location> \
  --bandwidth 1000 \
  --sku-tier Standard \
  --sku-family MeteredData

# Get the service key (send this to your provider)
az network express-route show \
  --name <circuit-name> \
  --resource-group <rg> \
  --query serviceKey
```

### Check Provisioning Status

```bash
az network express-route show \
  --name <circuit-name> \
  --resource-group <rg> \
  --query "{circuitState:circuitProvisioningState, providerState:serviceProviderProvisioningState}"
```

**Expected progression:**
| Phase | circuitProvisioningState | serviceProviderProvisioningState |
|-------|--------------------------|----------------------------------|
| After Azure creation | Succeeded (or Enabled) | NotProvisioned |
| Provider working | Succeeded | Provisioning |
| Provider done | Succeeded | Provisioned |
| Peering configured | Succeeded | Provisioned |

## Bandwidth Options

| Bandwidth | Use Case |
|-----------|----------|
| 50 Mbps | Dev/test, small branch |
| 100 Mbps | Small production workloads |
| 200 Mbps | Medium workloads |
| 500 Mbps | Data transfer, backup traffic |
| 1 Gbps | Standard production |
| 2 Gbps | Heavy production workloads |
| 5 Gbps | Large enterprise |
| 10 Gbps | High-throughput, data-heavy apps |
| 100 Gbps | ExpressRoute Direct only |

**Bandwidth upgrades** can be done in-place without downtime (provider must support the new bandwidth):

```bash
az network express-route update \
  --name <circuit-name> \
  --resource-group <rg> \
  --bandwidth 2000
```

**Bandwidth downgrades** require circuit recreation — you cannot decrease bandwidth on an existing circuit.

## SKU Tiers

### Local SKU

- Available only when the peering location is in the **same metro** as the target Azure region
- **Unlimited egress at no data transfer cost** (only the circuit fee applies)
- Can only connect to VNets in the local Azure region (same metro)
- Cannot enable Premium add-on
- Best for: workloads entirely within one Azure region co-located with your peering point

```bash
az network express-route create \
  --name <circuit-name> \
  --resource-group <rg> \
  --provider <provider-name> \
  --peering-location "Silicon Valley" \
  --bandwidth 1000 \
  --sku-tier Local \
  --sku-family UnlimitedData
```

### Standard SKU

- Connects to VNets **within the same geopolitical region**
- Supports up to **4,000 route prefixes** on private peering
- Supports up to **10 VNet connections** (or 200 with Standard circuit linking)
- Metered or unlimited data plans available
- Best for: production workloads within a single geopolitical boundary

### Premium SKU

- Connects to VNets in **any Azure region globally**
- Supports up to **10,000 route prefixes** on private peering
- Supports up to **100 VNet connections** per circuit
- Required for cross-geo connectivity (e.g., North America peering location → Europe VNet)
- Required for Microsoft 365 connectivity
- Additional monthly cost on top of Standard
- Best for: global enterprises, multi-region deployments, M365 access

```bash
# Enable Premium add-on on existing circuit
az network express-route update \
  --name <circuit-name> \
  --resource-group <rg> \
  --sku-tier Premium
```

## Metering Plans

| Plan | Billing Model |
|------|---------------|
| **MeteredData** | Circuit fee + per-GB egress charge. Ingress is free. Best when egress traffic is predictable or moderate. |
| **UnlimitedData** | Flat circuit fee with unlimited egress. Best when egress traffic is high or unpredictable. |

Switch between plans without downtime:

```bash
az network express-route update \
  --name <circuit-name> \
  --resource-group <rg> \
  --sku-family UnlimitedData
```

## ExpressRoute Direct

ExpressRoute Direct provides **dedicated physical port pairs** at a peering location, bypassing the provider entirely.

### Key Characteristics

- Available in **10 Gbps** and **100 Gbps** port speeds
- You own the physical port pair and can create multiple circuits on it
- Supports **MACsec** encryption on the port layer (point-to-point encryption)
- Circuit bandwidth on Direct can use any value from 1 Gbps to the port speed
- Supports both Standard and Premium SKUs
- No provider needed — you manage layer 2 directly

### Create ExpressRoute Direct

```bash
# Create the Direct port resource
az network express-route port create \
  --name <port-name> \
  --resource-group <rg> \
  --peering-location <location> \
  --bandwidth 100 \
  --encapsulation Dot1Q

# Create a circuit on the Direct port
az network express-route create \
  --name <circuit-name> \
  --resource-group <rg> \
  --express-route-port <port-resource-id> \
  --bandwidth 10 \
  --sku-tier Premium \
  --sku-family UnlimitedData
```

### MACsec Encryption (ExpressRoute Direct Only)

MACsec encrypts traffic at layer 2 between your edge router and the Microsoft edge router.

```bash
# Enable MACsec on a Direct port
az network express-route port update \
  --name <port-name> \
  --resource-group <rg> \
  --macsec-ckn-secret-identifier <key-vault-ckn-uri> \
  --macsec-cak-secret-identifier <key-vault-cak-uri> \
  --macsec-cipher GcmAes256
```

## ExpressRoute Gateway

A VNet still requires an ExpressRoute gateway to connect to a circuit.

### Gateway SKUs

| Gateway SKU | Max Throughput | Max Circuits | Max VNet Connections | FastPath |
|-------------|---------------|-------------|---------------------|----------|
| ErGw1Az | 1 Gbps | 4 | Up to 1,900 routes | No |
| ErGw2Az | 2 Gbps | 8 | Up to 1,900 routes | No |
| ErGw3Az | 10 Gbps | 16 | Up to 1,900 routes | Yes |
| Ultra Performance | 10 Gbps | 16 | Up to 1,900 routes | Yes |
| ErGwScale | Up to 40 Gbps | 16 | Up to 1,900 routes | Yes (2+ units) |

```bash
# Create zone-redundant ExpressRoute gateway
az network vnet-gateway create \
  --name <ergw-name> \
  --resource-group <rg> \
  --vnet <vnet-name> \
  --gateway-type ExpressRoute \
  --sku ErGw2Az \
  --public-ip-addresses <pip-name>
```

### Connect Circuit to Gateway

```bash
# Get circuit resource ID
CIRCUIT_ID=$(az network express-route show \
  --name <circuit-name> \
  --resource-group <circuit-rg> \
  --query id -o tsv)

# Create the connection
az network vpn-connection create \
  --name <conn-name> \
  --resource-group <gw-rg> \
  --vnet-gateway1 <ergw-name> \
  --express-route-circuit2 $CIRCUIT_ID
```

## Deprovisioning Order

Always follow this order to avoid orphaned resources:

1. **Remove all VNet gateway connections** to the circuit
2. **Delete peering configurations** on the circuit
3. **Request provider to deprovision** the circuit
4. **Wait for provider state to become NotProvisioned**
5. **Delete the circuit resource** in Azure

```bash
# Step 1: Delete VNet connection
az network vpn-connection delete --name <conn-name> --resource-group <rg>

# Step 2: Delete peerings
az network express-route peering delete \
  --circuit-name <circuit-name> \
  --resource-group <rg> \
  --name AzurePrivatePeering

# Steps 3-4: Contact provider, wait for NotProvisioned

# Step 5: Delete circuit
az network express-route delete --name <circuit-name> --resource-group <rg>
```

## Additional References

- [Create ExpressRoute circuit](https://learn.microsoft.com/azure/expressroute/expressroute-howto-circuit-arm)
- [ExpressRoute locations and providers](https://learn.microsoft.com/azure/expressroute/expressroute-locations)
- [ExpressRoute Direct](https://learn.microsoft.com/azure/expressroute/expressroute-erdirect-about)
- [ExpressRoute pricing](https://azure.microsoft.com/pricing/details/expressroute/)
