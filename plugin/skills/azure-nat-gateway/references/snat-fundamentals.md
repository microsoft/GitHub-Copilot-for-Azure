# SNAT Fundamentals for Azure NAT Gateway

## What Is SNAT (Source Network Address Translation)?

SNAT is the process of rewriting the source IP address and source port of an outbound packet so that traffic from a private IP address can reach the public internet and return responses can be routed back to the correct origin.

When a virtual machine with private IP `10.0.1.4` sends a request to `api.example.com`, it cannot use its private address on the public internet. A SNAT device — such as NAT Gateway — replaces the source IP with a public IP (e.g., `20.50.100.10`) and assigns a unique source port. When the response arrives at `20.50.100.10:<port>`, NAT Gateway translates it back to `10.0.1.4` and delivers it to the VM.

This translation is stateful: NAT Gateway maintains a connection tracking table that maps each outbound flow to its original private source.

## SNAT Port Tuples

Every outbound connection through SNAT is identified by a **5-tuple**:

| Element | Description |
|---------|-------------|
| Source IP | The public IP assigned by NAT Gateway |
| Source port | The ephemeral port allocated by NAT Gateway (1,024–65,535) |
| Destination IP | The remote server's IP address |
| Destination port | The remote server's port (e.g., 443 for HTTPS) |
| Protocol | TCP or UDP |

Two connections can share the same source port **only if** they differ in at least one other tuple element. For example, connections to `10.10.10.1:443` and `10.10.10.2:443` from the same public IP can reuse the same source port because the destination IP differs.

This means the effective port capacity depends on how many unique destinations your workload communicates with. A workload connecting to many different destinations can reuse ports aggressively, while a workload funneling all traffic to a single destination IP and port consumes one unique port per connection.

## NAT Gateway SNAT Behavior

### On-Demand Port Allocation

NAT Gateway allocates SNAT ports **on demand** — ports are assigned when a connection is initiated and released when the connection terminates. There is no pre-allocation or static assignment per VM instance.

This is fundamentally different from Load Balancer SNAT:

| Behavior | NAT Gateway | Load Balancer SNAT |
|----------|-------------|-------------------|
| Allocation model | On-demand per flow | Pre-allocated per backend instance |
| Port pool | 64,512 per public IP, shared across all VMs on subnet | Divided among backend pool members |
| Scaling impact | Adding VMs does not reduce per-VM ports | Adding VMs reduces ports per instance |
| Unused ports | Available to any VM on the subnet | Wasted if instance is idle |

With NAT Gateway, all 64,512 ports on a public IP are available to any VM on the associated subnet. A single busy VM can consume many ports while idle VMs consume none. This dynamic sharing makes NAT Gateway far more efficient for variable workloads.

### Port Inventory per Public IP

Each public IP attached to NAT Gateway provides **64,512 SNAT ports** (ephemeral port range 1,024–65,535). With the maximum of 16 public IP addresses:

- **1 public IP**: 64,512 ports
- **4 public IPs**: 258,048 ports
- **16 public IPs**: 1,032,192 ports

You can also attach a **public IP prefix** instead of individual IPs. A /28 prefix provides 16 IPs and the maximum 1,032,192 ports, with the advantage of a contiguous IP range for firewall allowlisting.

## Connection Flow Walkthrough

Here is the complete path of an outbound connection through NAT Gateway:

### Outbound Path (VM → Internet)

1. **VM initiates connection**: Application on VM `10.0.1.4` opens a TCP connection to `api.example.com:443`.
2. **Subnet routing**: The subnet has NAT Gateway associated. Azure networking routes the outbound packet to NAT Gateway instead of the default internet path.
3. **SNAT translation**: NAT Gateway selects a public IP (e.g., `20.50.100.10`), allocates an available source port (e.g., `48372`), and rewrites the packet source to `20.50.100.10:48372`.
4. **Connection tracking**: NAT Gateway creates a flow entry: `10.0.1.4:54210 ↔ 20.50.100.10:48372 → api.example.com:443`.
5. **Packet forwarded to internet**: The translated packet reaches `api.example.com` with source `20.50.100.10:48372`.

### Return Path (Internet → VM)

6. **Response arrives**: `api.example.com` responds to `20.50.100.10:48372`.
7. **Reverse translation**: NAT Gateway looks up port `48372` in its flow table, finds it maps to `10.0.1.4:54210`.
8. **Packet delivered**: The response is rewritten with destination `10.0.1.4:54210` and delivered to the VM.

### NAT Gateway Supersedes Other Outbound Methods

When NAT Gateway is associated with a subnet, it takes priority over all other outbound configurations:

- Load Balancer outbound rules on that subnet are bypassed for internet traffic.
- Instance-level public IPs on VMs are not used for outbound (but still work for inbound).
- Default outbound access is overridden.

This means you get a single, predictable outbound IP (or set of IPs) for the entire subnet.

## Timer Behavior for TCP and UDP

### TCP Idle Timeout

- **Configurable**: 4 to 120 minutes (default: 4 minutes).
- **Reset on activity**: Any data transfer in either direction resets the idle timer.
- **Effect of expiry**: If the idle timer expires, NAT Gateway sends a TCP RST to both sides and reclaims the port.

Set idle timeout based on your workload. Long-lived connections (database connections, WebSocket proxies) may need higher values. Short-lived HTTP request/response patterns work well with the 4-minute default.

### TCP FIN Timer

- **Duration**: 120 seconds after a FIN is sent.
- **Purpose**: Allows the connection to complete its four-way TCP shutdown gracefully.
- **Port reclaim**: The SNAT port is held during this period and released after the timer expires or the full FIN/ACK exchange completes.

### TCP RST Timer

- **Duration**: 10 seconds after an RST is sent or received.
- **Purpose**: Brief hold to handle any in-flight packets before reclaiming the port.
- **Behavior**: This is the fastest port reclaim mechanism — an RST immediately signals connection termination.

### UDP Idle Timeout

- **Fixed**: 4 minutes — not configurable.
- **No connection state**: UDP is connectionless, so NAT Gateway uses the idle timer as the only mechanism to reclaim ports.
- **Best practice**: Applications using UDP should send periodic keepalives if they need the flow to persist beyond 4 minutes.

## SNAT Exhaustion

### What It Looks Like

SNAT exhaustion occurs when all available ports for a given destination are in use and no new connections can be established. Symptoms include:

- **Connection timeouts**: New outbound TCP connections fail with timeout errors.
- **HTTP 500 or 502 errors**: Application proxies and API gateways return server errors when they cannot establish backend connections.
- **Intermittent failures**: The problem appears and disappears as ports are allocated and released — busier periods hit the ceiling first.
- **Increased latency**: Connections may succeed but take longer as NAT Gateway waits for port availability.

### When It Happens

SNAT exhaustion is most likely when:

- A workload opens many simultaneous connections to the **same destination IP and port** (e.g., a single database endpoint or API).
- Application code leaks connections — sockets are opened but never properly closed.
- Microservices fan-out: a single request triggers dozens of outbound calls to other services.
- Retry storms: aggressive retries without exponential backoff create a flood of new connections.
- Low idle timeout with long-lived connections causes premature port reclaim followed by immediate reconnect pressure.

## Default Outbound Access Retirement

Azure is retiring default outbound access for VMs and VMSS:

- **New deployments** (after September 30, 2025): VMs created without explicit outbound connectivity will have no internet access by default.
- **Existing deployments**: Continue to work but are not recommended and receive no SLA.
- **Recommended action**: Associate a NAT Gateway, assign a VM-level public IP, or configure Load Balancer outbound rules.

NAT Gateway is the preferred migration path because it provides reliable, scalable, and predictable outbound access with a guaranteed SLA.

## Comparison: Outbound SNAT Methods

| Characteristic | NAT Gateway | Load Balancer SNAT | VM Public IP | Default Outbound |
|---------------|-------------|-------------------|-------------|-----------------|
| Port allocation | On-demand, shared pool | Pre-allocated per instance | All 64K ports per VM | Platform-managed |
| Ports per public IP | 64,512 | Max 1,024 per instance | 65,535 | Unknown/variable |
| Max public IPs | 16 | Multiple (varies) | 1 per VM | N/A |
| Static IP | Yes | Yes | Yes | No (unpredictable) |
| Zone resiliency | Yes (spans all zones) | Zone-dependent | Zone-dependent | No guarantee |
| SLA | Yes (99.99% for zonal deployment) | Part of LB SLA | Yes | No SLA |
| Inbound support | No | Yes | Yes | No |
| Subnet-level config | Yes | Backend pool | Per-VM | Implicit |
| Recommended for | All outbound workloads | Combined inbound + outbound | Single VMs, dev/test | Not recommended |

## Port Reuse and Recycling

NAT Gateway recycles ports as quickly as possible:

1. **Immediate reuse to different destinations**: A port released from one destination can be immediately used for a connection to a different destination IP or port — because the 5-tuple differs.
2. **Same-destination reuse**: A port used for a specific destination cannot be reused for the same destination until the relevant timer expires (idle timeout, FIN timer, or RST timer).
3. **TCP RST is fastest**: If your application can cleanly RST connections, ports are available in 10 seconds. FIN-based closure holds the port for up to 120 seconds.
4. **No TIME_WAIT buildup**: Unlike OS-level SNAT, NAT Gateway manages its own timers independently of the VM's TCP stack. The VM may show TIME_WAIT sockets, but NAT Gateway tracks port lifecycle separately.

## Best Practices

### Connection Management

- **Use connection pooling**: HTTP connection pools (keep-alive), database connection pools, and gRPC channel reuse dramatically reduce SNAT port consumption.
- **Close connections properly**: Ensure application code closes sockets in finally blocks or uses `using` / `with` patterns to prevent leaks.
- **Implement exponential backoff**: Retry storms are a leading cause of SNAT exhaustion — back off exponentially with jitter.

### Idle Timeout Configuration

- **Match your workload**: Set idle timeout to slightly longer than your application's expected idle period between requests on a persistent connection.
- **Don't set it to 120 minutes by default**: Excessively long timeouts hold ports unnecessarily and delay reclamation of abandoned connections.
- **Use TCP keepalives**: If connections must persist for long periods, enable TCP keepalives at the application or OS level to reset the idle timer without increasing the NAT Gateway idle timeout.

### Scaling

- **Start with 1 public IP**: 64,512 ports is sufficient for most workloads. Monitor `SNATConnectionCount` and `DroppedPackets` before adding more.
- **Add IPs proactively**: If SNAT usage consistently exceeds 50% of capacity, add another public IP before exhaustion occurs.
- **Use public IP prefixes**: If you need many IPs, a prefix provides a contiguous range that simplifies firewall rules on the remote side.

### Monitoring

- **Alert on DroppedPackets > 0**: Any dropped packets indicate SNAT exhaustion or NAT Gateway issues — this should trigger investigation.
- **Track SNATConnectionCount trends**: A steadily rising connection count without a corresponding workload increase suggests connection leaks.
- **Monitor DatapathAvailability**: Values below 100% indicate NAT Gateway health issues that need immediate attention.
