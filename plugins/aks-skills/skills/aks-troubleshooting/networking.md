# Networking Troubleshooting

For CNI-specific issues, check CNI pod health and review [AKS networking concepts](https://learn.microsoft.com/azure/aks/concepts-network).

## Service Unreachable / Connection Refused

**Diagnostics - always start here:**

```bash
# 1. Verify service exists and has endpoints (read-only)
kubectl get svc <service-name> -n <ns>
kubectl get endpoints <service-name> -n <ns>
kubectl get endpointslice -n <ns> \
  -l kubernetes.io/service-name=<service-name> -o wide
kubectl get pods -n <ns> -l <service-selector> -o wide
```

**Decision tree:**

| Observation                             | Cause                              | Fix                                             |
| --------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| Endpoints shows `<none>`                | Label selector mismatch            | Align selector with pod labels; check for typos |
| Endpoints has IPs but unreachable       | Port mismatch or app not listening | Confirm `targetPort` = actual container port    |
| Works from some pods, fails from others | Network policy blocking            | See Network Policy section                      |
| Works inside cluster, fails externally  | Load balancer issue                | See Load Balancer section                       |
| `ECONNREFUSED` immediately              | App not listening on that port     | Check listening ports in the pod                |

Pods that are running but not Ready are removed from Endpoints. Check `kubectl get pod <pod> -n <ns>`.

**Deep diagnostics with Inspektor Gadget** (when the above checks are inconclusive):

Use the [IG base command pattern](references/inspektor-gadget.md) with `--k8s-namespace <ns> --k8s-podname <pod-name>` and these gadgets:

- `snapshot_socket` (timeout 5) — check what ports the pod is listening on
- `trace_tcp` (timeout 30) — trace connect/accept/close events
- `trace_tcpretrans` (timeout 30) — packet retransmissions

See [references/inspektor-gadget.md](references/inspektor-gadget.md).

---

## DNS Resolution Failures

Use the affected pod; do not create a test pod or change DNS, NetworkPolicy, NSG, route, or firewall configuration without explicit approval.

### Mandatory ordered read-only evidence

A DNS diagnosis is incomplete until every step below is collected, or the inability to collect it is recorded. Do not skip resolver inputs, a query through kube-dns, direct upstream behavior, or the CoreDNS-to-upstream UDP/TCP 53 network path.

```bash
# 1. Preserve and explicitly inspect every nameserver, search suffix, and option
kubectl exec <affected-pod> -n <ns> -- cat /etc/resolv.conf

# 2. Check the kube-dns Service, backends, CoreDNS pods, logs, and config
kubectl get service kube-dns -n kube-system -o wide
kubectl get endpoints kube-dns -n kube-system -o wide
kubectl get endpointslice -n kube-system \
  -l kubernetes.io/service-name=kube-dns -o wide
kubectl get pods -n kube-system -l k8s-app=kube-dns -o wide
kubectl logs -n kube-system -l k8s-app=kube-dns \
  --all-containers --prefix --tail=-1
kubectl get configmap coredns -n kube-system -o yaml
kubectl get configmap -n kube-system

# 3. Prove CoreDNS query health through the kube-dns ClusterIP, then compare
# direct UDP and TCP 53 behavior for every configured upstream forwarder.
# Use clients already present in the affected pod; do not install packages.
kubectl exec <affected-pod> -n <ns> -- \
  nslookup <failing-fqdn> <kube-dns-cluster-ip>
kubectl exec <affected-pod> -n <ns> -- \
  dig +notcp +time=<timeout-seconds> +tries=<attempt-count> \
  @<custom-forwarder-ip> <failing-fqdn>
kubectl exec <affected-pod> -n <ns> -- \
  dig +tcp +time=<timeout-seconds> +tries=<attempt-count> \
  @<custom-forwarder-ip> <failing-fqdn>

# 4. Preserve policy plus the node-NIC NSG/route path used by each CoreDNS pod
kubectl get networkpolicy -n <ns> -o yaml
kubectl get networkpolicy -n kube-system -o yaml
kubectl get pods -n kube-system -l k8s-app=kube-dns \
  -o custom-columns='POD:.metadata.name,POD_IP:.status.podIP,NODE:.spec.nodeName'
NODE_RESOURCE_GROUP=$(az aks show \
  --resource-group <cluster-resource-group> \
  --name <cluster-name> \
  --query nodeResourceGroup -o tsv)
COREDNS_PROVIDER_ID=$(kubectl get node <coredns-node> \
  -o jsonpath='{.spec.providerID}')
COREDNS_POOL=$(kubectl get node <coredns-node> \
  -o jsonpath='{.metadata.labels.agentpool}')
COREDNS_VMSS_NAME=$(printf '%s\n' "$COREDNS_PROVIDER_ID" |
  awk -F'/virtualMachineScaleSets/' '{print $2}' | cut -d/ -f1)
COREDNS_INSTANCE_ID=${COREDNS_PROVIDER_ID##*/}
COREDNS_NODE_NIC_ID=$(az vmss nic list-vm-nics \
  --resource-group "$NODE_RESOURCE_GROUP" \
  --vmss-name "$COREDNS_VMSS_NAME" \
  --instance-id "$COREDNS_INSTANCE_ID" \
  --query '[0].id' -o tsv)
COREDNS_NODE_SUBNET_ID=$(az network nic show \
  --ids "$COREDNS_NODE_NIC_ID" \
  --query 'ipConfigurations[0].subnet.id' -o tsv)
COREDNS_POD_SUBNET_ID=$(az aks nodepool show \
  --resource-group <cluster-resource-group> \
  --cluster-name <cluster-name> \
  --name "$COREDNS_POOL" \
  --query podSubnetId -o tsv)
COREDNS_SOURCE_SUBNET_ID=${COREDNS_POD_SUBNET_ID:-$COREDNS_NODE_SUBNET_ID}

# Effective node-NIC evidence, then explicit source-subnet NSG and UDR evidence
az network nic list-effective-nsg \
  --ids "$COREDNS_NODE_NIC_ID" -o json
az network nic show-effective-route-table \
  --ids "$COREDNS_NODE_NIC_ID" -o table
if COREDNS_SUBNET_NSG_ID=$(az network vnet subnet show \
  --ids "$COREDNS_SOURCE_SUBNET_ID" \
  --query networkSecurityGroup.id -o tsv); then
  if [ -n "$COREDNS_SUBNET_NSG_ID" ]; then
    if COREDNS_SUBNET_NSG=$(az network nsg show \
      --ids "$COREDNS_SUBNET_NSG_ID" \
      --query '{customOutbound:securityRules[?direction==`Outbound`],defaultOutbound:defaultSecurityRules[?direction==`Outbound`]}' \
      -o json); then
      if [ -n "$COREDNS_SUBNET_NSG" ]; then
        printf '%s\n' "$COREDNS_SUBNET_NSG"
      else
        printf 'subnetNsg=unknown: command=az network nsg show succeeded with empty output; id=%s\n' \
          "$COREDNS_SUBNET_NSG_ID"
      fi
    else
      printf 'subnetNsg=inaccessible: command=az network nsg show; id=%s\n' \
        "$COREDNS_SUBNET_NSG_ID"
    fi
  else
    printf 'subnetNsg=absent\n'
  fi
else
  COREDNS_SUBNET_NSG_ID=""
  printf 'subnetNsg=inaccessible: command=az network vnet subnet show; ids=%s; query=networkSecurityGroup.id\n' \
    "$COREDNS_SOURCE_SUBNET_ID"
fi
if COREDNS_ROUTE_TABLE_ID=$(az network vnet subnet show \
  --ids "$COREDNS_SOURCE_SUBNET_ID" \
  --query routeTable.id -o tsv); then
  if [ -n "$COREDNS_ROUTE_TABLE_ID" ]; then
    if COREDNS_ROUTE_TABLE=$(az network route-table show \
      --ids "$COREDNS_ROUTE_TABLE_ID" \
      --query 'routes[].{name:name,addressPrefix:addressPrefix,nextHopType:nextHopType,nextHopIpAddress:nextHopIpAddress}' \
      -o table); then
      if [ -n "$COREDNS_ROUTE_TABLE" ]; then
        printf '%s\n' "$COREDNS_ROUTE_TABLE"
      else
        printf 'routeTableRoutes=absent: command=az network route-table show succeeded with empty routes output; id=%s\n' \
          "$COREDNS_ROUTE_TABLE_ID"
      fi
    else
      printf 'routeTable=inaccessible: command=az network route-table show; id=%s\n' \
        "$COREDNS_ROUTE_TABLE_ID"
    fi
  else
    printf 'routeTable=absent\n'
  fi
else
  COREDNS_ROUTE_TABLE_ID=""
  printf 'routeTable=inaccessible: command=az network vnet subnet show; ids=%s; query=routeTable.id\n' \
    "$COREDNS_SOURCE_SUBNET_ID"
fi
```

Repeat these checks for each node hosting a CoreDNS pod. For Azure CNI Pod Subnet, `COREDNS_SOURCE_SUBNET_ID` is the pod subnet; otherwise it is the CoreDNS node NIC subnet. Record an NSG or route table as absent only when its association lookup succeeds with an empty ID; record a failed lookup as inaccessible instead of running its dependent `show` command. Evaluate outbound rules and routes from the CoreDNS pod/node source to every configured upstream on both UDP and TCP destination port 53.

If the selected route has a `VirtualAppliance` next hop, run the exact policy or classic network-rule collection commands in [Mandatory Firewall or NVA branch when traversed](#3-mandatory-firewall-or-nva-branch-when-traversed), then query the matching DNS decisions:

```bash
az monitor log-analytics query \
  --workspace <log-analytics-workspace-id> \
  --timespan <incident-start-utc>/<incident-end-utc> \
  --analytics-query "union isfuzzy=true AZFWNetworkRule, AzureDiagnostics | where _ResourceId =~ '<firewall-resource-id>' | where (SourceIp in ('<coredns-pod-ip>','<coredns-node-ip>') and DestinationIp == '<custom-forwarder-ip>' and DestinationPort == 53 and Protocol in ('UDP','TCP')) or (Category == 'AzureFirewallNetworkRule' and (msg_s has '<coredns-pod-ip>' or msg_s has '<coredns-node-ip>') and msg_s has '<custom-forwarder-ip>' and msg_s has '53' and (msg_s has 'UDP' or msg_s has 'TCP')) | project TimeGenerated,Category,Action,Protocol,SourceIp,DestinationIp,DestinationPort,RuleCollection,Rule,msg_s"
```

For a custom NVA, collect equivalent network-rule and log evidence filtered to the same CoreDNS source, upstream destination, incident window, and UDP/TCP 53.

If CoreDNS imports a custom ConfigMap, retrieve the named ConfigMap shown by the inventory before evaluating its forwarding rules. A successful direct query to a custom forwarder with a failed query through kube-dns points to CoreDNS configuration or service-path evidence; failure to reach the forwarder points to routing, NSG, firewall, or NetworkPolicy evidence.

**DNS failure patterns:**

| Symptom | Evidence boundary |
|---|---|
| `NXDOMAIN` for `svc.cluster.local` | Confirm search domains, kube-dns endpoints, and the CoreDNS `kubernetes` plugin before changing CoreDNS |
| Internal names resolve; external names return `NXDOMAIN` | Compare CoreDNS forwarding configuration and direct queries to each configured upstream |
| `SERVFAIL` | Correlate CoreDNS logs with upstream reachability and forwarder responses |
| Private endpoint FQDN resolves publicly | Inspect the `privatelink.*` private DNS zone, record set, virtual network links, and conditional forwarders |
| `i/o timeout` | Inspect NetworkPolicy plus effective node-NIC NSG, route, and present firewall rules for both UDP and TCP 53 |

Changing CoreDNS replicas/configuration, custom forwarders, NetworkPolicy, NSGs, routes, or firewall rules is remediation and requires explicit approval.

**Deep diagnostics with Inspektor Gadget** (when the above checks are inconclusive):

Use the [IG base command pattern](references/inspektor-gadget.md) with `--k8s-namespace <ns> --k8s-podname <pod-name>` and `trace_dns` (timeout 30). Key signals: `rcode=3` (NXDOMAIN), `rcode=2` (SERVFAIL), high `latency` values, queries going to unexpected destinations.

See [references/inspektor-gadget.md](references/inspektor-gadget.md).

---

## AKS to an External Azure Service

### Executable evidence first

An external-connectivity diagnosis is incomplete until each evidence class below is collected, or the inability to collect it is recorded: the cluster's network model and outbound type; source NIC and subnet identity; effective NIC NSG rules plus the explicit subnet NSG rules; the effective route table and any UDR next hop; workload DNS and TCP behavior; the service's endpoint configuration — public access and firewall rules, service endpoint/VNet rules, private-endpoint connections, and the private-DNS zone, records, and links that determine which endpoint model is in effect; and — when the selected route's next hop is a firewall or NVA — the matching rule and incident-window logs. A skipped conditional step must be recorded with its reason (for example: selected next hop is Internet, so no firewall evidence applies). Do not conclude, and do not propose remediation, from a subset.

Cluster-side identifiers are derivable — exhaust derivation before asking: the cluster name and resource group resolve from the current kubeconfig context confirmed against `az aks list` (same procedure as [node-issues.md](node-issues.md)), and the block computes the rest from the pod (pod → node → `providerID` → VMSS/NIC/subnet). Ask the user only for what cannot be derived: the target service's name and resource group and the incident window.

```bash
AKS_RG="<cluster-resource-group>"
AKS_NAME="<cluster-name>"
NS="<namespace>"
POD="<affected-pod>"
SQL_RG="<sql-resource-group>"
SQL_SERVER="<sql-server-name>"
SQL_FQDN="$SQL_SERVER.database.windows.net"
SQL_DESTINATION_IP="<resolved-sql-destination-ip>"
PRIVATE_DNS_RG="<private-dns-resource-group>"
INCIDENT_START="<incident-start-utc>"
INCIDENT_END="<incident-end-utc>"

# AKS network model and source VMSS instance NIC/subnet
az aks show \
  --resource-group "$AKS_RG" \
  --name "$AKS_NAME" \
  --query '{nodeResourceGroup:nodeResourceGroup,networkPlugin:networkProfile.networkPlugin,networkPluginMode:networkProfile.networkPluginMode,networkPolicy:networkProfile.networkPolicy,networkDataplane:networkProfile.networkDataplane,outboundType:networkProfile.outboundType}' \
  -o yaml
NODE_RESOURCE_GROUP=$(az aks show \
  --resource-group "$AKS_RG" \
  --name "$AKS_NAME" \
  --query nodeResourceGroup -o tsv)
if SOURCE_NODE=$(kubectl get pod "$POD" -n "$NS" \
  -o jsonpath='{.spec.nodeName}'); then
  if [ -z "$SOURCE_NODE" ]; then
    printf 'sourceNode=unknown: kubectl get pod succeeded with empty spec.nodeName; namespace=%s; pod=%s\n' \
      "$NS" "$POD"
  fi
else
  SOURCE_NODE=""
  printf 'sourceNode=inaccessible: command=kubectl get pod; namespace=%s; pod=%s; jsonpath=.spec.nodeName\n' \
    "$NS" "$POD"
fi
if SOURCE_POD_IP=$(kubectl get pod "$POD" -n "$NS" \
  -o jsonpath='{.status.podIP}'); then
  if [ -z "$SOURCE_POD_IP" ]; then
    printf 'sourcePodIp=unknown: kubectl get pod succeeded with empty status.podIP; namespace=%s; pod=%s\n' \
      "$NS" "$POD"
  fi
else
  SOURCE_POD_IP=""
  printf 'sourcePodIp=inaccessible: command=kubectl get pod; namespace=%s; pod=%s; jsonpath=.status.podIP\n' \
    "$NS" "$POD"
fi
if [ -n "$SOURCE_NODE" ]; then
  if SOURCE_NODE_IP=$(kubectl get node "$SOURCE_NODE" \
    -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}'); then
    if [ -z "$SOURCE_NODE_IP" ]; then
      printf 'sourceNodeIp=unknown: kubectl get node succeeded with no InternalIP; node=%s\n' \
        "$SOURCE_NODE"
    fi
  else
    SOURCE_NODE_IP=""
    printf 'sourceNodeIp=inaccessible: command=kubectl get node; node=%s; jsonpath=.status.addresses[InternalIP]\n' \
      "$SOURCE_NODE"
  fi
else
  SOURCE_NODE_IP=""
  printf 'sourceNodeIp=unknown: source node is unavailable\n'
fi
SOURCE_POOL=$(kubectl get node "$SOURCE_NODE" \
  -o jsonpath='{.metadata.labels.agentpool}')
PROVIDER_ID=$(kubectl get node "$SOURCE_NODE" \
  -o jsonpath='{.spec.providerID}')
VMSS_NAME=$(printf '%s\n' "$PROVIDER_ID" |
  awk -F'/virtualMachineScaleSets/' '{print $2}' | cut -d/ -f1)
INSTANCE_ID=${PROVIDER_ID##*/}
NODE_NIC_ID=$(az vmss nic list-vm-nics \
  --resource-group "$NODE_RESOURCE_GROUP" \
  --vmss-name "$VMSS_NAME" \
  --instance-id "$INSTANCE_ID" \
  --query '[0].id' -o tsv)
NODE_SUBNET_ID=$(az network nic show --ids "$NODE_NIC_ID" \
  --query 'ipConfigurations[0].subnet.id' -o tsv)
POD_SUBNET_ID=$(az aks nodepool show \
  --resource-group "$AKS_RG" \
  --cluster-name "$AKS_NAME" \
  --name "$SOURCE_POOL" \
  --query podSubnetId -o tsv)
SOURCE_SUBNET_ID=${POD_SUBNET_ID:-$NODE_SUBNET_ID}

# Effective NIC rules/routes and explicit subnet NSG inbound/outbound rules
az network nic list-effective-nsg \
  --ids "$NODE_NIC_ID" -o json
if SUBNET_NSG_ID=$(az network vnet subnet show \
  --ids "$SOURCE_SUBNET_ID" \
  --query networkSecurityGroup.id -o tsv); then
  if [ -n "$SUBNET_NSG_ID" ]; then
    if SUBNET_NSG=$(az network nsg show \
      --ids "$SUBNET_NSG_ID" \
      --query '{customInbound:securityRules[?direction==`Inbound`],customOutbound:securityRules[?direction==`Outbound`],defaultInbound:defaultSecurityRules[?direction==`Inbound`],defaultOutbound:defaultSecurityRules[?direction==`Outbound`]}' \
      -o json); then
      if [ -n "$SUBNET_NSG" ]; then
        printf '%s\n' "$SUBNET_NSG"
      else
        printf 'subnetNsg=unknown: command=az network nsg show succeeded with empty output; id=%s\n' \
          "$SUBNET_NSG_ID"
      fi
    else
      printf 'subnetNsg=inaccessible: command=az network nsg show; id=%s\n' \
        "$SUBNET_NSG_ID"
    fi
  else
    printf 'subnetNsg=absent\n'
  fi
else
  SUBNET_NSG_ID=""
  printf 'subnetNsg=inaccessible: command=az network vnet subnet show; ids=%s; query=networkSecurityGroup.id\n' \
    "$SOURCE_SUBNET_ID"
fi
az network nic show-effective-route-table \
  --ids "$NODE_NIC_ID" -o table
if ROUTE_TABLE_ID=$(az network vnet subnet show \
  --ids "$SOURCE_SUBNET_ID" \
  --query routeTable.id -o tsv); then
  if [ -n "$ROUTE_TABLE_ID" ]; then
    if ROUTE_TABLE=$(az network route-table show \
      --ids "$ROUTE_TABLE_ID" \
      --query '{disableBgpRoutePropagation:disableBgpRoutePropagation,routes:routes[].{name:name,addressPrefix:addressPrefix,nextHopType:nextHopType,nextHopIpAddress:nextHopIpAddress}}' \
      -o json); then
      if [ -n "$ROUTE_TABLE" ]; then
        printf '%s\n' "$ROUTE_TABLE"
      else
        printf 'routeTable=unknown: command=az network route-table show succeeded with empty output; id=%s\n' \
          "$ROUTE_TABLE_ID"
      fi
    else
      printf 'routeTable=inaccessible: command=az network route-table show; id=%s\n' \
        "$ROUTE_TABLE_ID"
    fi
  else
    printf 'routeTable=absent\n'
  fi
else
  ROUTE_TABLE_ID=""
  printf 'routeTable=inaccessible: command=az network vnet subnet show; ids=%s; query=routeTable.id\n' \
    "$SOURCE_SUBNET_ID"
fi

# Effective public egress identity for the reported AKS outbound type
if OUTBOUND_TYPE=$(az aks show \
  --resource-group "$AKS_RG" \
  --name "$AKS_NAME" \
  --query networkProfile.outboundType -o tsv); then
  if [ -n "$OUTBOUND_TYPE" ]; then
    printf 'outboundType=%s\n' "$OUTBOUND_TYPE"
  else
    printf 'outboundType=unknown: az aks show succeeded with empty networkProfile.outboundType\n'
  fi
else
  OUTBOUND_TYPE=""
  printf 'outboundType=inaccessible: command=az aks show; resourceGroup=%s; cluster=%s; query=networkProfile.outboundType\n' \
    "$AKS_RG" "$AKS_NAME"
fi

case "$OUTBOUND_TYPE" in
  loadBalancer)
    if OUTBOUND_PUBLIC_IP_IDS=$(az aks show \
      --resource-group "$AKS_RG" \
      --name "$AKS_NAME" \
      --query 'networkProfile.loadBalancerProfile.effectiveOutboundIPs[].id' \
      -o tsv); then
      if [ -n "$OUTBOUND_PUBLIC_IP_IDS" ]; then
        printf '%s\n' "$OUTBOUND_PUBLIC_IP_IDS" |
        while IFS= read -r PUBLIC_IP_ID; do
          [ -n "$PUBLIC_IP_ID" ] || continue
          if OUTBOUND_PUBLIC_IP=$(az network public-ip show \
            --ids "$PUBLIC_IP_ID" \
            --query '{id:id,ipAddress:ipAddress,publicIPPrefix:publicIPPrefix.id}' \
            -o yaml); then
            if [ -n "$OUTBOUND_PUBLIC_IP" ]; then
              printf '%s\n' "$OUTBOUND_PUBLIC_IP"
            else
              printf 'outboundPublicIp=unknown: command=az network public-ip show succeeded with empty output; id=%s\n' \
                "$PUBLIC_IP_ID"
            fi
          else
            printf 'outboundPublicIp=inaccessible: command=az network public-ip show; id=%s\n' \
              "$PUBLIC_IP_ID"
          fi
        done
      else
        printf 'outboundPublicIpIds=absent\n'
        printf 'outboundIdentity=unknown: no effective load-balancer outbound public IP was returned\n'
      fi
    else
      OUTBOUND_PUBLIC_IP_IDS=""
      printf 'outboundPublicIpIds=inaccessible: command=az aks show; resourceGroup=%s; cluster=%s; query=networkProfile.loadBalancerProfile.effectiveOutboundIPs[].id\n' \
        "$AKS_RG" "$AKS_NAME"
      printf 'outboundIdentity=unknown: load-balancer outbound public IP lookup failed\n'
    fi
    ;;
  managedNATGateway|managedNATGatewayV2|userAssignedNATGateway|none)
    if NAT_GATEWAY_ID=$(az network vnet subnet show \
      --ids "$SOURCE_SUBNET_ID" \
      --query natGateway.id -o tsv); then
      if [ -n "$NAT_GATEWAY_ID" ]; then
        if NAT_GATEWAY=$(az network nat gateway show \
          --ids "$NAT_GATEWAY_ID" \
          --query '{id:id,publicIpAddresses:publicIpAddresses[].id,publicIpPrefixes:publicIpPrefixes[].id}' \
          -o yaml); then
          if [ -n "$NAT_GATEWAY" ]; then
            printf '%s\n' "$NAT_GATEWAY"
          else
            printf 'natGateway=unknown: command=az network nat gateway show succeeded with empty output; id=%s\n' \
              "$NAT_GATEWAY_ID"
          fi
        else
          printf 'natGateway=inaccessible: command=az network nat gateway show; id=%s\n' \
            "$NAT_GATEWAY_ID"
        fi

        NAT_PUBLIC_IP_LOOKUP=failed
        if NAT_PUBLIC_IP_IDS=$(az network nat gateway show \
          --ids "$NAT_GATEWAY_ID" \
          --query 'publicIpAddresses[].id' -o tsv); then
          NAT_PUBLIC_IP_LOOKUP=succeeded
          if [ -n "$NAT_PUBLIC_IP_IDS" ]; then
            printf '%s\n' "$NAT_PUBLIC_IP_IDS" |
            while IFS= read -r PUBLIC_IP_ID; do
              [ -n "$PUBLIC_IP_ID" ] || continue
              if NAT_PUBLIC_IP=$(az network public-ip show \
                --ids "$PUBLIC_IP_ID" \
                --query '{id:id,ipAddress:ipAddress}' -o yaml); then
                if [ -n "$NAT_PUBLIC_IP" ]; then
                  printf '%s\n' "$NAT_PUBLIC_IP"
                else
                  printf 'natGatewayPublicIp=unknown: command=az network public-ip show succeeded with empty output; id=%s\n' \
                    "$PUBLIC_IP_ID"
                fi
              else
                printf 'natGatewayPublicIp=inaccessible: command=az network public-ip show; id=%s\n' \
                  "$PUBLIC_IP_ID"
              fi
            done
          else
            printf 'natGatewayPublicIpAddresses=absent\n'
          fi
        else
          NAT_PUBLIC_IP_IDS=""
          printf 'natGatewayPublicIpAddresses=inaccessible: command=az network nat gateway show; id=%s; query=publicIpAddresses[].id\n' \
            "$NAT_GATEWAY_ID"
        fi

        NAT_PUBLIC_IP_PREFIX_LOOKUP=failed
        if NAT_PUBLIC_IP_PREFIX_IDS=$(az network nat gateway show \
          --ids "$NAT_GATEWAY_ID" \
          --query 'publicIpPrefixes[].id' -o tsv); then
          NAT_PUBLIC_IP_PREFIX_LOOKUP=succeeded
          if [ -n "$NAT_PUBLIC_IP_PREFIX_IDS" ]; then
            printf '%s\n' "$NAT_PUBLIC_IP_PREFIX_IDS" |
            while IFS= read -r PUBLIC_IP_PREFIX_ID; do
              [ -n "$PUBLIC_IP_PREFIX_ID" ] || continue
              if NAT_PUBLIC_IP_PREFIX=$(az network public-ip prefix show \
                --ids "$PUBLIC_IP_PREFIX_ID" \
                --query '{id:id,ipPrefix:ipPrefix}' -o yaml); then
                if [ -n "$NAT_PUBLIC_IP_PREFIX" ]; then
                  printf '%s\n' "$NAT_PUBLIC_IP_PREFIX"
                else
                  printf 'natGatewayPublicIpPrefix=unknown: command=az network public-ip prefix show succeeded with empty output; id=%s\n' \
                    "$PUBLIC_IP_PREFIX_ID"
                fi
              else
                printf 'natGatewayPublicIpPrefix=inaccessible: command=az network public-ip prefix show; id=%s\n' \
                  "$PUBLIC_IP_PREFIX_ID"
              fi
            done
          else
            printf 'natGatewayPublicIpPrefixes=absent\n'
          fi
        else
          NAT_PUBLIC_IP_PREFIX_IDS=""
          printf 'natGatewayPublicIpPrefixes=inaccessible: command=az network nat gateway show; id=%s; query=publicIpPrefixes[].id\n' \
            "$NAT_GATEWAY_ID"
        fi

        if [ "$NAT_PUBLIC_IP_LOOKUP" != succeeded ] ||
          [ "$NAT_PUBLIC_IP_PREFIX_LOOKUP" != succeeded ]; then
          printf 'outboundIdentity=unknown: NAT gateway public identity lookup is incomplete\n'
        elif [ -z "$NAT_PUBLIC_IP_IDS" ] &&
          [ -z "$NAT_PUBLIC_IP_PREFIX_IDS" ]; then
          printf 'outboundIdentity=unknown: NAT gateway has no visible public IP or prefix identity\n'
        fi
      else
        printf 'natGateway=absent\n'
        if [ "$OUTBOUND_TYPE" = "none" ]; then
          printf 'outboundIdentity=not AKS-managed: no source-subnet NAT gateway; use the effective route and resolve any next-hop SNAT identity\n'
        else
          printf 'outboundIdentity=unknown: no NAT gateway is associated with the selected source subnet\n'
        fi
      fi
    else
      NAT_GATEWAY_ID=""
      printf 'natGateway=inaccessible: command=az network vnet subnet show; ids=%s; query=natGateway.id\n' \
        "$SOURCE_SUBNET_ID"
      printf 'outboundIdentity=unknown: source-subnet NAT gateway association lookup failed\n'
    fi
    ;;
  userDefinedRouting)
    printf 'outboundIdentity=not AKS-managed: use the effective default route and resolve the next-hop SNAT identity\n'
    ;;
  block)
    printf 'outboundIdentity=blocked by AKS: record any observed exception path instead of assuming public egress\n'
    ;;
  "")
    printf 'outboundIdentity=unknown: outboundType is unavailable\n'
    ;;
  *)
    printf 'outboundIdentity=unknown: unrecognized outboundType=%s\n' "$OUTBOUND_TYPE"
    ;;
esac

# Workload DNS/TCP evidence; use nc only when already present
kubectl exec "$POD" -n "$NS" -- \
  nslookup "$SQL_FQDN"
kubectl exec "$POD" -n "$NS" -- \
  nc -vz -w <timeout-seconds> "$SQL_FQDN" 1433

# Azure SQL public endpoint, service endpoint/VNet rule, private endpoint/DNS
az sql server show \
  --resource-group "$SQL_RG" \
  --name "$SQL_SERVER" \
  --query '{publicNetworkAccess:publicNetworkAccess,minimalTlsVersion:minimalTlsVersion}' \
  -o yaml
az sql server firewall-rule list \
  --resource-group "$SQL_RG" \
  --server "$SQL_SERVER" \
  --query '[].{name:name,startIpAddress:startIpAddress,endIpAddress:endIpAddress}' \
  -o table
az network vnet subnet show \
  --ids "$SOURCE_SUBNET_ID" \
  --query '{serviceEndpoints:serviceEndpoints,routeTable:routeTable.id,networkSecurityGroup:networkSecurityGroup.id}' \
  -o yaml
az sql server vnet-rule list \
  --resource-group "$SQL_RG" \
  --server "$SQL_SERVER" -o table
SQL_SERVER_ID=$(az sql server show \
  --resource-group "$SQL_RG" \
  --name "$SQL_SERVER" --query id -o tsv)
az network private-endpoint-connection list \
  --id "$SQL_SERVER_ID" -o table
az network private-dns zone show \
  --resource-group "$PRIVATE_DNS_RG" \
  --name privatelink.database.windows.net -o yaml
az network private-dns record-set a list \
  --resource-group "$PRIVATE_DNS_RG" \
  --zone-name privatelink.database.windows.net -o table
az network private-dns link vnet list \
  --resource-group "$PRIVATE_DNS_RG" \
  --zone-name privatelink.database.windows.net -o table

# Only when the selected next hop is an Azure Firewall
FIREWALL_RG="<firewall-resource-group>"
FIREWALL_NAME="<firewall-name>"
FIREWALL_POLICY_RG="<firewall-policy-resource-group>"
FIREWALL_POLICY_NAME="<firewall-policy-name>"
LOG_WORKSPACE="<log-analytics-workspace-id>"
az network firewall show \
  --resource-group "$FIREWALL_RG" \
  --name "$FIREWALL_NAME" \
  --query '{provisioningState:provisioningState,firewallPolicy:firewallPolicy.id,privateIPs:ipConfigurations[].privateIPAddress}' \
  -o yaml
FIREWALL_ID=$(az network firewall show \
  --resource-group "$FIREWALL_RG" \
  --name "$FIREWALL_NAME" --query id -o tsv)
if FIREWALL_PUBLIC_IP_IDS=$(az network firewall show \
  --resource-group "$FIREWALL_RG" \
  --name "$FIREWALL_NAME" \
  --query 'ipConfigurations[].publicIPAddress.id' -o tsv); then
  if [ -n "$FIREWALL_PUBLIC_IP_IDS" ]; then
    printf '%s\n' "$FIREWALL_PUBLIC_IP_IDS" |
    while IFS= read -r PUBLIC_IP_ID; do
      [ -n "$PUBLIC_IP_ID" ] || continue
      if FIREWALL_PUBLIC_IP=$(az network public-ip show \
        --ids "$PUBLIC_IP_ID" \
        --query '{id:id,ipAddress:ipAddress}' -o yaml); then
        if [ -n "$FIREWALL_PUBLIC_IP" ]; then
          printf '%s\n' "$FIREWALL_PUBLIC_IP"
        else
          printf 'firewallPublicIp=unknown: command=az network public-ip show succeeded with empty output; id=%s\n' \
            "$PUBLIC_IP_ID"
        fi
      else
        printf 'firewallPublicIp=inaccessible: command=az network public-ip show; id=%s\n' \
          "$PUBLIC_IP_ID"
      fi
    done
  else
    printf 'firewallPublicIpIds=absent\n'
    printf 'firewallPublicEgressIdentity=unknown: no data-plane public IP was returned\n'
  fi
else
  FIREWALL_PUBLIC_IP_IDS=""
  printf 'firewallPublicIpIds=inaccessible: command=az network firewall show; resourceGroup=%s; firewall=%s; query=ipConfigurations[].publicIPAddress.id\n' \
    "$FIREWALL_RG" "$FIREWALL_NAME"
  printf 'firewallPublicEgressIdentity=unknown: data-plane public IP lookup failed\n'
fi
FIREWALL_POLICY_ID=$(az network firewall show \
  --resource-group "$FIREWALL_RG" \
  --name "$FIREWALL_NAME" --query firewallPolicy.id -o tsv)
if [ -n "$FIREWALL_POLICY_ID" ]; then
  az network firewall policy show \
    --ids "$FIREWALL_POLICY_ID" -o yaml
  az network firewall policy rule-collection-group list \
    --resource-group "$FIREWALL_POLICY_RG" \
    --policy-name "$FIREWALL_POLICY_NAME" -o table
  az network firewall policy rule-collection-group list \
    --resource-group "$FIREWALL_POLICY_RG" \
    --policy-name "$FIREWALL_POLICY_NAME" \
    --query '[].name' -o tsv |
  while IFS= read -r RULE_COLLECTION_GROUP; do
    az network firewall policy rule-collection-group show \
      --resource-group "$FIREWALL_POLICY_RG" \
      --policy-name "$FIREWALL_POLICY_NAME" \
      --name "$RULE_COLLECTION_GROUP" -o json
  done
else
  az network firewall network-rule collection list \
    --resource-group "$FIREWALL_RG" \
    --firewall-name "$FIREWALL_NAME" -o json
  az network firewall application-rule collection list \
    --resource-group "$FIREWALL_RG" \
    --firewall-name "$FIREWALL_NAME" -o json
fi
az monitor diagnostic-settings list \
  --resource "$FIREWALL_ID" -o json
SOURCE_IP_KQL_LIST=""
LEGACY_SOURCE_PREDICATE=""
if [ -n "$SOURCE_POD_IP" ]; then
  SOURCE_IP_KQL_LIST="'$SOURCE_POD_IP'"
  LEGACY_SOURCE_PREDICATE="msg_s has '$SOURCE_POD_IP'"
fi
if [ -n "$SOURCE_NODE_IP" ]; then
  if [ -n "$SOURCE_IP_KQL_LIST" ]; then
    SOURCE_IP_KQL_LIST="$SOURCE_IP_KQL_LIST, '$SOURCE_NODE_IP'"
    LEGACY_SOURCE_PREDICATE="$LEGACY_SOURCE_PREDICATE or msg_s has '$SOURCE_NODE_IP'"
  else
    SOURCE_IP_KQL_LIST="'$SOURCE_NODE_IP'"
    LEGACY_SOURCE_PREDICATE="msg_s has '$SOURCE_NODE_IP'"
  fi
fi

if [ -n "$SOURCE_IP_KQL_LIST" ]; then
  az monitor log-analytics query \
    --workspace "$LOG_WORKSPACE" \
    --timespan "$INCIDENT_START/$INCIDENT_END" \
    --analytics-query "
union isfuzzy=true
  (AZFWNetworkRule
    | where _ResourceId =~ '$FIREWALL_ID'
    | where SourceIp in ($SOURCE_IP_KQL_LIST)
    | where DestinationIp == '$SQL_DESTINATION_IP'
    | where DestinationPort == 1433 and Protocol =~ 'TCP'
    | project TimeGenerated,LogTable='AZFWNetworkRule',Action,ActionReason,
        Protocol,SourceIp,Destination=DestinationIp,DestinationPort,
        RuleCollectionGroup,RuleCollection,Rule),
  (AZFWApplicationRule
    | where _ResourceId =~ '$FIREWALL_ID'
    | where SourceIp in ($SOURCE_IP_KQL_LIST)
    | where Fqdn =~ '$SQL_FQDN'
    | where DestinationPort == 1433 and Protocol in~ ('MSSQL', 'TCP')
    | project TimeGenerated,LogTable='AZFWApplicationRule',Action,ActionReason,
        Protocol,SourceIp,Destination=Fqdn,DestinationPort,
        RuleCollectionGroup,RuleCollection,Rule)
| order by TimeGenerated asc"
  az monitor log-analytics query \
    --workspace "$LOG_WORKSPACE" \
    --timespan "$INCIDENT_START/$INCIDENT_END" \
    --analytics-query "
AzureDiagnostics
| where _ResourceId =~ '$FIREWALL_ID'
| where Category in ('AzureFirewallNetworkRule','AzureFirewallApplicationRule')
| where $LEGACY_SOURCE_PREDICATE
| where msg_s has '$SQL_DESTINATION_IP' or msg_s has '$SQL_FQDN'
| where msg_s has '1433'
| where msg_s has 'TCP' or msg_s has 'MSSQL'
| extend Protocol=extract('^([A-Za-z]+) request',1,msg_s),
         Action=extract('Action: ([A-Za-z]+)',1,msg_s)
| project TimeGenerated,Category,Action,Protocol,msg_s
| order by TimeGenerated asc"
else
  printf 'firewallLogEvidence=incomplete: no proven nonempty pod or node source IP; source-scoped queries not run\n'
fi
```

Fill the placeholders and run this read-only block before narrowing the failure. For Azure CNI Pod Subnet, `SOURCE_SUBNET_ID` is the pod subnet; otherwise it is the node subnet. A successful empty NSG, route-table, NAT gateway, public-IP, or prefix association means that resource is absent; a failed lookup means the evidence is inaccessible or unknown and must not be recorded as absence. Inspect Firewall commands only when `VirtualAppliance` resolves to Azure Firewall; for an NVA, collect the equivalent selected route, network/application rules, and incident-window logs.

- Run `nc` only if it already exists in the affected pod; do not install packages or create a test pod.
- Set `SQL_DESTINATION_IP` to each address returned for the SQL FQDN from the affected pod and repeat the Firewall queries for every address used during the incident.
- **Public endpoint:** the server FQDN resolves to a public address; compare every collected load-balancer, NAT gateway, Azure Firewall, or other next-hop SNAT public IP/prefix with the SQL firewall ranges. For `userDefinedRouting` or `none`, do not conclude that a rule allows or denies the source until the selected effective route and next-hop SNAT identity are proven. Record an unknown identity or any command/permission failure as an evidence gap.
- **Service endpoint:** the FQDN remains public, while the source subnet advertises `Microsoft.Sql` and the SQL server has a matching virtual network rule.
- **Private endpoint:** the FQDN follows the `privatelink.database.windows.net` chain to the private endpoint IP; verify endpoint approval, the A record, the affected VNet link or conditional forwarder, and the effective route to that private IP.

Do not change SQL networking, DNS links/records, NSGs, UDRs, NetworkPolicy, NVA rules, or Azure Firewall policy until the failing path and blocking rule are identified and remediation is explicitly approved.

---

## Detailed Networking Guides

- [Load Balancer And Ingress Troubleshooting](load-balancer-and-ingress.md) for pending services, ingress controller state, backend routing, and TLS failures.
- [Network Policy Troubleshooting](network-policy.md) for default-deny checks, Azure NPM or Calico validation, and ingress or egress rule audits.
