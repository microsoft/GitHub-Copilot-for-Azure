## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | Requires a dedicated subnet — no other resources allowed in the subnet (except other App Gateways). Cannot mix v1 and v2 SKUs on the same subnet — separate subnets required for each. |
| **Public IP** | v2 SKU requires Standard SKU public IP with Static allocation. |
| **NSG** | NSG on App Gateway subnet must allow `GatewayManager` service tag on ports `65200–65535` (v2) or `65503–65534` (v1). |
| **WAF** | WAF configuration only available with `WAF_v2` or `WAF_Large`/`WAF_Medium` SKUs. WAF v2 cannot disable request buffering — chunked file transfer requires path-rule workaround. |
| **Zones** | v2 supports availability zones. Specify `zones: ['1','2','3']` for zone-redundant deployment. |
| **Key Vault** | For SSL certificates, use `sslCertificates[].properties.keyVaultSecretId` to reference Key Vault certificates. User-assigned managed identity required. |
| **v1 Limitations** | v1 does not support: autoscaling, zone redundancy, Key Vault integration, mTLS, Private Link, WAF custom rules, or header rewrite. Must use v2 for these features. v1 SKUs are being retired April 2026. |
| **Private-only (no public IP)** | Requires `EnableApplicationGatewayNetworkIsolation` feature registration. Only available with `Standard_v2` or `WAF_v2`. |
| **Global VNet Peering** | Backend via private endpoint across global VNet peering causes traffic to be dropped — results in unhealthy backend status. |
| **kubenet (AKS)** | Kubenet is not supported by Application Gateway for Containers. Must use CNI or CNI Overlay. |
