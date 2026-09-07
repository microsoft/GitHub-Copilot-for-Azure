# API server, admission webhook, and tunnel evidence

Bind every read to the named AKS cluster, affected object, nodes, and incident
window. Use supplied evidence and approved host capabilities; unavailable
telemetry is unknown, not absent.

## API server pressure

For API latency, timeouts, HTTP 429, or "unable to handle the request," inspect
Resource Health and AKS control-plane diagnostics when available, then correlate
the affected command, recent bulk operations, and high-volume list/watch
clients. Distinguish customer-driven request load from a platform condition. If
the remaining evidence requires service-side control-plane access, stop and
escalate with the cluster, timestamps, symptoms, correlation IDs, and completed
read-only checks.

## Admission webhooks

```bash
kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations -o yaml
kubectl get service,endpoints,endpointslice -n <webhook-namespace>
kubectl get pods -n <webhook-namespace> -o wide
```

For the named webhook, inspect `failurePolicy`, `timeoutSeconds`,
`namespaceSelector`, backing Service, endpoints, and ready pods. A failing
webhook with `failurePolicy: Fail` can block matching operations, but an error
string alone does not prove the backend cause or blast radius. Never delete,
patch, or weaken a webhook until the backend state is proven and the owner
approves the remediation.

## Node-dependent logs, exec, and port-forward failures

If `kubectl logs`, `exec`, `port-forward`, or webhook calls fail only for pods
on some nodes while ordinary API reads work, test the node-placement pattern
and inspect the `konnectivity-agent` pods in `kube-system`. Port 10250 errors
can indicate the API-server-to-kubelet tunnel path rather than pod networking.
Inspect the affected nodes' NSG, firewall, UDR, and tunnel-component evidence
read-only. Do not change node firewall or iptables state; escalate service-side
or unsupported node conditions with the collected evidence.

Exact nested `VMExtensionError_K8SAPIServerConnFail` / CSE exit 51 belongs to
`aks-known-issues`. Explicit packet capture belongs to `aks-network-capture`.

Sources: [API server and etcd troubleshooting](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/create-upgrade-delete/troubleshoot-apiserver-etcd),
[tunnel connectivity](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/connectivity/tunnel-connectivity-issues),
[admission-controller triage](https://learn.microsoft.com/azure/architecture/operator-guides/aks/aks-triage-controllers),
and [AKS support policies](https://learn.microsoft.com/azure/aks/support-policies).
