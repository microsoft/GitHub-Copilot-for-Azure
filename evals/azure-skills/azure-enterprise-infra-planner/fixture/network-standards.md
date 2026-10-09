# Platform Network Standards

<!-- fixture-id: enterprise-planner-network-v1 -->

- Deploy production platform networks in `westus3` with the naming prefix `NW-PROD`.
- Allocate VNet address space `10.42.0.0/16`.
- Use `10.42.0.0/24` for ingress, `10.42.1.0/24` for applications, and `10.42.2.0/24` for private endpoints.
- Workloads must have controlled outbound egress and no public IP resources.
- Use private endpoints for registries and data services.
- Create and link private DNS zones, including `privatelink.blob.core.windows.net`.
- Tag resources with `network-zone=production` and `cost-center=CC-4200`.