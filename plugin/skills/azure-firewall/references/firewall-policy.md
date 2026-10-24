# Azure Firewall Policies and Firewall Manager

Firewall policies are the recommended way to configure Azure Firewall rules. They replace the legacy "classic rules" model with a structured, reusable, and hierarchical configuration framework. Azure Firewall Manager provides centralized management of firewall policies across multiple firewalls and hubs.

## Firewall Policy vs Classic Rules

| Aspect | Firewall Policy | Classic Rules |
|--------|----------------|---------------|
| Management model | Azure Resource Manager resource | Firewall-embedded configuration |
| Reusability | One policy can be shared across firewalls | Each firewall has its own rules |
| Hierarchy | Parent-child inheritance | None |
| Firewall Manager support | Yes | No |
| Rule organization | Rule collection groups → collections → rules | Rule collections → rules |
| Recommended | **Yes** | No (legacy) |
| Coexistence | Cannot coexist with classic rules on same firewall | Cannot coexist with policies |

**Migration**: Classic rules can be migrated to firewall policies using the Azure portal migration wizard or the `AzureFirewallMigration.ps1` PowerShell script. After migration, the firewall switches to policy mode and classic rules are removed.

## Firewall Policy Structure

```
Firewall Policy (parent or standalone)
  │
  ├── Rule Collection Group "infra-rcg" (priority: 100)
  │     ├── Network Rule Collection "dns-rules" (priority: 100, action: Allow)
  │     │     ├── Rule: allow-azure-dns
  │     │     └── Rule: allow-custom-dns
  │     └── Application Rule Collection "azure-services" (priority: 200, action: Allow)
  │           ├── Rule: allow-windows-update
  │           └── Rule: allow-azure-monitor
  │
  ├── Rule Collection Group "app-team-a" (priority: 200)
  │     ├── Network Rule Collection "backend-rules" (priority: 100, action: Allow)
  │     └── Application Rule Collection "web-access" (priority: 200, action: Allow)
  │
  └── Rule Collection Group "deny-all" (priority: 999)
        └── Network Rule Collection "explicit-deny" (priority: 100, action: Deny)
              └── Rule: deny-everything
```

### Limits

| Resource | Limit |
|----------|-------|
| Rule collection groups per policy | 90 (default, increasable) |
| Rule collections per group | No hard limit (within total rule count) |
| Total rules per policy | 10,000 (default, increasable to 20,000) |
| Unique source/destination per rule | 250 |
| IP Groups per policy | 200 |
| IPs across all IP Groups | 5,000 |
| Policies per firewall | 1 |
| Firewalls per policy | Unlimited |

## Parent-Child Policy Inheritance

Firewall policies support a hierarchy model where a child policy inherits all rules from its parent and can add its own rules.

### How inheritance works

```
Parent Policy (Base rules — managed by central security team)
  ├── Infra rules (DNS, NTP, monitoring)
  ├── Threat intelligence: Deny
  └── IDPS mode: Alert+Deny
       │
       ├── Child Policy A (Hub-East — managed by app team A)
       │     ├── Inherits all parent rules (read-only)
       │     └── Adds app-specific rules
       │
       └── Child Policy B (Hub-West — managed by app team B)
             ├── Inherits all parent rules (read-only)
             └── Adds app-specific rules
```

### Inheritance rules
- Child policies inherit **all** rule collection groups from the parent
- Inherited rules are read-only in the child — they cannot be modified or deleted at the child level
- Child policies can add new rule collection groups with priorities that do not conflict with parent groups
- Parent rules are always processed first (parent rule collection groups have effective priority over child groups regardless of numeric priority)
- Threat intelligence mode and IDPS settings are inherited but can be overridden in the child to be **more** restrictive (not less)
- DNS settings, TLS inspection configuration, and IDPS bypass lists are inherited

### CLI: Create parent-child hierarchy

```bash
# Create parent policy
az network firewall policy create \
  --name "base-policy" \
  --resource-group <rg-name> \
  --sku Premium \
  --threat-intel-mode Deny

# Create child policy inheriting from parent
az network firewall policy create \
  --name "hub-east-policy" \
  --resource-group <rg-name> \
  --sku Premium \
  --base-policy <parent-policy-resource-id>

# Associate child policy with a firewall
az network firewall update \
  --name <fw-name> \
  --resource-group <rg-name> \
  --firewall-policy <child-policy-resource-id>
```

## Azure Firewall Manager

Azure Firewall Manager is a centralized security management service that provides policy and route management for cloud-based security perimeters.

### Capabilities

- **Central policy management**: Create and manage firewall policies and associate them across multiple firewalls
- **Hub management**: Deploy and manage firewalls in VNet hubs (hub VNet) or Virtual WAN hubs (secured virtual hub)
- **Route management**: Configure route intent and route policies for secured virtual hubs
- **Third-party SECaaS**: Integrate third-party security-as-a-service providers alongside Azure Firewall
- **Policy analytics**: View top hit rules, flow trends, and rule optimization suggestions

### Deployment models

#### Hub VNet (traditional hub-and-spoke)
- Firewall deployed in a standard VNet with AzureFirewallSubnet
- UDRs on spoke subnets route traffic through the firewall private IP
- Managed by Firewall Manager policies but routing is manual (UDRs)

#### Secured Virtual Hub (Virtual WAN)
- Firewall deployed inside a Virtual WAN hub
- Routing is managed by Virtual WAN routing intent — no manual UDRs needed
- Firewall Manager configures both the firewall and routing policies together
- Supports inter-hub routing through the Azure backbone

### CLI: Manage policies via Firewall Manager

```bash
# List all firewall policies (Firewall Manager scope)
az network firewall policy list -o table

# List all firewalls and their associated policies
az network firewall list --query "[].{Name:name, Policy:firewallPolicy.id}" -o table

# Update threat intelligence on a policy (propagates to all associated firewalls)
az network firewall policy update \
  --name <policy-name> \
  --resource-group <rg-name> \
  --threat-intel-mode Deny

# Move a firewall to a different policy
az network firewall update \
  --name <fw-name> \
  --resource-group <rg-name> \
  --firewall-policy <new-policy-resource-id>
```

## Best Practices

1. **Use a parent policy for org-wide baselines**: DNS settings, threat intelligence, IDPS mode, and infrastructure allow rules should be in the parent. Let teams manage their own child policies for app-specific rules.

2. **One policy per hub firewall**: Even though one policy can serve multiple firewalls, keep hub-specific rules in separate child policies for isolation and team autonomy.

3. **Reserve priority bands**: Establish priority conventions across the organization:
   - 100–199: Infrastructure (DNS, NTP, monitoring agents)
   - 200–499: Application rules (per-team or per-app groups)
   - 500–799: Shared services
   - 800–999: Explicit deny / catch-all rules

4. **Use IP Groups for large IP sets**: Instead of listing IPs in individual rules, create IP Groups and reference them. Changes to the IP Group propagate to all rules.

5. **Enable policy analytics**: Use Firewall Manager's analytics to identify unused rules, top flows, and optimization opportunities.

6. **Version control policies**: Export firewall policies as ARM/Bicep templates and manage them in source control. Use CI/CD pipelines for policy deployment.

## Common Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| Child policy cannot override parent rules | By design — inheritance is additive | Add new rules in child; to change parent behavior, modify the parent policy |
| Policy association fails | SKU mismatch | Child policy SKU must match parent; firewall SKU must match policy SKU |
| Rule limit reached | Exceeded 10,000 rules | Request a limit increase or consolidate rules using IP Groups and service tags |
| Changes not taking effect | Firewall still using old policy | Verify policy is associated; check `az network firewall show` for policy ID |
| Cannot delete parent policy | Child policies still reference it | Delete or reassign all child policies first |

## Related

- [rule-types.md](rule-types.md) — Rule types and processing order
- [firewall-skus.md](firewall-skus.md) — SKU requirements for policy features
- [Azure Firewall Manager documentation](https://learn.microsoft.com/azure/firewall-manager/overview)
- [Firewall policy rule sets](https://learn.microsoft.com/azure/firewall/policy-rule-sets)
