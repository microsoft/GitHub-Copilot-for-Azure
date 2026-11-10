# Flex Consumption VNet routing fixture

This temporary shared fixture creates a live Azure Functions networking failure
for read-only Azure Diagnostics evaluations. The resources are isolated in one
resource group and use generated names.

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

Both endpoints require a function key:

- `/api/health` returns 200 without accessing test storage.
- `/api/read-blob` uses managed identity and the storage hostname to read
  `sample.txt`. It records the hostname, resolved IP, elapsed time, exception
  type, and correlation ID without logging tokens or connection strings.

Blob access uses bounded retries and timeouts so the injected routing failure
returns a logged 503 promptly.

## Provisioning and fault injection

All variants share the same Bicep and application. Small wrapper scripts select
one of three modes in `post-provision.ts`:

- `route-blackhole`: the original narrow `/32 -> None` route fault.
- `ambiguous-route`: harmless Function/storage tag updates and an unrelated
  `192.0.2.10/32 -> None` route precede the real private-endpoint route fault.
- `dns-unlinked`: the unrelated route is present, but the actual fault is
  removal of the test-storage private DNS zone's VNet link.

The shared post-provision logic:

1. Packages and remotely builds the Function app.
2. Seeds `sample.txt` through Entra authentication.
3. Disables public network access on test storage.
4. Warms the app and requires health=200.
5. Requires a successful blob read whose resolved IP matches the private
   endpoint and waits for its correlated Application Insights trace.
6. Applies the selected isolated fault and any scenario-specific decoys.
7. Requires health=200, the mode's expected DNS result, read-blob=503, and a
   correlated failure trace.

Flex Consumption already sends VNet-integrated outbound traffic through the
VNet; the fixture intentionally does not configure Route All. It also avoids
Premium content-share settings and leaves host/deployment storage networking
unchanged.

## Safety and cost

Routing faults are limited to one private endpoint `/32`; the DNS control
removes only the test-storage private zone's VNet link. Do not broaden either
fault: that could disrupt host storage, deployment, or telemetry and obscure
the intended failure. Evaluations are read-only and must not modify resources.

The manifest uses temporary coordinated persistence so repetitions and
hill-climbing conditions can reuse the same failed fixture. The fixture
provisioner applies its normal expiration and cleanup controls. With zero
always-ready instances, the main ongoing costs are the storage, private
endpoint, Log Analytics, and Application Insights resources during the fixture
lifetime.
