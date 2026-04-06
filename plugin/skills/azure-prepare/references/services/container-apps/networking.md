# Container Apps Networking

VNet integration, ingress configuration, custom domains, and TLS for Container Apps.

## Ingress Modes

| Mode | Visibility | Use Case |
|------|-----------|----------|
| External | Internet-accessible | Public APIs, web apps |
| Internal | Not internet-accessible; reachable within the environment and VNet (if VNet-injected) | Microservices, back-end APIs |
| Disabled | No HTTP ingress | Background workers, queue processors |

### Bicep — External Ingress

```bicep
configuration: {
  ingress: {
    external: true
    targetPort: 8080
    transport: 'auto'
    allowInsecure: false
  }
}
```

### Bicep — Internal Ingress

```bicep
configuration: {
  ingress: {
    external: false
    targetPort: 8080
  }
}
```

> 💡 **Tip:** Internal apps get a `*.internal.<env-default-domain>` FQDN. This is accessible from within the Container Apps environment and, when the environment is VNet-injected, also from the VNet.

## VNet Integration

Container Apps run inside an environment that can be injected into a VNet subnet.

### Subnet Requirements

| Requirement | Workload Profiles (default) | Consumption-only (legacy) |
|------------|---------------------------|--------------------------|
| Minimum subnet size | `/27` (32 addresses) | `/23` (512 addresses) |
| Delegation | `Microsoft.App/environments` | None (do not delegate) |
| Dedicated | Subnet must be exclusive to the Container Apps environment | Same |

### Bicep — VNet-Integrated Environment

```bicep
resource subnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' = {
  parent: vnet
  name: 'container-apps-subnet'
  properties: {
    addressPrefix: '10.0.16.0/27'
    delegations: [
      {
        name: 'Microsoft.App.environments'
        properties: { serviceName: 'Microsoft.App/environments' }
      }
    ]
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    vnetConfiguration: {
      infrastructureSubnetId: subnet.id
      internal: false // true for internal-only environment
    }
  }
}
```

> ⚠️ **Warning:** VNet configuration is set at environment creation and cannot be changed afterward. Plan your network topology before creating the environment.

## Custom Domains

### Steps

1. Add a CNAME or A record pointing to the Container App's FQDN or static IP
2. Bind the custom domain to the Container App
3. Configure a managed or custom TLS certificate

```bash
# Add custom domain with managed certificate
az containerapp hostname add -n $APP -g $RG --hostname app.contoso.com

# Bind managed certificate
az containerapp hostname bind -n $APP -g $RG \
  --hostname app.contoso.com \
  --environment $ENV_NAME \
  --validation-method CNAME
```

### DNS Configuration

| Record Type | Name | Value |
|------------|------|-------|
| CNAME | `app.contoso.com` | `<app-name>.<region>.azurecontainerapps.io` |
| TXT (verification) | `asuid.app.contoso.com` | `<verification-id>` |
| A (apex domain) | `contoso.com` | Environment static IP |

> 💡 **Tip:** Use `az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn` to get the target FQDN for DNS records.

## TLS Configuration

### Managed Certificates

Azure automatically provisions and renews TLS certificates for custom domains — no manual cert management required.

## IP Restrictions

> ⚠️ **Warning:** All IP restriction rules must be the **same action type** — you cannot mix Allow and Deny rules.

Allow rules implicitly deny all traffic not matching any rule. Deny rules implicitly allow all other traffic.

```bicep
configuration: {
  ingress: {
    external: true
    targetPort: 8080
    ipSecurityRestrictions: [
      {
        name: 'allow-office'
        action: 'Allow'
        ipAddressRange: '203.0.113.0/24'
        description: 'Office network'
        priority: 100
      }
      {
        name: 'allow-vpn'
        action: 'Allow'
        ipAddressRange: '198.51.100.0/24'
        description: 'VPN gateway'
        priority: 200
      }
    ]
  }
}
```

## Network Topology Summary

| Topology | Environment `internal` | Ingress `external` | Access |
|----------|----------------------|-------------------|--------|
| Public app | `false` | `true` | Internet + VNet |
| Internal microservice | `false` | `false` | Same environment; VNet if environment is VNet-injected |
| Fully private | `true` | `true` or `false` | VNet only (no public IP) |

> ⚠️ **Warning:** An internal environment has no public IP. You need VPN, ExpressRoute, or a jump box to reach apps in an internal environment.
