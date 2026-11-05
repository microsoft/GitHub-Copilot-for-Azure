# Flex Consumption VNet outbound diagnostics fixture

This temporary shared fixture creates live Azure Functions networking evidence
for read-only Azure Diagnostics evaluations. It includes a private-storage
routing fault and deterministic public-dependency connection-pressure
telemetry. The resources are isolated in one resource group and use generated
names.

## Topology

- Linux Flex Consumption Function App (`FC1`, Functions v4, Node.js 22,
  2,048 MB) with a system-assigned identity and no always-ready instances.
- Standard LRS host/deployment storage with shared-key access disabled and
  public connectivity unchanged.
- Separate Standard LRS test storage containing `testdata/sample.txt`.
- VNet `10.42.0.0/16`.
  - Integration subnet `10.42.1.0/26`, delegated only to
    `Microsoft.App/environments`, with the route table attached.
  - Private endpoint subnet `10.42.2.0/27`, with route-table network policies
    enabled and the test-storage blob private endpoint.
- Private DNS zone for `privatelink.blob.core.windows.net`, linked to the VNet.
- Log Analytics and workspace-based Application Insights.

The Function App identity has the data-plane roles required by keyless host
storage and read-only access to the test blob. The workflow identity receives
only the test-storage role needed to seed the blob.

## Application

All endpoints require a function key:

- `/api/health` returns 200 without accessing test storage.
- `/api/read-blob` uses managed identity and the storage hostname to read
  `sample.txt`. It records the hostname, resolved IP, elapsed time, exception
  type, and correlation ID without logging tokens or connection strings.
- `/api/outbound-api` records bounded baseline, pressure, and recovery windows
  for calls to a public partner API. The pressure window reports high
  concurrency, nearly one new connection per request, low connection reuse,
  and `EADDRNOTAVAIL` or timeout failures without opening enough real
  connections to exhaust shared infrastructure.

Blob access uses bounded retries and timeouts so the injected routing failure
returns a logged 503 promptly.

## Provisioning and fault injection

The post-provision script:

1. Packages and remotely builds the Function app.
2. Seeds `sample.txt` through Entra authentication.
3. Disables public network access on test storage.
4. Warms the app and requires health=200.
5. Requires a successful blob read whose resolved IP matches the private
   endpoint and waits for its correlated Application Insights trace.
6. Records successful low-load, failed connection-pressure, and successful
   recovery windows for the public partner API, then waits for their correlated
   Application Insights traces.
7. Adds a `storage-path` route whose prefix is the endpoint's actual private
   IP `/32` and whose next hop is `None`.
8. Requires health=200, unchanged private DNS resolution, and read-blob=503.

Flex Consumption already sends VNet-integrated outbound traffic through the
VNet; the fixture intentionally does not configure Route All. It also avoids
Premium content-share settings and leaves host/deployment storage networking
unchanged.

## Safety and cost

The fault is limited to one private endpoint `/32`. Do not broaden the route:
that could disrupt host storage, deployment, or telemetry and obscure the
intended failure. Evaluations are read-only and must not remove the route or
modify resources.

The connection-pressure evidence is deterministic and bounded; it is not a
load generator and does not intentionally consume real SNAT capacity. Its
purpose is to make the application-level symptoms and connection-reuse pattern
queryable through live Application Insights while keeping CI stable.

The manifest uses temporary coordinated persistence so repetitions and
hill-climbing conditions can reuse the same failed fixture. The fixture
provisioner applies its normal expiration and cleanup controls. With zero
always-ready instances, the main ongoing costs are the storage, private
endpoint, Log Analytics, and Application Insights resources during the fixture
lifetime.
