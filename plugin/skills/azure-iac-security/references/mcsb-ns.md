# MCSB v3.0 — Network Security (NS) — SEED HINTS

> Seed hints only. MCSB is periodically revised. Before emitting a finding, reconcile the
> control ID, name, and Docs URL against live Microsoft Learn via `microsoft_docs_search`
> (query: "MCSB network security NS-<n>"). Cite the reconciled URL in `azure_guidance`.
> URL base: https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-network-security

## NS-1: Establish network segmentation boundaries
- **Check:** VNets have multiple subnets for workload isolation; NSGs associated with subnets; App Gateway in a dedicated subnet.
- **Properties:** `subnets`, `networkSecurityGroup`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-network-security#ns-1-establish-network-segmentation-boundaries

## NS-2: Secure cloud services with network controls
- **Check:** `publicNetworkAccess` = `Disabled`; private endpoints configured; `networkAcls.defaultAction` = `Deny` with explicit allowlist; storage/SQL/Cosmos service firewalls restrict access; no unnecessary public IPs; Storage `allowBlobPublicAccess` = false.
- **Properties:** `publicNetworkAccess`, `privateEndpointConnections`, `networkAcls`, `networkRuleSet`, `ipRules`, `virtualNetworkRules`, `defaultAction`, `allowBlobPublicAccess`, `publicIPAddress`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-network-security#ns-2-secure-cloud-services-with-network-controls

## NS-5: Deploy DDoS protection
- **Check:** `enableDdosProtection` = true on VNets fronting public IPs.
- **Properties:** `enableDdosProtection`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-network-security#ns-5-deploy-ddos-protection

## NS-6: Deploy web application firewall
- **Check:** Application Gateway / Front Door has WAF enabled in `Prevention` mode; WAF policy associated.
- **Properties:** `webApplicationFirewallConfiguration`, `firewallPolicy`, `policySettings.mode`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-network-security#ns-6-deploy-web-application-firewall

## NS-7: Simplify network security configuration  **(Critical when violated)**
- **Check:** No inbound NSG rule with `sourceAddressPrefix` of `0.0.0.0/0`, `*`, or `Internet` on critical management/data ports.
- **Critical ports:** 22 (SSH), 3389 (RDP), 1433 (SQL), 3306 (MySQL), 5432 (PostgreSQL), 27017 (MongoDB)
- **Properties:** `securityRules[].sourceAddressPrefix`, `destinationPortRange`, `direction`, `access`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-network-security#ns-7-simplify-network-security-configuration

## NS-8: Detect and disable insecure services and protocols
- **Check:** No listeners/extensions enabling insecure protocols; TLS not disabled; legacy protocol versions off.
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-network-security#ns-8-detect-and-disable-insecure-services-and-protocols
