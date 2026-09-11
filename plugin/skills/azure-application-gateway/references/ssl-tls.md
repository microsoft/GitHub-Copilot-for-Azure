# SSL/TLS Configuration

## SSL/TLS Termination Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| SSL Termination | Decrypt at App Gateway, send HTTP to backend | Most common; offloads SSL from backends |
| End-to-End SSL | Decrypt at App Gateway, re-encrypt to backend (HTTPS) | Compliance requires encryption in transit everywhere |
| SSL Passthrough | Not supported | Use Azure Load Balancer or other L4 solution |

## SSL Termination (Frontend Only)

Application Gateway decrypts SSL/TLS traffic and forwards plain HTTP to backends.

```bash
# Upload PFX certificate
az network application-gateway ssl-cert create \
  --gateway-name myAppGw -g myRG \
  --name myCert \
  --cert-file ./cert.pfx \
  --cert-password "MyP@ssword123"

# Create HTTPS listener with the certificate
az network application-gateway http-listener create \
  --gateway-name myAppGw -g myRG \
  --name httpsListener \
  --frontend-ip appGatewayFrontendIP \
  --frontend-port port443 \
  --ssl-cert myCert

# Backend HTTP settings (unencrypted to backend)
az network application-gateway http-settings create \
  --gateway-name myAppGw -g myRG \
  --name httpSettings \
  --port 80 \
  --protocol Http
```

## End-to-End SSL

Application Gateway decrypts, inspects, then re-encrypts traffic to HTTPS backends.

```bash
# Upload backend's root CA certificate (for backend cert verification)
az network application-gateway root-cert create \
  --gateway-name myAppGw -g myRG \
  --name backendRootCA \
  --cert-file ./backend-root-ca.cer

# HTTPS backend settings with trusted root cert
az network application-gateway http-settings create \
  --gateway-name myAppGw -g myRG \
  --name httpsBackendSettings \
  --port 443 \
  --protocol Https \
  --root-certs backendRootCA \
  --host-name-from-backend-pool true
```

### When Trusted Root Cert is Required

| Backend Cert Type | Root Cert Needed? |
|-------------------|-------------------|
| Public CA (DigiCert, Let's Encrypt, etc.) | No — already trusted |
| Self-signed certificate | Yes — upload the root CA |
| Internal CA / Enterprise CA | Yes — upload the root CA |
| App Service managed cert | No — already trusted |

## Key Vault Integration (Recommended)

Store certificates in Azure Key Vault for automated rotation and centralized management.

### Setup Steps

```bash
# Step 1: Create managed identity for App Gateway
az network application-gateway identity assign \
  --gateway-name myAppGw -g myRG \
  --identity myAppGwIdentity

# Step 2: Grant Key Vault access to the managed identity
az keyvault set-policy \
  --name myKeyVault \
  --object-id <managed-identity-object-id> \
  --secret-permissions get list

# Step 3: Reference Key Vault certificate in App Gateway
az network application-gateway ssl-cert create \
  --gateway-name myAppGw -g myRG \
  --name kvCert \
  --key-vault-secret-id "https://myKeyVault.vault.azure.net/secrets/myCert"
```

### Key Vault Certificate Rotation

- Application Gateway polls Key Vault every **4 hours** for new certificate versions
- When a new version is detected, it's automatically deployed (no downtime)
- Use the **secret URI without version** to enable auto-rotation:
  - ✅ `https://mykv.vault.azure.net/secrets/cert` (auto-rotates)
  - ❌ `https://mykv.vault.azure.net/secrets/cert/abc123` (pinned to version)

## SSL Policy Configuration

SSL policies control which TLS protocol versions and cipher suites are accepted.

### Predefined Policies

| Policy | Min TLS | Cipher Suites | Recommendation |
|--------|---------|---------------|----------------|
| AppGwSslPolicy20220101 | 1.2 | Strong modern ciphers | ✅ Recommended |
| AppGwSslPolicy20220101S | 1.2 | Strictest (no CBC) | High-security workloads |
| AppGwSslPolicy20170401S | 1.2 | Good | Acceptable |
| AppGwSslPolicy20150501 | 1.0 | Legacy | ❌ Avoid |

```bash
# Apply predefined SSL policy
az network application-gateway ssl-policy set \
  --gateway-name myAppGw -g myRG \
  --policy-type Predefined \
  --policy-name AppGwSslPolicy20220101
```

### Custom SSL Policy

```bash
az network application-gateway ssl-policy set \
  --gateway-name myAppGw -g myRG \
  --policy-type CustomV2 \
  --min-protocol-version TLSv1_2 \
  --cipher-suites \
    TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 \
    TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
```

## Mutual TLS (mTLS)

Client certificate authentication — the gateway verifies the client's certificate.

### Configuration

```bash
# Upload trusted client CA certificate
az network application-gateway ssl-profile create \
  --gateway-name myAppGw -g myRG \
  --name mtlsProfile \
  --client-auth-configuration verifyClientCertIssuerDN=true \
  --trusted-client-certificates clientRootCA

# Associate SSL profile with listener
az network application-gateway http-listener update \
  --gateway-name myAppGw -g myRG \
  --name httpsListener \
  --ssl-profile mtlsProfile
```

### Client Certificate Header Forwarding

Application Gateway forwards client certificate details to backends via headers:

| Header | Content |
|--------|---------|
| `X-Forwarded-Client-Cert` | Base64-encoded client certificate |
| `X-Client-Cert-Issuer` | Certificate issuer DN |
| `X-Client-Cert-Subject` | Certificate subject DN |
| `X-Client-Cert-Serial` | Certificate serial number |

## Troubleshooting SSL Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| ERR_SSL_PROTOCOL_ERROR | TLS version mismatch | Update SSL policy to support client's TLS version |
| 502 with HTTPS backend | Backend cert not trusted | Upload backend root CA as trusted root cert |
| Certificate expiry warnings | Cert about to expire | Rotate in Key Vault; auto-deploys in 4 hours |
| mTLS handshake failure | Client cert not from trusted CA | Verify trusted client CA is uploaded correctly |
| Mixed content warnings | HTTP resources on HTTPS page | Use rewrite rules or fix application URLs |

## Source Documentation

- [SSL termination overview](https://learn.microsoft.com/azure/application-gateway/ssl-overview)
- [End-to-end TLS](https://learn.microsoft.com/azure/application-gateway/end-to-end-ssl-portal)
- [Key Vault certificates](https://learn.microsoft.com/azure/application-gateway/key-vault-certs)
- [SSL policy overview](https://learn.microsoft.com/azure/application-gateway/application-gateway-ssl-policy-overview)
- [Mutual authentication](https://learn.microsoft.com/azure/application-gateway/mutual-authentication-overview)
