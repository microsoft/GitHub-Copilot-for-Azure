# Network Security

## Security Principles

1. **Defense in Depth** — Multiple security layers
2. **Zero Trust** — Never trust, always verify

## Network Security Checklist

- [ ] Use private endpoints for PaaS services
- [ ] Configure NSGs on all subnets
- [ ] Disable public endpoints where possible
- [ ] Enable DDoS protection
- [ ] Use Azure Firewall or NVA

## Private Endpoints

```bash
# Create private endpoint for storage
az network private-endpoint create \
  --name myEndpoint -g RG \
  --vnet-name VNET --subnet SUBNET \
  --private-connection-resource-id STORAGE_ID \
  --group-id blob \
  --connection-name myConnection
```

## NSG Rules

```bash
# Deny all inbound by default
# Allow only required traffic
az network nsg rule create \
  --nsg-name NSG -g RG \
  --name AllowHTTPS \
  --priority 100 \
  --destination-port-ranges 443 \
  --access Allow
```

## Best Practices

1. **Default deny** — Block all traffic by default, allow only required
2. **Segment networks** — Use subnets and NSGs to isolate workloads
3. **Private endpoints** — Use for all PaaS services in production
4. **Service endpoints** — Alternative to private endpoints for simpler scenarios
5. **Azure Firewall** — Centralize egress traffic control
