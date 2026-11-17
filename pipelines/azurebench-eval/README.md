# AzureBench pipelines

Two manual Azure DevOps pipelines:

- [`../azurebench-release.yml`](../azurebench-release.yml) validates a
  benchmark release and, only when **Publish** is checked and the environment
  approval passes, publishes it with `msbench-cli registry add benchmark`.
- [`../azurebench-eval.yml`](../azurebench-eval.yml) runs a published release
  with the GitHub Copilot CLI agent plus the Azure skills plugin, waits, and
  passes only if every requested task is resolved.

They are separate because releasing is rare, permanent and needs Registry
rights, while runs are frequent, can create billable Azure resources and need
CES submit rights. Publish a version once, then run it many times.

Both are generic: the benchmark, version, files, model and run identity are
parameters. The defaults release and run `azurebench@1.0.0`, which contains one
task, the Azure Functions deployment test in
[`benchmarks/azurebench`](../../benchmarks/azurebench/README.md).

## Set up in Azure DevOps (once)

1. Create a YAML pipeline for each file.
2. Create the environment `azurebench-release` and add an approval check to it.
3. Create and authorize a **new** Azure service connection. The example
   default name is `azurebench_msbench`; select the actual name using the
   `serviceConnection` parameter if different. Its identity needs CES access
   to submit runs, Registry Owner/Editor rights to publish, and Reader on the
   benchmark if it is private. Release validation also uses the connection;
   the eval package-only run does not. A run or publish that worked with your
   own account does not prove the pipeline identity is allowed.
4. Install the CES App on this GitHub repository so MSBench workers can check
   out the tasks during an eval.
5. If `useRunIdentity` is on (default), the run identity (BYOI) must already
   have the Azure access the test needs. Set its IDs as pipeline variables
   `RUN_IDENTITY_CLIENT_ID`, `RUN_IDENTITY_TENANT_ID` and
   `RUN_IDENTITY_SUBSCRIPTION_ID` on the `azurebench-eval` pipeline (they are
   not secrets, but are kept out of this public repo). BYOI is optional and only works on
   supported Corp Linux backends; turn it off for tests that don't need Azure.
6. For eval submission, create a new Key Vault (the default name is
   `azurebench-kv`, if available) and add your approved **test** CAPI
   integration ID and HMAC key as secrets named `azurebench-capi-id` and
   `azurebench-capi-hmac`. Do not put their values in YAML or pipeline
   parameters. Change `keyVaultName`, `capiIdSecret`, and `capiHmacSecret` if
   your actual names differ. Select a service connection for the vault with
   `keyVaultServiceConnection`; it defaults to `azurebench_msbench` but can
   differ from the MSBench submitter connection. Grant its identity vault
   secret Get and List access, for example the **Key Vault Secrets User** role
   on an Azure RBAC vault, and allow the build agent network access to the
   vault. The MSBench submitter also needs access to MSBench's encryption
   service for `--encrypted-env`.

The pipelines do not create identities, roles, secrets, or Registry
permissions. The release pipeline never reads CAPI secrets.

## Release

1. Change the task and dataset in two commits (see
   [`benchmarks/azurebench`](../../benchmarks/azurebench/README.md)) and push.
2. Queue `azurebench-release` with a new `version` and **Publish** unchecked.
   It checks that the dataset and metadata match, that each pinned commit is
   pushed and contains the task, then runs `--validate-only` (writes nothing).
3. Queue again with **Publish** checked and approve the environment.

The first publish creates the benchmark in owner-managed (`self`) mode. By
default it is private (`private` parameter); grant readers with
`msbench-cli registry permissions`.

## Models

- `model`: MSBench model label. With the custom runner it does not configure
  the endpoint or authentication.
- `copilotModel`: model the Copilot CLI agent actually uses. The pipeline
  writes it to `model.env` as `COPILOT_AGENT_MODEL`. Keep the label consistent.

For a submitted eval, `AzureKeyVault@2` retrieves only the two configured
secrets. The pipeline maps them to `GITHUB_COPILOT_INTEGRATION_ID` and
`CAPI_HMAC_KEY` and uses `--encrypted-env` to deliver them to MSBench. This
uses your integration rather than the workflow-managed HMAC option; confirm
the integration's model access and billing arrangement with its owner.

## Run

1. Queue `azurebench-eval` with **Submit** unchecked. It only builds and
   publishes the `agent-package` artifact; it does not contact MSBench.
2. Before submitting, confirm the Key Vault and service connections, then
   check both **Submit** and **Allow agent and benchmark code to read these
   test CAPI credentials**. Submission without that authorization fails
   before reading secrets. The run waits for completion, prints the run ID,
   and publishes `events.jsonl` and `report.json` as the `results` artifact.
   The job fails unless all requested tasks are resolved.

Encryption protects transport, not against the agent and benchmark code,
which can read the credentials. Use only approved, least-privilege test
credentials. With BYOI on, the
pipeline sets `harbor.keepIdentityForRun=true`, which keeps the run identity
logged in while agent and grading code run, so they can use it. MSBench docs say
this tag is temporary and will be removed after November 2026; the Functions
test depends on it. Use only approved test identities and subscriptions;
deployment tests can create billable resources.

The Functions test passed (1/1) in a manual MSBench run from its original ADO
location. These pipelines have not published or run anything yet.

To check the eval pipeline's credential gates locally, install the pinned
MSBench CLI and run `python -m unittest discover -s pipelines/azurebench-eval -p test_pipeline.py`
from the repository root. This test uses dummy values and does not submit a run.