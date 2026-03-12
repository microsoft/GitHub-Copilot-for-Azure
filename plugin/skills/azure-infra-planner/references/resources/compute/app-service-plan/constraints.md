## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Function App** | Consumption (`Y1`) and Flex (`FC1`) plans cannot be shared with web apps. EP plans can host both functions and web apps. |
| **Linux Apps** | Linux plan (`reserved: true`) cannot host Windows apps and vice versa. |
| **Zone Redundancy** | Requires Premium v3 (`P1v3`+) or Isolated v2. Minimum 3 instances. |
| **Deployment Slots** | Slots share plan capacity. Standard+ tier required. Slots are not available on Free/Basic. |
| **Auto-scale** | Not available on Free/Shared/Basic. Standard+ required for manual scale, auto-scale. |
| **VNet Integration** | Requires Basic or higher. Subnet must be delegated to `Microsoft.Web/serverFarms`. Minimum subnet size /28 (or /26 for multi-plan subnet join). VNet integration subnet must be a different subnet than any Private Endpoint subnet. |
| **Private Endpoints** | Requires Basic tier or higher. Not available on Free or Shared tiers. |
| **Isolated Compute** | Dedicated single-tenant compute requires IsolatedV2 (`I1v2`+) tier. |
| **Free/Shared Tiers** | Free (`F1`) and Shared (`D1`) use shared compute with no VNet integration, no private endpoints, no deployment slots, no Always On, and no auto-scale. Managed Identity is available but limited. |
