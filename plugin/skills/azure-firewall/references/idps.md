# Azure Firewall IDPS and TLS Inspection

IDPS (Intrusion Detection and Prevention System) and TLS inspection are Premium-only features that provide deep packet inspection and encrypted traffic analysis. Together, they enable Azure Firewall to detect and block sophisticated threats hiding in encrypted traffic.

## IDPS Overview

IDPS uses signature-based detection to identify known threats in network traffic. It inspects packet payloads — not just headers — to find malware, exploits, command-and-control traffic, and other malicious activity.

### Modes

| Mode | Behavior |
|------|----------|
| **Off** | IDPS disabled |
| **Alert** | Generates alerts for matched signatures; does not block traffic |
| **Alert and Deny** | Generates alerts AND blocks traffic matching signatures |

### Key characteristics
- Over 67,000 rules across 50+ categories (malware, exploits, phishing, crypto mining, etc.)
- Signatures are updated automatically by Microsoft (multiple times per day)
- Covers all ports and protocols (not just HTTP/HTTPS)
- Inspects east-west and north-south traffic
- Without TLS inspection, IDPS can only inspect unencrypted traffic and TLS handshake metadata (SNI, certificate info)

### Configure IDPS via CLI

```bash
# Enable IDPS in Alert+Deny mode
az network firewall policy update \
  --name <policy-name> \
  --resource-group <rg-name> \
  --idps-mode Alert

# To set Alert and Deny mode, use ARM/Bicep or portal
# CLI currently supports Alert and Off; use this ARM property:
# "intrusionDetection": { "mode": "Deny" }
```

### IDPS Signature Management

You can customize IDPS behavior per signature:

```bash
# Override a specific signature to Alert only (even if mode is Deny)
az network firewall policy intrusion-detection add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --mode Alert \
  --signature-id 2024897
```

**Bypass list**: Exclude specific traffic from IDPS inspection:

```bash
# Bypass IDPS for traffic from a specific source to destination
az network firewall policy intrusion-detection add \
  --policy-name <policy-name> \
  --resource-group <rg-name> \
  --mode Off \
  --source-addresses "10.0.1.0/24" \
  --destination-addresses "10.0.2.0/24" \
  --destination-ports "443" \
  --protocol TCP
```

### Signature categories

| Category | Examples |
|----------|----------|
| Malware | Trojan, ransomware, worm signatures |
| Exploit | Known CVE exploits, buffer overflows |
| Command and Control | C2 beacons, DNS tunneling, IRC-based C2 |
| Phishing | Known phishing domains and patterns |
| Crypto Mining | Mining pool connections, Stratum protocol |
| DoS | Application-layer DoS patterns |
| Scan | Port scanning, vulnerability scanning |
| Policy | Tor exit nodes, anonymizer traffic |

## TLS Inspection

TLS inspection (also called SSL inspection or SSL decryption) allows Azure Firewall to decrypt outbound and east-west HTTPS traffic, inspect the plaintext content with IDPS and application rules, and re-encrypt it before forwarding.

### Why TLS inspection matters
- Over 90% of web traffic is encrypted — without TLS inspection, IDPS and application rules can only see:
  - TLS handshake metadata (SNI hostname, certificate details)
  - IP addresses and ports
- With TLS inspection, the firewall can:
  - Apply IDPS signatures to decrypted payloads
  - Perform URL-level filtering (e.g., block `example.com/malware` while allowing `example.com`)
  - Inspect web categories at the URL level
  - Detect malware in HTTPS downloads

### How it works

```
Client                 Azure Firewall                Target Server
  │                         │                              │
  │──TLS handshake─────────→│                              │
  │  (FW presents its cert) │──TLS handshake──────────────→│
  │←─────────TLS established│←──────────TLS established────│
  │                         │                              │
  │──Encrypted request─────→│ Decrypt → Inspect → Re-encrypt│
  │                         │──Encrypted request──────────→│
  │←─Encrypted response─────│ Decrypt ← Inspect ← Re-encrypt│
  │                         │←──Encrypted response─────────│
```

Azure Firewall acts as a TLS termination proxy:
1. The client connects to the firewall thinking it is the destination
2. The firewall presents its own CA-signed certificate to the client
3. The firewall opens a separate TLS connection to the actual destination
4. Traffic is decrypted, inspected, and re-encrypted in both directions

### Certificate Requirements

TLS inspection requires an **intermediate CA certificate** stored in Azure Key Vault:

| Requirement | Detail |
|-------------|--------|
| Certificate type | Intermediate CA (not self-signed root, not leaf) |
| Key type | RSA 4096-bit recommended |
| Storage | Azure Key Vault with firewall managed identity access |
| Validity | Should have a long validity period (certificates are used to sign session certs) |
| Trust chain | The root CA that signed the intermediate cert must be trusted by all clients |

### Setup steps

#### Step 1: Create or obtain an intermediate CA certificate

For testing, you can generate a self-signed root and intermediate:
```bash
# (Use OpenSSL or your organization's PKI to create an intermediate CA)
# The intermediate CA cert and private key must be uploaded to Key Vault as a PFX
```

For production, use your organization's internal PKI to issue an intermediate CA certificate.

#### Step 2: Upload to Azure Key Vault

```bash
# Create Key Vault (if not existing)
az keyvault create \
  --name <kv-name> \
  --resource-group <rg-name> \
  --location <region>

# Import the intermediate CA certificate (PFX format)
az keyvault certificate import \
  --vault-name <kv-name> \
  --name "fw-intermediate-ca" \
  --file <path-to-pfx> \
  --password <pfx-password>
```

#### Step 3: Configure firewall managed identity and Key Vault access

```bash
# Create a user-assigned managed identity
az identity create \
  --name <identity-name> \
  --resource-group <rg-name>

# Grant the identity access to Key Vault secrets and certificates
az keyvault set-policy \
  --name <kv-name> \
  --object-id <identity-principal-id> \
  --secret-permissions get list \
  --certificate-permissions get list

# Associate managed identity with the firewall policy
az network firewall policy update \
  --name <policy-name> \
  --resource-group <rg-name> \
  --identity-type UserAssigned \
  --user-assigned-identity <identity-resource-id>
```

#### Step 4: Enable TLS inspection on the firewall policy

```bash
# Configure TLS inspection with the Key Vault certificate
az network firewall policy update \
  --name <policy-name> \
  --resource-group <rg-name> \
  --key-vault-secret-id <key-vault-certificate-secret-id>
```

#### Step 5: Enable TLS inspection on application rules

TLS inspection is not enabled globally — it must be enabled per application rule collection:

In the rule collection, set `terminateTLS: true` for the application rule collection that should inspect encrypted traffic.

### Client trust

For TLS inspection to work without certificate errors:
- The root CA that signed the intermediate certificate must be in the client's trusted root certificate store
- For domain-joined machines, use Group Policy to distribute the root CA
- For non-domain machines, manually install the root CA or use MDM
- For Linux/macOS, add the root CA to the system trust store

## Premium Feature Summary

| Feature | Description | Requires TLS Inspection |
|---------|-------------|------------------------|
| IDPS (unencrypted) | Inspect cleartext traffic for known threats | No |
| IDPS (encrypted) | Inspect decrypted HTTPS traffic for threats | Yes |
| URL filtering | Filter by full URL path, not just FQDN | Yes |
| Web categories | Categorize and filter traffic by content type | Partial (SNI-based without TLS, URL-based with TLS) |
| Explicit proxy | Firewall acts as an explicit HTTP/HTTPS proxy | No |

## Performance Considerations

- TLS inspection adds latency (decrypt + re-encrypt per connection)
- IDPS reduces effective throughput — Premium can handle up to 100 Gbps without TLS inspection; with TLS inspection enabled, expect lower throughput
- Signature evaluation is parallelized but CPU-intensive for high-connection-rate workloads
- Use bypass rules to exclude trusted, high-volume traffic from IDPS/TLS (e.g., trusted Azure service endpoints)

## Common Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| Certificate errors on clients | Root CA not trusted | Distribute the root CA to client trust stores |
| TLS inspection not decrypting | Rule collection not configured for TLS termination | Set `terminateTLS: true` on application rule collection |
| IDPS not detecting encrypted threats | TLS inspection not enabled | Enable TLS inspection for application rules |
| Key Vault access denied | Managed identity missing permissions | Verify identity has get/list on secrets and certificates |
| Performance degradation | TLS inspection overhead | Bypass IDPS/TLS for trusted high-volume services |
| IDPS false positive | Signature triggered on legitimate traffic | Override specific signature to Alert mode or add to bypass list |

## Related

- [firewall-skus.md](firewall-skus.md) — Premium SKU requirements
- [firewall-policy.md](firewall-policy.md) — Policy-level IDPS and TLS configuration
- [rule-types.md](rule-types.md) — Application rules with TLS inspection
- [Azure Firewall Premium features](https://learn.microsoft.com/azure/firewall/premium-features)
- [IDPS signature rules](https://learn.microsoft.com/azure/firewall/premium-features#idps)
