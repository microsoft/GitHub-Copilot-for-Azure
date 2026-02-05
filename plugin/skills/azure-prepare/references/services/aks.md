# Azure Kubernetes Service (AKS)

Hosting patterns and best practices for Azure Kubernetes Service.

## When to Use

- Complex microservices requiring Kubernetes orchestration
- Teams with Kubernetes expertise
- Workloads needing fine-grained control over infrastructure
- Multi-container pods with sidecars
- Custom networking requirements
- Hybrid/multi-cloud Kubernetes strategies

## Service Type in azure.yaml

```yaml
services:
  my-service:
    host: aks
    project: ./src/my-service
    docker:
      path: ./Dockerfile
    k8s:
      deploymentPath: ./k8s
```

## Bicep Resource Pattern

```bicep
resource aks 'Microsoft.ContainerService/managedClusters@2023-07-01' = {
  name: '${resourcePrefix}-aks-${uniqueHash}'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    dnsPrefix: '${resourcePrefix}-aks'
    kubernetesVersion: '1.28'
    agentPoolProfiles: [
      {
        name: 'default'
        count: 3
        vmSize: 'Standard_DS2_v2'
        mode: 'System'
        osType: 'Linux'
        enableAutoScaling: true
        minCount: 1
        maxCount: 5
      }
    ]
    networkProfile: {
      networkPlugin: 'azure'
      serviceCidr: '10.0.0.0/16'
      dnsServiceIP: '10.0.0.10'
    }
    addonProfiles: {
      omsagent: {
        enabled: true
        config: {
          logAnalyticsWorkspaceResourceID: logAnalytics.id
        }
      }
    }
  }
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aks.id, containerRegistry.id, 'acrpull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: aks.properties.identityProfile.kubeletidentity.objectId
    principalType: 'ServicePrincipal'
  }
}
```

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| Container Registry | Image storage |
| Log Analytics Workspace | Monitoring |
| Virtual Network | Network isolation (optional) |
| Key Vault | Secrets management |

## Node Pool Configuration

### System Pool (Required)

```bicep
{
  name: 'system'
  count: 3
  vmSize: 'Standard_DS2_v2'
  mode: 'System'
  osType: 'Linux'
}
```

### User Pool (Workloads)

```bicep
{
  name: 'workload'
  count: 2
  vmSize: 'Standard_DS4_v2'
  mode: 'User'
  osType: 'Linux'
  enableAutoScaling: true
  minCount: 1
  maxCount: 10
  nodeTaints: []
}
```

## Kubernetes Manifests

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-service
  template:
    metadata:
      labels:
        app: my-service
    spec:
      containers:
      - name: my-service
        image: myacr.azurecr.io/my-service:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: my-service
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  annotations:
    kubernetes.io/ingress.class: azure/application-gateway
spec:
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-service
            port:
              number: 80
```

## Add-ons

### Azure CNI Networking

```bicep
networkProfile: {
  networkPlugin: 'azure'
  networkPolicy: 'calico'
}
```

### Azure Key Vault Provider

```bicep
addonProfiles: {
  azureKeyvaultSecretsProvider: {
    enabled: true
    config: {
      enableSecretRotation: 'true'
    }
  }
}
```

### Application Gateway Ingress Controller

```bicep
addonProfiles: {
  ingressApplicationGateway: {
    enabled: true
    config: {
      applicationGatewayId: appGateway.id
    }
  }
}
```

## Workload Identity

For secure access to Azure services:

```bicep
properties: {
  oidcIssuerProfile: {
    enabled: true
  }
  securityProfile: {
    workloadIdentity: {
      enabled: true
    }
  }
}
```

## Security Features

| Feature | Description |
|---------|-------------|
| Workload Identity | Secure pod access to Azure services without secrets |
| Network Policy | Control traffic between pods (Calico/Azure) |
| Private Cluster | Disable public API server endpoint |

For comprehensive security guidance, see: [security.md](../security.md)
