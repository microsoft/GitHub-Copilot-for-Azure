## SKU Names

| SKU Name | Gateway Type | Max S2S Tunnels | Max P2S Connections | Throughput |
|----------|--------------|-----------------|---------------------|------------|
| `Basic` | Vpn | 10 | 128 | 100 Mbps |
| `VpnGw1` | Vpn | 30 | 250 | 650 Mbps |
| `VpnGw1AZ` | Vpn | 30 | 250 | 650 Mbps (zone-redundant) |
| `VpnGw2` | Vpn | 30 | 500 | 1 Gbps |
| `VpnGw2AZ` | Vpn | 30 | 500 | 1 Gbps (zone-redundant) |
| `VpnGw3` | Vpn | 30 | 1000 | 1.25 Gbps |
| `VpnGw3AZ` | Vpn | 30 | 1000 | 1.25 Gbps (zone-redundant) |
| `VpnGw4` | Vpn | 100 | 5000 | 5 Gbps |
| `VpnGw4AZ` | Vpn | 100 | 5000 | 5 Gbps (zone-redundant) |
| `VpnGw5` | Vpn | 100 | 10000 | 10 Gbps |
| `VpnGw5AZ` | Vpn | 100 | 10000 | 10 Gbps (zone-redundant) |
| `ErGw1AZ` | ExpressRoute | N/A | N/A | 1 Gbps |
| `ErGw2AZ` | ExpressRoute | N/A | N/A | 2 Gbps |
| `ErGw3AZ` | ExpressRoute | N/A | N/A | 10 Gbps |
| `ErGwScale` | ExpressRoute | N/A | N/A | Scalable |
| `Standard` | ExpressRoute | N/A | N/A | 1 Gbps (legacy) |
| `HighPerformance` | ExpressRoute | N/A | N/A | 2 Gbps (legacy) |
| `UltraPerformance` | ExpressRoute | N/A | N/A | 10 Gbps (legacy) |

> **Note:** `sku.tier` must match `sku.name` (same values).
