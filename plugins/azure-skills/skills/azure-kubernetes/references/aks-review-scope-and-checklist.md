# Scope & Checklist Workflow

## Step 1: Establish Review Scope

1. Confirm exact AKS cluster: `subscriptionId`, `resourceGroup`, `clusterName`, `kubeContext`.
2. State scope: AKS cluster platform and in-cluster Kubernetes configuration only.
3. State out-of-scope: non-AKS Azure resources unless directly required for AKS controls.
4. Record limitations: permissions, missing add-ons, private API server access, disconnected networks, preview features.

## Step 2: Load Canonical Checklist

1. Use [AKS Checklist Matrix](./aks-checklist-matrix.md) as base list.
2. Keep both sources in scope:
   - AKS best-practices categories (operator/developer)
   - Well-Architected AKS pillars (Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency)
3. Include deeper child-page checks: cluster isolation, scheduler (basic/advanced), identity, cluster security, container image management, network, storage, multi-region, resource management, pod security, app/cluster reliability.
4. Incorporate AKS Checklist sections: `Identity`, `Cluster security`, `Networking`, `Storage`, `Resource management`, `Cluster operations`, `BCDR`, `Windows`, `Application deployment`, `Image management`.
5. **Source precedence**: Microsoft Learn wins when guidance clashes. AKS Checklist is supplementary.
6. Never silently drop items. If a check cannot execute, mark `Not assessed` with explanation.
7. Use strict hierarchy (`Parent Page -> Child Page -> Check ID`) for rollup.
