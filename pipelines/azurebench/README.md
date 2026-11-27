# AzureBench pipelines

Two manual Azure DevOps pipelines:

- [`../azurebench-release.yml`](../azurebench-release.yml) validates a
  benchmark release and, only when **Publish** is checked and the environment
  approval passes, publishes it to the MSBench Registry.
- [`../azurebench-eval.yml`](../azurebench-eval.yml) runs a published release
  with the GitHub Copilot CLI agent plus the Azure skills plugin, waits, and
  passes only if every requested task is resolved.

They are separate because releasing is rare, permanent and needs Registry
rights, while runs are frequent, can create billable Azure resources and need
CES submit rights. Publish a version once, then run it many times.

The defaults release and run `azurebench@1.0.0`, which contains one task, the
Azure Functions deployment test in
[`benchmarks/azurebench`](../../benchmarks/azurebench/README.md).

## What's in this folder

The YAML only installs tools and calls these scripts, so each step can be
read, tested and run on its own:

| Script | What it does |
| --- | --- |
| [`scripts/release.sh`](scripts/release.sh) | `validate` or `publish`: runs `check-release.py`, then `msbench-cli registry add benchmark` |
| [`scripts/check-release.py`](scripts/check-release.py) | Checks the metadata and dataset agree and every task pin is a pushed commit containing the task |
| [`scripts/build-agent.sh`](scripts/build-agent.sh) | Builds the agent package: the official Copilot CLI agent files plus [`agent/`](agent) |
| [`scripts/run-eval.sh`](scripts/run-eval.sh) | Picks the CAPI credentials and run identity, runs `msbench-cli run`, then `check-results.py` |
| [`scripts/check-results.py`](scripts/check-results.py) | Prints the run ID and passes only if every requested task is resolved |

Each script documents its inputs and exit codes at the top.

## Set up in Azure DevOps (once)

1. Create a YAML pipeline for each file.
2. Create the environment `azurebench-release` and add an approval check to it.
3. Both pipelines use the Azure service connection `azurebench_sc` (workload
   identity federation, managed identity `azurebench-ado-sc-wif`). Authorize it
   for both pipelines. Its identity needs CES access to submit runs, Registry
   Owner/Editor rights to publish, Reader on the benchmark if it is private,
   Get and List on the `azurebench-kv` secrets (for example **Key Vault
   Secrets User**), and access to MSBench's encryption service for
   `--encrypted-env`. A run or publish that worked with your own account does
   not prove the pipeline identity is allowed.
4. Install the CES App on this GitHub repository so MSBench workers can check
   out the tasks during an eval.
5. In Key Vault `azurebench-kv`, store our approved **test** CAPI integration
   ID and HMAC key as secrets `azurebench-capi-id` and `azurebench-capi-hmac`.
   Never put their values in YAML or pipeline parameters.
6. For BYOI runs, set pipeline variables `RUN_IDENTITY_CLIENT_ID`,
   `RUN_IDENTITY_TENANT_ID` and `RUN_IDENTITY_SUBSCRIPTION_ID` on the
   `azurebench-eval` pipeline (not secrets, but kept out of this public repo).
   The run identity must already have the Azure access the test needs.

To use different names, change the `serviceConnection` or `keyVaultName`
variable at the top of the YAML. The pipelines do not create identities,
roles, secrets or Registry permissions. The release pipeline never reads CAPI
secrets.

## Release

1. Change the task and dataset in two commits (see
   [`benchmarks/azurebench`](../../benchmarks/azurebench/README.md)) and push.
2. Queue `azurebench-release` with a new `version` and **Publish** unchecked.
   It checks the dataset and pins, then runs `--validate-only` (writes nothing).
3. Queue again with **Publish** checked and approve the environment.

The first publish creates the benchmark in owner-managed (`self`) mode. By
default it is private (`private` parameter); grant readers with
`msbench-cli registry permissions`.

## Run

1. Queue `azurebench-eval` with **Submit** unchecked. It only builds and
   publishes the `agent-package` artifact; it does not contact MSBench.
2. To submit, check both **Submit** and **Allow agent and benchmark code to
   read the CAPI credentials**; without that authorization the job fails
   before reading secrets. The run waits for completion, prints the run ID,
   and publishes `events.jsonl` and `report.json` as the `results` artifact.

`capi` picks the CAPI credentials. `CES_PROXY_BYPASS` is never used;
`run-eval.sh` always unsets it.

- `ours` (default): loads our integration ID and HMAC key from
  `azurebench-kv` and sends them with
  `--encrypted-env GITHUB_COPILOT_INTEGRATION_ID CAPI_HMAC_KEY`. The agent
  calls CAPI directly. Confirm model access and billing with the integration
  owner.
- `msbench`: sends no credentials. Because `CAPI_HMAC_KEY` is absent,
  `agent/runner.sh` uses the CES proxy with MSBench's `autodev-test`
  integration: the same endpoint, integration and `az` token scope MSBench
  generates for its built-in `msbench-default-index` (a custom runner skips
  that generation). No Key Vault. Use an `*-autodev-test` `model` label and
  set `copilotModel` to `sweagent-capi:claude-opus-4.5` (verified with
  `autodev-test`; the `claude-opus-5.5` default is not yet).

`useRunIdentity` (off by default) gives the run our Azure identity (BYOI).
MSBench confirmed our identity is allowlisted, so BYOI needs no bypass and
works with either option. BYOI also sets `harbor.keepIdentityForRun=true`,
which keeps the identity logged in while agent and grading code run. MSBench
says this tag is temporary (until after November 2026); the Functions test
depends on it.

Status (local `msbench-cli` submissions, no bypass):

- `msbench` + BYOI: passed (run 2026112402239264, `claude-opus-4.5`).
- `ours` without BYOI: the agent reached CAPI with `claude-opus-5.5`
  (run 2026112582202760); deployment failed only for lack of an identity.
- `ours` + BYOI: fails before the agent starts. MSBench's "Mint GitHub App
  Token" step for the task checkout gets an empty `private-key` (runs
  2026112579687372, 2026112582191068). The earlier cache-image pull error is
  non-fatal. Needs MSBench to investigate.

Use `ours` in pipeline runs once `ours` + BYOI passes locally.

Models: `model` is the MSBench label; with our custom runner it does not
configure the endpoint. `copilotModel` is what the Copilot CLI agent actually
uses (`COPILOT_AGENT_MODEL` in `model.env`). Keep them consistent. With
`ours`, `copilotModel` must be a model our integration can use (its CAPI
`/models` list): the default `claude-opus-5.5` is; `claude-opus-4.5` is not
and fails with HTTP 400.

Encryption protects transport, not against the agent and benchmark code,
which can read the credentials and use the run identity. Use only approved,
least-privilege test credentials, identities and subscriptions; deployment
tests can create billable resources.

The Functions test passed (1/1) in a manual MSBench run from its original ADO
location. No eval has completed through these pipelines yet.

## Test the scripts locally

With the pinned MSBench CLI installed and bash on `PATH`, run from the
repository root:

```bash
python -m unittest discover -s pipelines/azurebench -p test_pipeline.py -v
```

The tests run the real scripts against a stub `msbench-cli` with dummy values;
nothing is submitted or published.