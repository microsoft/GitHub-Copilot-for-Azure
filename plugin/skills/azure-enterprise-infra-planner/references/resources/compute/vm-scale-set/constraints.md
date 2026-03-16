## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Subnet** | Network interfaces defined inline in `virtualMachineProfile.networkProfile`. Subnet must be in same region. |
| **Load Balancer** | Reference backend pool ID in NIC IP configuration. |
| **Orchestration Mode** | `Flexible` is the modern default. `Uniform` requires `upgradePolicy`. |
| **Availability Zone** | Set `zones: ['1', '2', '3']` for zone distribution. Cannot combine with availability sets. |
