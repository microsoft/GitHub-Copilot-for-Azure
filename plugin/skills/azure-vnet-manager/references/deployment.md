# Deployment

Azure Virtual Network Manager configurations must be explicitly deployed (committed) to take effect. Saving a connectivity configuration or security admin rule does not apply it to the network — you must commit and deploy to target regions.

## Deployment Workflow

The deployment process follows these steps:

1. **Author** — create or modify configurations (connectivity, security admin rules)
2. **Commit** — submit the configuration for deployment to specific regions
3. **Deploy** — AVNM applies the configuration to VNets in the target regions
4. **Monitor** — verify deployment status and check for errors
5. **Enforce** — AVNM continuously enforces the configuration (re-applies if drifted)

## Deploying Configurations

### Deploy a connectivity configuration

```bash
az network manager post-commit \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --commit-type "Connectivity" \
  --target-locations eastus westus2 \
  --configuration-ids "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/connectivityConfigurations/hubSpokeConfig"
```

### Deploy a security admin configuration

```bash
az network manager post-commit \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --commit-type "SecurityAdmin" \
  --target-locations eastus westus2 \
  --configuration-ids "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/securityAdminConfigurations/baselineSecurity"
```

### Deploy multiple configurations at once

You can deploy multiple configurations of the same type in one commit:

```bash
az network manager post-commit \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --commit-type "Connectivity" \
  --target-locations eastus \
  --configuration-ids \
    "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/connectivityConfigurations/hubSpokeConfig" \
    "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/connectivityConfigurations/meshConfig"
```

> **Note:** Connectivity and security admin configurations must be deployed separately — each `post-commit` call handles one commit type.

## Deployment Regions

- You must specify which regions to deploy to using `--target-locations`
- Only VNets located in the specified regions receive the configuration
- You can deploy the same configuration to different regions in separate commits
- If your VNets span 5 regions, you need to include all 5 regions in the target-locations

### Determine which regions to target

```bash
# List VNets in a network group to identify their regions
az network manager group static-member list \
  --network-group-name myGroup \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --output table

# Then check VNet locations
az network vnet list --output table --query "[].{Name:name, Location:location, RG:resourceGroup}"
```

## Monitoring Deployment Status

### Check deployment status

```bash
az network manager list-deploy-status \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --deployment-types "Connectivity" "SecurityAdmin" \
  --regions eastus westus2
```

### Deployment status values

| Status | Description |
|--------|-------------|
| `Deploying` | Configuration is being applied to VNets in the region |
| `Deployed` | Configuration is active and enforced |
| `Failed` | Deployment encountered an error — check error details |
| `NotStarted` | Deployment has not begun for this region |

### Common deployment errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Address space overlap | Two VNets in a mesh group have overlapping address ranges | Remove one VNet from the group or fix the address space |
| Hub VNet not found | Hub VNet was deleted or moved | Update the connectivity configuration with a valid hub |
| Insufficient permissions | Network manager identity lacks rights on target subscription | Grant Network Contributor role on the subscription |
| Peering limit exceeded | A VNet would exceed 500 peerings | Reduce the network group size or switch from mesh to hub-and-spoke |
| VNet in multiple hub-and-spoke configs | A VNet is a spoke in two configurations deployed to the same region | Remove the VNet from one configuration |

## Updating Deployed Configurations

To update a deployed configuration:

1. Modify the configuration (add/remove rules, change topology settings)
2. Commit and deploy again to the same regions

```bash
# After modifying a connectivity configuration, redeploy
az network manager post-commit \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --commit-type "Connectivity" \
  --target-locations eastus \
  --configuration-ids "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/connectivityConfigurations/hubSpokeConfig"
```

AVNM performs an incremental update — it only changes what is different from the current deployed state.

## Removing a Deployed Configuration

To undeploy a configuration from a region, deploy to the region with an empty configuration list:

```bash
# Remove all connectivity configurations from eastus
az network manager post-commit \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --commit-type "Connectivity" \
  --target-locations eastus \
  --configuration-ids ""
```

This removes AVNM-managed peerings and security admin rules from the VNets in that region.

> **Warning:** Undeploying a connectivity configuration removes the peerings it created. VNets that relied on those peerings will lose connectivity. Plan maintenance windows accordingly.

## Rollback Considerations

AVNM does not have a built-in rollback feature. To revert a change:

1. **Re-deploy the previous configuration** — if you saved the previous configuration, modify the current one to match the previous state and redeploy
2. **Undeploy the configuration** — remove the configuration from the region entirely
3. **Keep configuration versions** — maintain documentation or naming conventions for configuration versions (e.g., `hubSpokeConfig-v1`, `hubSpokeConfig-v2`)

### Rollback strategies

| Strategy | How | When |
|----------|-----|------|
| Re-deploy previous state | Modify configuration back to previous settings, then commit | Minor changes that can be easily reversed |
| Undeploy | Deploy with empty configuration IDs | Emergency — need to remove all AVNM management immediately |
| Blue-green configurations | Maintain two configurations, deploy the active one | Major topology changes — deploy new config, verify, undeploy old |

## Configuration Drift Protection

AVNM continuously enforces deployed configurations:

- If someone manually deletes an AVNM-managed peering, AVNM recreates it
- If someone modifies peering settings managed by AVNM, AVNM reverts them
- If a new VNet joins a dynamic network group, AVNM automatically configures it on the next enforcement cycle

Drift correction happens within minutes but is not instantaneous. During the window between manual change and drift correction, connectivity may be affected.

## Deployment Best Practices

1. **Deploy to non-production first** — test configurations in dev/staging regions before deploying to production regions
2. **Deploy one region at a time** — for critical changes, deploy to one region, verify, then expand to other regions
3. **Monitor after deployment** — check deployment status and verify VNet connectivity after each deployment
4. **Document configurations** — AVNM does not version configurations; maintain your own change log
5. **Use separate configurations for different environments** — avoid mixing dev, staging, and production VNets in the same configuration
6. **Schedule maintenance windows for undeploy operations** — undeploying connectivity configurations disrupts traffic

## Quotas and Limits

| Resource | Limit |
|----------|-------|
| Connectivity configurations per network manager | 20 |
| Security admin configurations per network manager | 20 |
| Rule collections per security admin configuration | 10 |
| Rules per rule collection | 100 |
| Deployments (concurrent) | Limited by Azure resource manager throttling |

## Learn More

- [Deployment overview — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/concept-deployments)
- [Deploy configurations — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/how-to-deploy-configurations)
- [Remove deployed configurations — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/how-to-remove-deployed-configurations)
