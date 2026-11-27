# DNS Record Types Reference

## Overview

Azure DNS supports all standard DNS record types for both public and private zones. This reference covers each type with its purpose, syntax, Azure CLI commands, and common pitfalls.

In Azure DNS, records are organized into **record sets**. A record set is a collection of records with the same name and type. For example, two A records for `www` (round-robin) form a single record set.

---

## A Record (Address)

**Purpose:** Maps a hostname to an IPv4 address.

**When to use:** Pointing a name to a server, load balancer, or any resource with an IPv4 address.

```bash
# Create and add an A record
az network dns record-set a add-record -g MyRG -z contoso.com -n www -a 203.0.113.10

# Add a second record for round-robin
az network dns record-set a add-record -g MyRG -z contoso.com -n www -a 203.0.113.11

# Remove a specific record
az network dns record-set a remove-record -g MyRG -z contoso.com -n www -a 203.0.113.11
```

**Common mistakes:**
- Using a CNAME where an A record is needed (e.g., at the zone apex).
- Forgetting that A records at the same name form a record set — adding a second A record does not replace the first.

---

## AAAA Record (IPv6 Address)

**Purpose:** Maps a hostname to an IPv6 address.

**When to use:** Pointing a name to a resource with an IPv6 address. Identical to A records but for IPv6.

```bash
az network dns record-set aaaa add-record -g MyRG -z contoso.com -n www -a 2001:db8::1
```

**Common mistakes:**
- Formatting errors in IPv6 addresses (use proper colon notation).
- Creating AAAA records without verifying the target actually has IPv6 connectivity.

---

## CNAME Record (Canonical Name)

**Purpose:** Creates an alias from one name to another hostname. The DNS resolver follows the chain to the final A/AAAA record.

**When to use:** Pointing a subdomain to another service's hostname (e.g., App Service, CDN).

```bash
az network dns record-set cname set-record -g MyRG -z contoso.com -n blog -c blogapp.azurewebsites.net
```

**Key rules:**
- **Cannot coexist** with any other record type at the same name. If `blog` has a CNAME, you cannot also have an A, TXT, or MX at `blog`.
- **Cannot be used at the zone apex** (`@` or bare domain). Use an alias record instead.
- A CNAME record set can contain only ONE record (not a set of multiple).
- Uses `set-record` instead of `add-record` because only one value is allowed.

**Common mistakes:**
- Attempting to create a CNAME at the zone apex — this violates the DNS RFC.
- Creating a CNAME where other record types already exist at that name.
- Creating a CNAME chain (CNAME → CNAME → CNAME) — while technically valid, it adds latency and complexity.

---

## MX Record (Mail Exchange)

**Purpose:** Directs email delivery for the domain to a mail server.

**When to use:** Configuring email routing. Required for receiving email at your domain.

```bash
# Primary mail server (priority 10)
az network dns record-set mx add-record -g MyRG -z contoso.com -n @ -e mail.contoso.com -p 10

# Backup mail server (priority 20 — higher number = lower priority)
az network dns record-set mx add-record -g MyRG -z contoso.com -n @ -e backup-mail.contoso.com -p 20
```

**Parameters:**
- `-e` / `--exchange`: The mail server hostname.
- `-p` / `--preference`: Priority value (lower number = higher priority).

**Common mistakes:**
- Confusing priority direction — MX priority 10 is preferred over 20.
- Using an IP address instead of a hostname for the exchange value (MX requires a hostname).
- Forgetting to create an A record for the mail server hostname.

---

## TXT Record (Text)

**Purpose:** Stores arbitrary text data. Used for domain verification, SPF, DKIM, DMARC, and other metadata.

**When to use:** Email authentication (SPF/DKIM/DMARC), domain ownership verification (Microsoft 365, Google Workspace, SSL certificates), custom metadata.

```bash
# SPF record
az network dns record-set txt add-record -g MyRG -z contoso.com -n @ \
  -v "v=spf1 include:spf.protection.outlook.com -all"

# Domain verification for Microsoft 365
az network dns record-set txt add-record -g MyRG -z contoso.com -n @ \
  -v "MS=ms12345678"

# DMARC record
az network dns record-set txt add-record -g MyRG -z contoso.com -n _dmarc \
  -v "v=DMARC1; p=reject; rua=mailto:dmarc@contoso.com"
```

**Common mistakes:**
- TXT records longer than 255 characters must be split into multiple strings within a single record. Azure CLI handles this automatically for most cases.
- Adding multiple SPF records — you should have only one SPF TXT record at the same name. Combine with `include:` instead.

---

## SRV Record (Service Locator)

**Purpose:** Specifies the location (hostname and port) of a service.

**When to use:** Service discovery for protocols like SIP, XMPP, LDAP, or custom services.

```bash
# SIP over TCP service
az network dns record-set srv add-record -g MyRG -z contoso.com \
  -n _sip._tcp -r sipserver.contoso.com -p 5060 -w 10 -t 0
```

**Parameters:**
- `-n`: Name in format `_service._protocol` (e.g., `_sip._tcp`).
- `-r` / `--target`: The hostname providing the service.
- `-p` / `--port`: The port number.
- `-w` / `--weight`: Relative weight for load balancing between same-priority records.
- `-t` / `--priority`: Lower number = higher priority.

**Common mistakes:**
- Forgetting the underscore prefix on service and protocol names.
- Using the wrong protocol (TCP vs UDP) for the service.

---

## NS Record (Name Server)

**Purpose:** Delegates a subdomain to a different set of name servers.

**When to use:** Subdomain delegation — handing off DNS management for a subdomain to another zone.

```bash
# Delegate staging.contoso.com to a child zone
az network dns record-set ns add-record -g MyRG -z contoso.com -n staging \
  -d ns1-08.azure-dns.com
az network dns record-set ns add-record -g MyRG -z contoso.com -n staging \
  -d ns2-08.azure-dns.net
```

**Key rules:**
- NS records at the zone apex are managed by Azure DNS and cannot be modified.
- You can create NS records for subdomains to delegate to other zones.

**Common mistakes:**
- Trying to edit the apex NS records (Azure manages these).
- Not adding all four Azure DNS name servers when delegating to an Azure child zone.

---

## SOA Record (Start of Authority)

**Purpose:** Contains metadata about the zone: primary name server, admin email, serial number, refresh/retry/expire timers.

**When to use:** You typically do not create or delete SOA records — Azure DNS manages them automatically. You may update the email and TTL.

```bash
# View the SOA record
az network dns record-set soa show -g MyRG -z contoso.com

# Update the admin email
az network dns record-set soa update -g MyRG -z contoso.com -e admin.contoso.com
```

**Key rules:**
- Every zone has exactly one SOA record at the apex.
- Azure DNS manages the serial number automatically.
- The SOA email replaces `@` with `.` in the DNS wire format (e.g., `admin.contoso.com` means `admin@contoso.com`).

---

## CAA Record (Certificate Authority Authorization)

**Purpose:** Specifies which certificate authorities (CAs) are allowed to issue certificates for the domain.

**When to use:** Restricting certificate issuance to authorized CAs for security.

```bash
# Allow only Let's Encrypt to issue certificates
az network dns record-set caa add-record -g MyRG -z contoso.com -n @ \
  -f 0 -t issue -v "letsencrypt.org"

# Allow DigiCert for wildcard certificates
az network dns record-set caa add-record -g MyRG -z contoso.com -n @ \
  -f 0 -t issuewild -v "digicert.com"

# Send violation reports to an email
az network dns record-set caa add-record -g MyRG -z contoso.com -n @ \
  -f 0 -t iodef -v "mailto:security@contoso.com"
```

**Parameters:**
- `-f` / `--flags`: 0 for standard (non-critical), 128 for critical.
- `-t` / `--tag`: `issue` (standard certs), `issuewild` (wildcard certs), `iodef` (violation reporting).
- `-v` / `--value`: The CA domain or reporting URI.

**Common mistakes:**
- Forgetting to add CAA records for all CAs you use — a missing CA means it cannot issue for your domain.
- Not setting `issuewild` separately from `issue` — wildcard issuance needs its own rule.

---

## PTR Record (Pointer)

**Purpose:** Reverse DNS lookup — maps an IP address back to a hostname.

**When to use:** Reverse DNS zones (in-addr.arpa for IPv4, ip6.arpa for IPv6). Common for mail server verification and network diagnostics.

```bash
# In a reverse zone (e.g., 113.0.203.in-addr.arpa)
az network dns record-set ptr add-record -g MyRG -z 113.0.203.in-addr.arpa \
  -n 10 -d www.contoso.com
```

**Key rules:**
- PTR records live in reverse DNS zones, not forward zones.
- Azure supports reverse DNS for Azure-owned public IP addresses — configure via the public IP resource.
- For non-Azure IPs, your ISP or IP address provider manages the reverse zone.

---

## Alias Records (Azure-Specific)

Alias records are not a DNS standard but an Azure DNS feature. An alias record set points to an Azure resource instead of a static value.

**Supported types:** A, AAAA, CNAME (as alias).

**Supported targets:** Public IP, Traffic Manager profile, CDN endpoint, Front Door, another record set in the same zone.

```bash
# Alias A record at apex pointing to a public IP
az network dns record-set a create -g MyRG -z contoso.com -n @ \
  --target-resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/publicIPAddresses/MyPIP
```

**Key benefit:** The record automatically tracks the target resource's IP. If the public IP changes (e.g., after redeployment), the DNS record updates without manual intervention.

---

## Wildcard Records

Azure DNS supports wildcard records using `*` as the record name.

```bash
# Wildcard A record — matches any name not explicitly defined
az network dns record-set a add-record -g MyRG -z contoso.com -n "*" -a 203.0.113.99
```

**Behavior:** A query for `anything.contoso.com` returns the wildcard record, unless an explicit record exists for that name. Explicit records always take precedence over wildcards.

**Common mistakes:**
- Expecting wildcards to match multi-level subdomains — `*.contoso.com` matches `foo.contoso.com` but NOT `bar.foo.contoso.com`.
- Forgetting to quote the `*` in shell commands.

---

## Record Set Concepts

- A **record set** groups all records of the same name and type together.
- You can have multiple A records in one record set (round-robin load balancing).
- CNAME and SOA record sets can contain only one record each.
- Each record set has a single TTL that applies to all records in the set.
- The maximum number of records in a record set is 20.
- Empty record sets (no records) are visible in Azure DNS but do not return results to DNS queries.
