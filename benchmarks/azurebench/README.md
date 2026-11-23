# AzureBench

Harbor-native tasks published to the MSBench Registry as `azurebench`.

- `tasks/function_deployment_skill/`: the Azure Functions deployment task. It
  is a byte-identical copy of the proven pilot task from the ADO
  `msbench-benchmarks` repo (commit `38efd549`), except `tests/test.sh` is
  marked executable.
- `dataset.jsonl`: one row per task. `task_repo_commit` pins the commit that
  added the task files.
- `registry.json`: Registry metadata.

## Change a task or add one (two commits)

A commit can't contain its own ID, so:

1. Commit and push the task files.
2. Set `task_repo_commit` in `dataset.jsonl` to that commit's full SHA, bump
   the version you will publish, then commit and push again.

MSBench checks out tasks from GitHub with the CES App, which must be installed
on this repository. The pinned commit must be pushed to this repository.

Publish with [`pipelines/azurebench-release.yml`](../../pipelines/azurebench-release.yml)
and run with [`pipelines/azurebench-eval.yml`](../../pipelines/azurebench-eval.yml).
See [the pipeline README](../../pipelines/azurebench/README.md).