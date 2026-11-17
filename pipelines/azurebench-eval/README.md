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
3. The service connection (`serviceConnection`, default `azure_msbench_eval`)
   needs CES access to submit runs, Registry Owner/Editor rights to publish,
   and Reader on the benchmark if it is private. A run or publish that worked
   with your own account does not prove the pipeline identity is allowed.
4. Install the CES App on this GitHub repository so MSBench can check out the
   tasks.
5. If `useRunIdentity` is on (default), the run identity (BYOI) must already
   have the Azure access the test needs. Set its IDs as pipeline variables
   `RUN_IDENTITY_CLIENT_ID`, `RUN_IDENTITY_TENANT_ID` and
   `RUN_IDENTITY_SUBSCRIPTION_ID` on the `azurebench-eval` pipeline (they are
   not secrets, but are kept out of this public repo). BYOI is optional and only works on
   supported Corp Linux backends; turn it off for tests that don't need Azure.
   The pipelines do not create identities, roles or Registry permissions.

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

Fallback to `azure`: only if `azurebench` can't be used, and only on purpose.
Before that, confirm that `azure` is switched to owner-managed mode, that your
group is Owner, and that the CI identity has CES access and Registry Editor.
Publishing just this test as `azure@2.0.0` would replace the 17-task suite for
anyone who runs the bare name `azure` (it has no default tag, so the newest
version wins). While `azure` stays managed, the msbench-benchmarks
repository may republish its declared 1.0.2. Use separate `registry.json`/`dataset.jsonl` files with
`benchmark: azure`.

## Models

- `model`: MSBench model profile. It picks the model endpoint and auth only.
- `copilotModel`: model the Copilot CLI agent actually uses. The pipeline
  writes it to `model.env` as `COPILOT_AGENT_MODEL`. Change both together.

## Run

1. Queue `azurebench-eval` with **Submit** unchecked. It only builds and
   publishes the `agent-package` artifact; it does not contact MSBench.
2. Queue again with **Submit** checked. It waits for the run, prints the run
   ID, and publishes `events.jsonl` and `report.json` as the `results`
   artifact. The job fails unless all requested tasks are resolved.

Agent and benchmark code can read anything passed to the run. With BYOI on, the
pipeline sets `harbor.keepIdentityForRun=true`, which keeps the run identity
logged in while agent and grading code run, so they can use it. MSBench docs say
this tag is temporary and will be removed after November 2026; the Functions
test depends on it. Use only approved test identities and subscriptions;
deployment tests can create billable resources.

The Functions test passed (1/1) in a manual MSBench run from its original ADO
location. These pipelines have not published or run anything yet.