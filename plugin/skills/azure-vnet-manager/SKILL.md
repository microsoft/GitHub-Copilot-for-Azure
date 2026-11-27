---
name: azure-vnet-manager
description: "Manage Azure virtual networks at scale using Azure Virtual Network Manager (AVNM) for network groups, connectivity configurations (hub-and-spoke, mesh), and security admin rules. WHEN: virtual network manager, AVNM, network groups, connected group, hub and spoke configuration, mesh topology, security admin rules, network manager, manage VNets at scale. DO NOT USE FOR: individual VNet peering (use azure-virtual-network), NSG rules (use azure-virtual-network), Azure Policy for networking (use azure-compliance)."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Virtual Network Manager

Azure Virtual Network Manager (AVNM) is a management service that enables you to group, configure, deploy, and manage virtual networks globally across subscriptions at scale. It replaces the need to manually create and maintain individual peering connections and NSG rules across dozens or hundreds of VNets.

## When to Use This Skill

- Grouping virtual networks across multiple subscriptions and regions for centralized management
- Configuring hub-and-spoke topology at scale without manually creating individual peering connections
- Deploying mesh connectivity between VNets so they can communicate directly
- Enforcing security admin rules across all VNets in a network group regardless of individual NSG configurations
- Defining always-allow or always-deny network rules that cannot be overridden by workload teams
- Managing dynamic network group membership using Azure Policy conditions
- Setting up cross-region connectivity with global mesh or hub-and-spoke configurations
- Rolling out connectivity or security changes across many VNets in a controlled deployment workflow

## Rules

1. AVNM requires a network manager instance with a defined scope (management group or subscription). The scope determines which VNets the manager can govern.
2. Connectivity and security configurations must be explicitly deployed (committed) to target regions — saving a configuration does not apply it.
3. Security admin rules evaluate before NSG rules. A security admin deny rule blocks traffic even if an NSG allows it. An always-allow security admin rule permits traffic even if an NSG denies it.
4. Network groups can use static membership (manually added VNets) or dynamic membership (Azure Policy conditions). Dynamic groups automatically include VNets matching the conditions.
5. Hub-and-spoke connectivity configurations require the hub VNet to be in the same network manager scope. The hub is not automatically part of the network group.
6. Mesh connectivity creates direct peering between all VNets in a group — consider the peering limit (500 peerings per VNet) when designing large groups.
7. Global mesh and cross-region hub-and-spoke configurations use global VNet peering, which incurs cross-region data transfer charges.
8. Deployments can take several minutes to propagate. Monitor deployment status before assuming changes are active.
9. Removing a VNet from a network group does not automatically delete existing peering connections created by AVNM — you must redeploy the configuration.
10. AVNM is available in most Azure regions but verify availability in your target regions before designing the architecture.

## MCP Tools

| Tool | Method | Purpose |
|------|--------|---------|
| — | — | Limited MCP coverage — use CLI commands below |

> **Note:** Azure Virtual Network Manager has limited MCP server tool coverage. Use Azure CLI commands for all AVNM operations.

## CLI Fallback

```bash
# --- Network Manager Instance ---
# Create a network manager
az network manager create \
  --name myNetworkManager \
  --resource-group myRG \
  --location eastus \
  --scope-accesses "Connectivity" "SecurityAdmin" \
  --network-manager-scopes management-groups="/providers/Microsoft.Management/managementGroups/myMG"

# List network managers
az network manager list --resource-group myRG --output table

# Show a network manager
az network manager show --name myNetworkManager --resource-group myRG

# --- Network Groups ---
# Create a static network group
az network manager group create \
  --name myGroup \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --description "Production VNets"

# Add a VNet to a group (static membership)
az network manager group static-member create \
  --name myStaticMember \
  --network-group-name myGroup \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --resource-id "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/virtualNetworks/myVNet"

# List static members
az network manager group static-member list \
  --network-group-name myGroup \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --output table

# List network groups
az network manager group list \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --output table

# --- Connectivity Configurations ---
# Create a hub-and-spoke connectivity configuration
az network manager connect-config create \
  --name myHubSpoke \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --connectivity-topology "HubAndSpoke" \
  --hub resource-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/virtualNetworks/hubVNet" resource-type="Microsoft.Network/virtualNetworks" \
  --applies-to-groups group-connectivity="None" network-group-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/networkGroups/myGroup" use-hub-gateway="True"

# Create a mesh connectivity configuration
az network manager connect-config create \
  --name myMesh \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --connectivity-topology "Mesh" \
  --applies-to-groups group-connectivity="DirectlyConnected" network-group-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/networkGroups/myGroup" is-global="False"

# List connectivity configurations
az network manager connect-config list \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --output table

# --- Security Admin Configurations ---
# Create a security admin configuration
az network manager security-admin-config create \
  --name mySecurityConfig \
  --network-manager-name myNetworkManager \
  --resource-group myRG

# Create a rule collection
az network manager security-admin-config rule-collection create \
  --name myRuleCollection \
  --configuration-name mySecurityConfig \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --applies-to-groups network-group-id="/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/networkGroups/myGroup"

# Create a security admin rule (deny inbound SSH from internet)
az network manager security-admin-config rule-collection rule create \
  --name denySSHFromInternet \
  --rule-collection-name myRuleCollection \
  --configuration-name mySecurityConfig \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --kind "Custom" \
  --protocol "Tcp" \
  --access "Deny" \
  --priority 100 \
  --direction "Inbound" \
  --sources address-prefix="*" address-prefix-type="IPPrefix" \
  --destinations address-prefix="*" address-prefix-type="IPPrefix" \
  --dest-port-ranges 22

# List security admin rules
az network manager security-admin-config rule-collection rule list \
  --rule-collection-name myRuleCollection \
  --configuration-name mySecurityConfig \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --output table

# --- Deployment ---
# Deploy a connectivity configuration to a region
az network manager post-commit \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --commit-type "Connectivity" \
  --target-locations eastus \
  --configuration-ids "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/connectivityConfigurations/myHubSpoke"

# Deploy a security admin configuration
az network manager post-commit \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --commit-type "SecurityAdmin" \
  --target-locations eastus \
  --configuration-ids "/subscriptions/{sub}/resourceGroups/myRG/providers/Microsoft.Network/networkManagers/myNetworkManager/securityAdminConfigurations/mySecurityConfig"

# List deployments
az network manager list-deploy-status \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --deployment-types "Connectivity" "SecurityAdmin" \
  --regions eastus

# Delete a network manager
az network manager delete --name myNetworkManager --resource-group myRG --yes
```

## Key Concepts

- **Azure Virtual Network Manager (AVNM)** is a centralized management service for grouping and configuring VNets at scale. It provides two configuration types: connectivity (peering) and security admin rules.
- **Scope** defines what resources the network manager can govern. It can be a management group (for cross-subscription management) or an individual subscription.
- **Network Groups** are logical collections of VNets. They can have static members (manually added) or dynamic members (auto-populated via Azure Policy conditions based on tags, names, or other properties).
- **Connectivity Configurations** define the topology between VNets in a network group. Two topologies are available: hub-and-spoke (star) and mesh (full or partial).
- **Hub-and-Spoke** topology creates peering from each spoke VNet to a central hub VNet. Optional features include direct connectivity between spokes and using the hub as a gateway.
- **Mesh Topology** creates direct peering between all VNets in a group, enabling direct communication without routing through a hub. Global mesh extends this across regions.
- **Security Admin Rules** are centrally managed network security rules that evaluate before NSG rules. They have three access types: Allow, AlwaysAllow, and Deny.
- **Rule Evaluation Order**: Security admin rules evaluate first (by priority), then NSG rules evaluate. An AlwaysAllow security admin rule overrides NSG deny rules. A Deny security admin rule blocks traffic regardless of NSG rules.
- **Deployment (Commit)** is the process of applying configurations to target regions. Changes to configurations are not effective until they are committed and deployed.
- **Configuration Drift** — AVNM continuously enforces deployed configurations. If someone manually deletes an AVNM-managed peering, it is automatically recreated.

## References

- [Network groups and membership](references/network-groups.md)
- [Connectivity configurations — hub-and-spoke and mesh](references/connectivity-configs.md)
- [Security admin rules](references/security-admin-rules.md)
- [Deployment workflow](references/deployment.md)
- [Azure Virtual Network Manager overview — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/overview)
- [Azure Virtual Network Manager FAQ — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/faq)
