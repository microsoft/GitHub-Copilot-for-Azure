# Network Groups

Network groups are the foundational building block of Azure Virtual Network Manager (AVNM). A network group is a logical collection of virtual networks that you manage together — applying connectivity configurations, security admin rules, and governance policies to all members at once.

## Membership Types

AVNM supports two membership models that can be used together in the same group:

| Type | How Members Are Added | Best For |
|------|----------------------|----------|
| **Static** | Manually add individual VNets by resource ID | Small, stable sets of VNets with well-known identities |
| **Dynamic** | Azure Policy conditions auto-add matching VNets | Large or growing environments where VNets are tagged/named consistently |

## Static Membership

Static membership means you explicitly add each VNet to the group.

```bash
# Create a network group
az network manager group create \
  --name prodVNets \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --description "Production virtual networks"

# Add a VNet as a static member
az network manager group static-member create \
  --name vnet1-member \
  --network-group-name prodVNets \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --resource-id "/subscriptions/{sub}/resourceGroups/appRG/providers/Microsoft.Network/virtualNetworks/appVNet"

# Add another VNet
az network manager group static-member create \
  --name vnet2-member \
  --network-group-name prodVNets \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --resource-id "/subscriptions/{sub2}/resourceGroups/dbRG/providers/Microsoft.Network/virtualNetworks/dbVNet"

# List static members
az network manager group static-member list \
  --network-group-name prodVNets \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --output table

# Remove a static member
az network manager group static-member delete \
  --name vnet1-member \
  --network-group-name prodVNets \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --yes
```

### When to use static membership

- You have a small, known set of VNets (under 20)
- VNets don't follow a consistent tagging or naming convention
- You need precise control over which VNets are in each group
- Testing configurations before rolling out dynamic membership

## Dynamic Membership

Dynamic membership uses Azure Policy conditions to automatically include VNets that match specified criteria. When a new VNet is created that matches the conditions, it is automatically added to the group.

### Condition-based matching

Dynamic membership conditions evaluate VNet properties. Common conditions:

| Property | Operator | Example |
|----------|----------|---------|
| `Name` | Contains, Equals, NotContains | Name contains "prod" |
| `Tags` | Exists, Equals | Tag "environment" equals "production" |
| `Resource Group` | Equals, Contains | Resource group contains "app" |
| `Subscription` | Equals | Specific subscription ID |
| `Type` | Equals | Microsoft.Network/virtualNetworks |

### Creating dynamic membership via Azure Policy

Dynamic group membership is defined through Azure Policy definitions applied to the network manager's scope. The policy evaluates VNet resources and assigns matching ones to the group.

Example: Auto-add all VNets tagged with `environment=production`:

The policy condition in the network group definition:

```json
{
  "allOf": [
    {
      "field": "type",
      "equals": "Microsoft.Network/virtualNetworks"
    },
    {
      "field": "tags['environment']",
      "equals": "production"
    }
  ]
}
```

Example: Auto-add VNets whose name starts with "spoke-":

```json
{
  "allOf": [
    {
      "field": "type",
      "equals": "Microsoft.Network/virtualNetworks"
    },
    {
      "field": "name",
      "like": "spoke-*"
    }
  ]
}
```

Example: Auto-add VNets in specific subscriptions:

```json
{
  "allOf": [
    {
      "field": "type",
      "equals": "Microsoft.Network/virtualNetworks"
    },
    {
      "field": "Microsoft.Network/virtualNetworks/subscriptionId",
      "in": [
        "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj"
      ]
    }
  ]
}
```

### When to use dynamic membership

- Large environments with dozens or hundreds of VNets
- VNets are created and destroyed frequently
- Consistent tagging strategy is in place
- You want "zero-touch" group management — new VNets auto-enroll

## Cross-Subscription Groups

AVNM can manage VNets across multiple subscriptions when the network manager's scope is set to a management group.

```bash
# Create a network manager scoped to a management group
az network manager create \
  --name crossSubManager \
  --resource-group centralRG \
  --location eastus \
  --scope-accesses "Connectivity" "SecurityAdmin" \
  --network-manager-scopes management-groups="/providers/Microsoft.Management/managementGroups/myMG"
```

Requirements for cross-subscription groups:
- The network manager scope must include the subscriptions containing the VNets
- The identity running the network manager needs `Network Contributor` or equivalent on the target subscriptions
- Dynamic membership policies must be assigned at the management group level to evaluate VNets across subscriptions

## Combining Static and Dynamic Membership

A single network group can use both static and dynamic membership simultaneously. This is useful when:

- Most VNets are tagged and auto-join via dynamic membership
- A few VNets don't follow the tagging convention and need static addition
- You want to test a VNet in the group before updating its tags

Members added both statically and dynamically appear once — there is no duplication.

## Managing Network Groups

```bash
# List all network groups
az network manager group list \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --output table

# Show a specific group
az network manager group show \
  --name prodVNets \
  --network-manager-name myNetworkManager \
  --resource-group myRG

# Delete a network group (must not be referenced by configurations)
az network manager group delete \
  --name prodVNets \
  --network-manager-name myNetworkManager \
  --resource-group myRG \
  --yes
```

## Limits

| Resource | Limit |
|----------|-------|
| Network groups per network manager | 100 |
| Static members per network group | 1,000 |
| VNets managed per network manager | 1,000 (can be increased) |
| Network managers per subscription | 5 |

## Best Practices

1. **Use tags consistently** — establish a tagging convention (e.g., `environment`, `team`, `network-tier`) and enforce it with Azure Policy so dynamic membership works reliably.
2. **Start with static, graduate to dynamic** — use static membership during initial setup and testing, then move to dynamic once tagging is standardized.
3. **Avoid overlapping group conditions** — if a VNet matches multiple groups with conflicting configurations, deployment behavior may be unpredictable.
4. **Monitor group membership** — periodically review group members to ensure dynamic conditions are not over-matching or under-matching.
5. **Use management group scope for enterprise** — scoping to a management group enables cross-subscription management from a single network manager.

## Learn More

- [Network groups overview — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/concept-network-groups)
- [Define dynamic network group membership — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/concept-azure-policy-integration)
- [Create a network group — Microsoft Learn](https://learn.microsoft.com/azure/virtual-network-manager/how-to-create-network-group)
