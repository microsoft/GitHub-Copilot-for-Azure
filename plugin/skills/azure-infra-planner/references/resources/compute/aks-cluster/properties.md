## Key Properties

| Property | Description | Values |
|----------|-------------|--------|
| `properties.dnsPrefix` | DNS prefix for API server | String (globally unique in region) |
| `properties.kubernetesVersion` | Kubernetes version | String (e.g., `1.30`, `1.31`) |
| `properties.agentPoolProfiles[].name` | Node pool name | Linux: max 12 chars; Windows: max 6 chars. Lowercase alphanumeric only. |
| `properties.agentPoolProfiles[].mode` | Pool mode | `System` (required, at least 1), `User` |
| `properties.agentPoolProfiles[].vmSize` | Node VM size | Azure VM SKU string |
| `properties.agentPoolProfiles[].count` | Node count | Integer |
| `properties.agentPoolProfiles[].enableAutoScaling` | Auto-scale nodes | `true`, `false` |
| `properties.agentPoolProfiles[].minCount` | Min nodes (auto-scale) | Integer |
| `properties.agentPoolProfiles[].maxCount` | Max nodes (auto-scale) | Integer |
| `properties.agentPoolProfiles[].osDiskSizeGB` | OS disk size | Integer (GB) |
| `properties.agentPoolProfiles[].availabilityZones` | Zones | `['1']`, `['2']`, `['3']`, or all |
| `properties.agentPoolProfiles[].vnetSubnetID` | Subnet for nodes | Resource ID |
| `properties.networkProfile.networkPlugin` | Network plugin | `azure` (CNI), `kubenet`, `none` |
| `properties.networkProfile.networkPolicy` | Network policy | `azure`, `calico`, `cilium`, `none` |
| `properties.networkProfile.serviceCidr` | Service CIDR | CIDR string (default `10.0.0.0/16`) |
| `properties.networkProfile.dnsServiceIP` | DNS service IP | Must be within serviceCidr |
| `properties.addonProfiles.azureKeyvaultSecretsProvider.enabled` | Key Vault CSI driver | `true`, `false` |
| `properties.addonProfiles.omsagent.enabled` | Container Insights | `true`, `false` |
