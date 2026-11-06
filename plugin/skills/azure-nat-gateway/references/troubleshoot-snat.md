# Troubleshoot NAT Gateway and SNAT Exhaustion

## Symptoms of SNAT Exhaustion

SNAT exhaustion occurs when all available SNAT ports on your NAT Gateway are in use and new outbound connections cannot be established. Recognizing the symptoms is the first step to resolution.

### Application-Level Symptoms

- **Intermittent connection timeouts**: Outbound HTTP requests or database connections sporadically fail with timeout errors. The failures are not constant — they correlate with traffic volume.
- **HTTP 500 or 502 errors**: If your application proxies outbound requests (e.g., an API gateway calling a backend), SNAT failures surface as server errors to clients.
- **Socket connection refused or reset**: TCP SYN packets are dropped silently — the application sees either a timeout (no response) or a connection reset.
- **Increased latency before failure**: Some connections succeed but take longer as NAT Gateway struggles to find available ports.
- **Partial outages**: Some VMs on the subnet experience failures while others work — this happens when a few VMs are consuming a disproportionate share of the SNAT port pool.

### Infrastructure-Level Symptoms

- **DroppedPackets metric > 0**: The most definitive indicator. NAT Gateway is actively dropping packets due to port exhaustion.
- **SNATConnectionCount near capacity**: Active connections plateauing near `64,512 × number_of_public_IPs`.
- **Failed connection state increasing**: The SNATConnectionCount metric with Connection State = Failed dimension shows rising failures.

## Diagnostic Steps

Follow these steps in order to diagnose NAT Gateway outbound connectivity problems.

### Step 1: Check NAT Gateway Metrics

Start with Azure Monitor metrics to confirm whether SNAT exhaustion is the cause.

```bash
# Check for dropped packets in the last hour
az monitor metrics list \
  --resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --metric DroppedPackets \
  --interval PT5M \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --aggregation Total

# Check active SNAT connections
az monitor metrics list \
  --resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --metric SNATConnectionCount \
  --interval PT5M \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --aggregation Maximum

# Check datapath availability
az monitor metrics list \
  --resource /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Network/natGateways/MyNATGateway \
  --metric DatapathAvailability \
  --interval PT5M \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --aggregation Average
```

**Interpretation**:
- DroppedPackets > 0 → SNAT exhaustion confirmed.
- SNATConnectionCount near capacity → exhaustion imminent or active.
- DatapathAvailability < 100% → platform issue, not SNAT exhaustion. Contact Azure support.

### Step 2: Verify NAT Gateway Subnet Association

A common misconfiguration is that the NAT Gateway exists but is not associated with the subnet where the VMs reside.

```bash
# Show NAT Gateway and its associated subnets
az network nat gateway show -g MyRG -n MyNATGateway --query '{name:name, subnets:subnets[].id}' -o json

# Show subnet configuration to verify NAT Gateway association
az network vnet subnet show -g MyRG --vnet-name MyVNet -n AppSubnet --query '{name:name, natGateway:natGateway.id}' -o json
```

If the subnet's `natGateway` field is null or points to the wrong NAT Gateway, traffic is not flowing through it.

```bash
# Associate NAT Gateway with the subnet
az network vnet subnet update -g MyRG --vnet-name MyVNet -n AppSubnet --nat-gateway MyNATGateway
```

### Step 3: Check Public IP Count and Calculate Available Ports

```bash
# List public IPs attached to the NAT Gateway
az network nat gateway show -g MyRG -n MyNATGateway \
  --query '{publicIps:publicIpAddresses[].id, publicPrefixes:publicIpPrefixes[].id}' -o json

# Count available ports
# Each public IP = 64,512 ports
# Each /28 prefix = 16 IPs = 1,032,192 ports
# Each /29 prefix = 8 IPs = 516,096 ports
# Each /30 prefix = 4 IPs = 258,048 ports
# Each /31 prefix = 2 IPs = 129,024 ports
```

### Step 4: Review Application Connection Patterns

SSH into a VM on the subnet and inspect active connections:

```bash
# Count established outbound connections (Linux)
ss -tn state established | wc -l

# Group connections by destination
ss -tn state established | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -20

# Count connections in TIME_WAIT
ss -tn state time-wait | wc -l

# Check for connections to a single destination (potential hotspot)
ss -tn state established dst 10.0.0.50 | wc -l
```

On Windows VMs:

```powershell
# Count established outbound connections
(Get-NetTCPConnection -State Established).Count

# Group by remote address
Get-NetTCPConnection -State Established | Group-Object RemoteAddress | Sort-Object Count -Descending | Select-Object -First 20
```

## Port Inventory Calculation

Estimate the SNAT ports your workload requires:

```
Required ports = (Connections per second) × (Average connection duration in seconds)
```

**Example**: An application makes 500 HTTP requests/sec to an API. Each request takes 200ms.

```
Required ports = 500 × 0.2 = 100 concurrent ports
```

This is well within a single public IP. But if the application has connection leaks and connections are never closed:

```
Leaked connections over 1 hour = 500/sec × 3,600 sec = 1,800,000 connections
```

This would exceed even the maximum 1,032,192 ports — the leaks, not the traffic volume, cause exhaustion.

**Rule of thumb**: If your calculation says you need more than 50,000 ports per public IP, investigate whether connections are being properly closed before adding more IPs.

## Common Causes

### 1. Connection Pool Leaks

**Symptom**: SNATConnectionCount steadily climbs over hours, never decreasing.

**Cause**: Application code opens HTTP clients, database connections, or sockets without closing them. Common in languages with garbage collection where developers assume connections are cleaned up automatically.

**Fix**:
```csharp
// BAD: Creates a new HttpClient per request, may not be disposed
var client = new HttpClient();
var response = await client.GetAsync(url);

// GOOD: Use IHttpClientFactory (ASP.NET Core) or a shared static instance
private static readonly HttpClient _client = new HttpClient();
var response = await _client.GetAsync(url);
```

```python
# BAD: Session never closed
session = requests.Session()
response = session.get(url)

# GOOD: Use context manager
with requests.Session() as session:
    response = session.get(url)
```

### 2. Microservice Fan-Out

**Symptom**: SNAT spikes correlate with specific API calls that trigger many downstream requests.

**Cause**: A single inbound request triggers 10-50 outbound calls to microservices. If the API receives 100 requests/sec, that creates 1,000-5,000 outbound connections/sec.

**Fix**:
- Use internal load balancers and private endpoints instead of going through NAT Gateway for internal service-to-service communication.
- Batch downstream requests where possible.
- Use async/await patterns to limit concurrent outbound connections.

### 3. Aggressive Retry Without Backoff

**Symptom**: SNAT spikes during downstream service outages or slow periods.

**Cause**: When a downstream service is slow or down, the application retries immediately and repeatedly, creating a flood of new connections that consume ports.

**Fix**:
- Implement exponential backoff with jitter.
- Use circuit breaker patterns (e.g., Polly in .NET, resilience4j in Java).
- Set maximum retry counts.

### 4. DNS Resolution Creating New Connections

**Symptom**: High connection turnover even though the application uses connection pooling.

**Cause**: DNS TTL expiry forces the HTTP client to close existing connections and open new ones to the resolved IP. Short DNS TTLs combined with many clients cause connection churn.

**Fix**:
- Configure appropriate DNS caching at the application level.
- Use connection pooling that supports DNS refresh without closing all connections.

## Resolution Steps

### Immediate: Add More Public IPs

The fastest way to relieve SNAT exhaustion is to attach additional public IPs:

```bash
# Create and attach a second public IP
az network public-ip create -g MyRG -n NATPublicIP2 --sku Standard --allocation-method Static
az network nat gateway update -g MyRG -n MyNATGateway \
  --public-ip-addresses NATPublicIP NATPublicIP2

# Or create a public IP prefix for bulk scaling
az network public-ip prefix create -g MyRG -n NATPrefix --length 30  # 4 IPs
az network nat gateway update -g MyRG -n MyNATGateway --public-ip-prefixes NATPrefix
```

Each additional public IP adds 64,512 ports. You can attach up to 16 IPs (1,032,192 total ports).

> **Important**: Adding IPs is a short-term fix. If connection leaks or poor connection management are the root cause, you will eventually exhaust even 16 IPs.

### Short-Term: Adjust Idle Timeout

If connections are idle for long periods and holding ports unnecessarily:

```bash
# Reduce idle timeout to release ports faster (minimum 4 minutes)
az network nat gateway update -g MyRG -n MyNATGateway --idle-timeout 4
```

If connections are being dropped prematurely and reopened:

```bash
# Increase idle timeout to prevent premature drops (maximum 120 minutes)
az network nat gateway update -g MyRG -n MyNATGateway --idle-timeout 30
```

### Long-Term: Fix Application Connection Management

- **Enable HTTP connection pooling**: Ensure `Keep-Alive` headers are set and HTTP clients reuse connections.
- **Use database connection pooling**: Configure minimum and maximum pool sizes appropriate for your workload.
- **Implement connection limits**: Set `MaxConnectionsPerServer` or equivalent to prevent any single destination from consuming all ports.
- **Close connections explicitly**: Do not rely on garbage collection or finalizers to close network connections.

### Long-Term: Reduce TIME_WAIT Accumulation

TCP connections in TIME_WAIT state hold SNAT ports for up to 120 seconds (the FIN timer). On Linux VMs:

```bash
# Check current TIME_WAIT count
ss -tn state time-wait | wc -l

# Enable TCP reuse (on the VM, not NAT Gateway)
sudo sysctl -w net.ipv4.tcp_tw_reuse=1

# Reduce FIN timeout at the OS level
sudo sysctl -w net.ipv4.tcp_fin_timeout=30
```

> **Note**: These OS settings affect the VM's local TCP stack, not NAT Gateway timers directly. However, faster local cleanup means the application can reconnect sooner using a new SNAT port.

## Network Watcher Tools

### Connection Troubleshoot

Test outbound connectivity from a VM through NAT Gateway:

```bash
az network watcher test-connectivity \
  --source-resource MyVM \
  --dest-address api.example.com \
  --dest-port 443 \
  --protocol TCP \
  -g MyRG
```

This shows whether the connection succeeds, the latency, and the number of hops. If NAT Gateway is not in the path, the subnet association is likely missing.

### NSG Flow Logs

Enable NSG flow logs to see outbound connection patterns:

```bash
az network watcher flow-log create \
  --location eastus \
  --name FlowLog-AppSubnet \
  --nsg MyNSG \
  --resource-group MyRG \
  --storage-account MyStorageAccount \
  --enabled true \
  --log-version 2 \
  --retention 30 \
  --traffic-analytics true \
  --workspace MyLogAnalyticsWorkspace
```

Flow logs show every connection attempt, including source/dest IPs and ports, whether the connection was allowed or denied, and the byte/packet counts.

### NSG Diagnostics

Verify that NSG rules are not blocking outbound traffic:

```bash
az network watcher show-security-group-view --resource-group MyRG --vm MyVM
```

Look for rules that deny outbound traffic on port 443, 80, or other ports your application uses.

## Verifying Outbound IP

Confirm that traffic is actually flowing through NAT Gateway by checking the outbound IP from a VM:

```bash
# From a Linux VM
curl -s ifconfig.me
curl -s ipinfo.io/ip
curl -s checkip.amazonaws.com

# From a Windows VM
Invoke-RestMethod -Uri "https://ifconfig.me"
(Invoke-WebRequest -Uri "https://api.ipify.org").Content
```

The returned IP should match one of the public IPs attached to your NAT Gateway. If it returns a different IP:

- NAT Gateway is not associated with the VM's subnet.
- The VM has an instance-level public IP that is being used for outbound (Note: NAT Gateway should supersede this, but verify the configuration).
- A User-Defined Route (UDR) is overriding the path and sending traffic through an NVA or VPN instead of NAT Gateway.

## Troubleshooting NAT Gateway Not Working

### Problem: NAT Gateway Associated But No Outbound Connectivity

**Check 1: Subnet association is correct**
```bash
az network vnet subnet show -g MyRG --vnet-name MyVNet -n AppSubnet --query natGateway.id -o tsv
```
Verify the output matches your NAT Gateway resource ID.

**Check 2: NSG is not blocking outbound**
```bash
# List NSG rules on the subnet and NIC
az network nsg rule list --nsg-name MyNSG -g MyRG -o table
```
Ensure no deny rules block outbound traffic on the required ports. The default NSG allows all outbound, but custom rules may override this.

**Check 3: UDR is not redirecting traffic**
```bash
az network route-table route list --route-table-name MyRouteTable -g MyRG -o table
```
If a route sends `0.0.0.0/0` to a virtual appliance or VPN gateway, traffic bypasses NAT Gateway. NAT Gateway only handles traffic that Azure networking routes to the internet gateway. A UDR with next-hop `Internet` works with NAT Gateway; a UDR with next-hop `VirtualAppliance` or `VirtualNetworkGateway` does not.

**Check 4: Public IP is Standard SKU**
```bash
az network public-ip show -g MyRG -n NATPublicIP --query sku.name -o tsv
```
Must be `Standard`. Basic SKU public IPs cannot be used with NAT Gateway.

**Check 5: NAT Gateway is in a healthy state**
```bash
az network nat gateway show -g MyRG -n MyNATGateway --query provisioningState -o tsv
```
Must be `Succeeded`. If it shows `Failed` or `Updating`, the NAT Gateway may be in an error state.

### Problem: Intermittent Outbound Failures Despite Low SNAT Usage

If SNATConnectionCount is well below capacity but connections still fail intermittently:

- **Check destination-side limits**: The remote server may be rate-limiting your IP or rejecting connections.
- **Check DNS resolution**: If DNS fails, the application cannot resolve the destination and the connection never reaches NAT Gateway.
- **Check TCP MSS / MTU issues**: Path MTU discovery failures can cause packets to be silently dropped. Ensure ICMP is not blocked by NSG rules.
- **Check application timeouts**: If the application timeout is shorter than NAT Gateway's processing time under load, the app may give up before the connection is established.

### Problem: VM Has No Outbound Connectivity At All

If a VM has zero outbound connectivity (not intermittent — completely blocked):

1. Verify the VM's subnet has NAT Gateway associated.
2. Verify the NSG allows outbound traffic (check both subnet NSG and NIC NSG).
3. Verify no UDR is sending all traffic to a black hole (non-existent NVA).
4. Verify the VM has a NIC that is connected and the NIC is in a `Succeeded` provisioning state.
5. Verify the VM itself is running and the guest OS network stack is healthy.
6. Test with `ping` to the Azure metadata endpoint `169.254.169.254` — this does not go through NAT Gateway and verifies basic VM networking is functional.

```bash
# Test Azure metadata (does not use NAT Gateway)
curl -s -H "Metadata:true" "http://169.254.169.254/metadata/instance?api-version=2021-02-01" | head -c 100

# If this works but internet fails, the issue is in the outbound path (NAT Gateway, NSG, or UDR)
# If this also fails, the issue is with the VM's basic networking (NIC, subnet, vnet)
```
