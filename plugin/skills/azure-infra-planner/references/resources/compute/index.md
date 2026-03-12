### Compute

| Resource | ARM Type | File | CAF Prefix | Naming Scope | Region Category |
|----------|----------|------|------------|--------------|-----------------|
| App Service | `Microsoft.Web/sites` | [app-service.md](app-service/app-service.md) | `app` | Global | Mainstream |
| App Service Plan | `Microsoft.Web/serverfarms` | [app-service-plan.md](app-service-plan/app-service-plan.md) | `asp` | Resource group | Mainstream |
| Function App | `Microsoft.Web/sites` | [function-app.md](function-app/function-app.md) | `func` | Global | Mainstream |
| Container App | `Microsoft.App/containerApps` | [container-app.md](container-app/container-app.md) | `ca` | Environment | Strategic |
| Container Apps Environment | `Microsoft.App/managedEnvironments` | [container-apps-environment.md](container-apps-environment/container-apps-environment.md) | `cae` | Resource group | Strategic |
| AKS Cluster | `Microsoft.ContainerService/managedClusters` | [aks-cluster.md](aks-cluster/aks-cluster.md) | `aks` | Resource group | Foundational |
| Virtual Machine | `Microsoft.Compute/virtualMachines` | [virtual-machine.md](virtual-machine/virtual-machine.md) | `vm` | Resource group | Foundational |
| VM Scale Set | `Microsoft.Compute/virtualMachineScaleSets` | [vm-scale-set.md](vm-scale-set/vm-scale-set.md) | `vmss` | Resource group | Foundational |
| Managed Disk | `Microsoft.Compute/disks` | [managed-disk.md](managed-disk/managed-disk.md) | `osdisk`/`disk` | Resource group | Foundational |
| Availability Set | `Microsoft.Compute/availabilitySets` | [availability-set.md](availability-set/availability-set.md) | `avail` | Resource group | Foundational |
| Container Registry | `Microsoft.ContainerRegistry/registries` | [container-registry.md](container-registry/container-registry.md) | `cr` | Global | Mainstream |
| Static Web App | `Microsoft.Web/staticSites` | [static-web-app.md](static-web-app/static-web-app.md) | `stapp` | Resource group | Mainstream |
