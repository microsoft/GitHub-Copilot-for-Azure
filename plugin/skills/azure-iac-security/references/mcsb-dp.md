# MCSB v3.0 — Data Protection (DP) — SEED HINTS

> Seed hints only. Reconcile control ID/name/URL against live Microsoft Learn via
> `microsoft_docs_search` (query: "MCSB data protection DP-<n>") before emitting. Cite the
> reconciled URL in `azure_guidance`.
> URL base: https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-data-protection

## DP-2: Monitor anomalies and threats targeting sensitive data
- **Check:** Microsoft Defender enabled for data services (Storage/SQL/Cosmos DB) — `advancedThreatProtectionSettings.isEnabled` = true; SQL `securityAlertPolicies.state` = `Enabled`.
- **Properties:** `advancedThreatProtectionSettings`, `securityAlertPolicies`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-data-protection#dp-2-monitor-anomalies-and-threats-targeting-sensitive-data

## DP-3: Encrypt sensitive data in transit
- **Check:** `minimumTlsVersion` >= `TLS1_2`; Storage `supportsHttpsTrafficOnly` = true; App Service `httpsOnly` = true; SQL `minimalTlsVersion` = `1.2`; Redis `enableNonSslPort` = false.
- **Properties:** `minimumTlsVersion`, `minimalTlsVersion`, `supportsHttpsTrafficOnly`, `httpsOnly`, `enableNonSslPort`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-data-protection#dp-3-encrypt-sensitive-data-in-transit

## DP-4: Enable data at rest encryption by default
- **Check:** SQL `transparentDataEncryption.state` = `Enabled`; VM disks use Azure Disk Encryption / `encryptionSettings`; Storage `encryption.services` enabled for blob/file/table/queue.
- **Properties:** `transparentDataEncryption`, `encryption.services`, `encryptionSettings`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-data-protection#dp-4-enable-data-at-rest-encryption-by-default

## DP-5: Use customer-managed key (CMK) in data at rest encryption when required
- **Check:** For sensitive workloads, `encryption.keySource` = `Microsoft.Keyvault` (CMK) rather than platform-managed; SQL TDE `serverKeyType` = `AzureKeyVault`.
- **Properties:** `encryption.keySource`, `keyVaultProperties`, `serverKeyType`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-data-protection#dp-5-use-customer-managed-key-option-in-data-at-rest-encryption-when-required

## DP-6: Use a secure key management process
- **Check:** Keys stored in Key Vault (not inline); rotation configured; managed HSM for high assurance.
- **Properties:** `keyVaultProperties`, `rotationPolicy`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-data-protection#dp-6-use-a-secure-key-management-process

## DP-7: Use a secure certificate management process
- **Check:** TLS certificates sourced from Key Vault (not embedded); App Service / App Gateway reference `keyVaultSecretId`; auto-renewal enabled.
- **Properties:** `keyVaultSecretId`, `sslCertificates`, `certificates`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-data-protection#dp-7-use-a-secure-certificate-management-process

## DP-8: Ensure security of key and certificate repository (Key Vault)
- **Check:** Key Vault `enableSoftDelete` = true, `softDeleteRetentionInDays` >= 7, and `enablePurgeProtection` = true.
- **Properties:** `enableSoftDelete`, `softDeleteRetentionInDays`, `enablePurgeProtection`
- **Docs:** https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-data-protection#dp-8-ensure-security-of-key-and-certificate-repository
