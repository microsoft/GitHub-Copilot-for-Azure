<#
.SYNOPSIS
    Runs the read-only AKS cluster baseline diagnostic sweep and prints a single
    labeled digest instead of many raw command dumps.
.DESCRIPTION
    Gathers, in order:
      1. Cluster provisioning state          (az aks show)
      2. Node pool summary                   (az aks nodepool list)
      3. Recent Azure activity               (az monitor activity-log list)
      4. Node readiness                      (kubectl get nodes)
      5. Unhealthy pods across namespaces    (kubectl get pods -A, non-Running/Succeeded)
      6. kube-system health                  (kubectl get pods -n kube-system)
      7. Recent warning events               (kubectl get events -A)
      8. Namespace pod overview (optional)   (kubectl get pods -n <namespace>)

    All steps are READ-ONLY. Each step is guarded so a single failure (for example,
    kubectl not authenticated) prints a note and the sweep continues.
.PARAMETER ResourceGroup
    Resource group containing the AKS cluster.
.PARAMETER Cluster
    AKS cluster name.
.PARAMETER Namespace
    Optional namespace for an extra pod overview.
.PARAMETER Subscription
    Optional Azure subscription id. Defaults to the current subscription.
.EXAMPLE
    .\aks-baseline.ps1 -ResourceGroup my-rg -Cluster my-cluster
.EXAMPLE
    .\aks-baseline.ps1 -ResourceGroup my-rg -Cluster my-cluster -Namespace payments
#>
param(
    [Parameter(Mandatory)][Alias("g")][string]$ResourceGroup,
    [Parameter(Mandatory)][Alias("n")][string]$Cluster,
    [string]$Namespace,
    [string]$Subscription
)

$ErrorActionPreference = "Continue"

$azSubArgs = @()
if ($Subscription) { $azSubArgs = @("--subscription", $Subscription) }

function Write-Section($title) {
    Write-Host ""
    Write-Host "=============================================================="
    Write-Host "== $title"
    Write-Host "=============================================================="
}

function Invoke-Step($description, [scriptblock]$action) {
    try {
        & $action
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [!] Could not gather: $description (command failed or unavailable)"
        }
    } catch {
        Write-Host "  [!] Could not gather: $description ($($_.Exception.Message))"
    }
}

Write-Host "AKS baseline diagnostic sweep (read-only)"
Write-Host "Resource group: $ResourceGroup"
Write-Host "Cluster:        $Cluster"
if ($Namespace) { Write-Host "Namespace:      $Namespace" }

# 1. Cluster provisioning state ------------------------------------------------
Write-Section "1. Cluster provisioning state"
Invoke-Step "cluster provisioning state" {
    az aks show -g $ResourceGroup -n $Cluster @azSubArgs `
        --query "{name:name, provisioningState:provisioningState, powerState:powerState.code, k8sVersion:currentKubernetesVersion, fqdn:fqdn}" `
        -o table
}

# 2. Node pool summary ---------------------------------------------------------
Write-Section "2. Node pool summary"
Invoke-Step "node pool summary" {
    az aks nodepool list -g $ResourceGroup --cluster-name $Cluster @azSubArgs `
        --query "[].{name:name, mode:mode, count:count, vmSize:vmSize, state:provisioningState, powerState:powerState.code, k8sVersion:orchestratorVersion}" `
        -o table
}

# 3. Recent Azure activity -----------------------------------------------------
Write-Section "3. Recent Azure activity (last 20 events)"
Invoke-Step "recent activity log" {
    az monitor activity-log list -g $ResourceGroup @azSubArgs `
        --max-events 20 `
        --query "[].{time:eventTimestamp, operation:operationName.value, status:status.value, resource:resourceId}" `
        -o table
}

# 4. Node readiness ------------------------------------------------------------
Write-Section "4. Node readiness"
Invoke-Step "node readiness" { kubectl get nodes -o wide }

# 5. Unhealthy pods ------------------------------------------------------------
Write-Section "5. Unhealthy pods (not Running/Succeeded)"
Invoke-Step "unhealthy pods" {
    $unhealthy = kubectl get pods -A --field-selector="status.phase!=Running,status.phase!=Succeeded" 2>$null
    if ($unhealthy) {
        $unhealthy
    } else {
        Write-Host "  No unhealthy pods reported (or cluster unreachable)."
    }
}

# 6. kube-system health --------------------------------------------------------
Write-Section "6. kube-system health"
Invoke-Step "kube-system pods" { kubectl get pods -n kube-system -o wide }

# 7. Recent warning events -----------------------------------------------------
Write-Section "7. Recent warning events (last 40, sorted by time)"
Invoke-Step "warning events" {
    $events = kubectl get events -A --field-selector="type=Warning" --sort-by=.lastTimestamp 2>$null
    if ($events) { $events | Select-Object -Last 40 }
}

# 8. Namespace pod overview (optional) ----------------------------------------
if ($Namespace) {
    Write-Section "8. Pods in namespace '$Namespace'"
    Invoke-Step "pods in namespace $Namespace" { kubectl get pods -n $Namespace -o wide }
}

# Summary ----------------------------------------------------------------------
Write-Section "Summary"
Write-Host "Gathered the read-only AKS baseline for cluster '$Cluster' in resource group"
Write-Host "'$ResourceGroup': Azure-side cluster/node-pool state and recent activity, then"
Write-Host "Kubernetes-side node readiness, unhealthy pods, kube-system health, and recent"
Write-Host "warning events. Review the sections above for anomalies (non-Succeeded"
Write-Host "provisioning state, NotReady nodes, unhealthy or restarting pods, warning events)"
Write-Host "before deep-diving with 'kubectl describe' / 'kubectl logs' on a specific pod."
Write-Host ""
Write-Host "No changes were made to any resource."
