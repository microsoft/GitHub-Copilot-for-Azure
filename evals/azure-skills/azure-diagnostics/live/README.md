# Azure Diagnostics live AKS evaluations

These evaluations run against an isolated AKS cluster created from
[`infra/main.bicep`](infra/main.bicep). The manual workflow creates a new
resource group and cluster for every run, applies each reversible fault
sequentially, and deletes the resource group even when a test fails.

| Scenario | Controlled fault | Expected diagnosis |
| --- | --- | --- |
| CoreDNS scheduling | Taint every node and recreate CoreDNS pods | CoreDNS is Pending because no node tolerates the test taint |
| Missing Service endpoints | Give a Service a selector that does not match its Ready pod | The Service has no endpoints; CoreDNS remains healthy |
| DNS NetworkPolicy | Select one pod with an egress policy that omits port 53 | DNS is blocked only for the selected pod and namespace |

The scenarios are disruptive or incur Azure cost, so they are not loaded by
the normal nightly skill runner. To run them from a same-repository pull
request, add the `run-live-aks` label. Remove and re-add the label to start
another run. After the workflow is merged, it can also be started manually
from the Actions tab.

The workflow identity requires permission to create and delete resource groups,
deploy AKS, and obtain cluster admin credentials in the integration-test
subscription.
