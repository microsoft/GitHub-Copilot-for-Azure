# AzureBench eval pipeline

[`../azurebench-eval.yml`](../azurebench-eval.yml) manually runs one MSBench
Harbor benchmark with the GitHub Copilot CLI agent plus the Azure skills plugin.
It is generic: pick the benchmark, dataset, agent scripts, model and run identity
as pipeline parameters. The defaults run the example below.

## Files

- `agent/`: our agent scripts. `setup.sh` installs the `azure@azure-skills`
  plugin; `runner.sh` runs the official Copilot CLI runtime. At run time the
  pipeline adds the official files from `msbench-agent-github-copilot-cli prepare`.
- `datasets/azure-functions-deployment.jsonl`: example one-row dataset. It
  points to a Harbor task pinned to a commit in the ADO `msbench-benchmarks`
  repo. To run another test, add a dataset row and change `benchmark`/`dataset`.

## Set up in Azure DevOps (once)

1. Create a YAML pipeline from `pipelines/azurebench-eval.yml`.
2. Make sure the submitting service connection (`serviceConnection`, default
   `azure_msbench_eval`) is allowed to submit to the CES backend. A run that
   worked with your own account does not prove the pipeline identity is allowed.
3. The run identity (BYOI) must already have the Azure access the test needs.
   The pipeline does not create identities or role assignments.

## Run

1. Queue the pipeline with **Submit** unchecked. It only builds and publishes the
   `agent-package` artifact, so you can inspect it.
2. Queue again with **Submit** checked to send the run (`--no-wait`). Track it
   on the MSBench site.

Agent and benchmark code can read anything passed to the run. Use only approved
test identities and subscriptions; deployment tests can create billable resources.

The example's settings come from a successful manual MSBench run
(1/1 resolved). This pipeline itself has not submitted a run yet.