## Pairing Constraints

When connected to other resources, enforce these rules:

| Paired With | Constraint |
|-------------|------------|
| **Container Apps Environment** | Must reference `environmentId`. Environment must exist in the same region. |
| **VNet** | VNet integration is configured on the **Environment**, not the individual app. Environment needs a dedicated subnet with minimum /23 prefix for Consumption-only environments or /27 for workload profiles environments. |
| **Container Registry** | Requires registry credentials in `configuration.registries[]` or managed identity-based pull. |
| **Dapr** | Enable via `configuration.dapr.enabled: true`. Dapr components are configured on the Environment. |
| **CPU/Memory** | CPU and memory must follow valid combinations: 0.25 cores/0.5Gi, 0.5/1Gi, 1/2Gi, 2/4Gi, 4/8Gi (consumption). |
| **Scale Rules** | KEDA-based scale rules reference secrets by name — secrets must be defined in `configuration.secrets[]`. |
