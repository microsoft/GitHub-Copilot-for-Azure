# Evals

Skill evaluation suites run by [Vally](https://github.com/microsoft/evaluate) (`@microsoft/vally`). Each subdirectory corresponds to a skill and contains an `eval.yaml` defining stimuli, graders, and configuration.

Full docs: <https://aka.ms/vally>

> **You don't need access to the Vally source repo to run evals locally.** You only need the `@microsoft/vally` package from npm. If you need source access (e.g., to debug vally internals), reach out via <https://aka.ms/vally>.

## Prerequisites

Install the CLI globally, or invoke with `npx`:

```bash
npm install -g @microsoft/vally
# or, no install: use `npx @microsoft/vally ...` below
```

Authentication is handled automatically via your local `gh` CLI session. Environment variables (`COPILOT_GITHUB_TOKEN`) are only required in CI environments.

## Running a single eval spec

From the repo root:

```bash
npx @microsoft/vally eval \
  --eval-spec evals/azure-hosted-copilot-sdk/eval.yaml \
  --output-dir ./results \
  --output jsonl
```

## Running a suite

Suites are defined in [`.vally.yaml`](../.vally.yaml) at the repo root and filter across all `evals/**/eval.yaml` files.

```bash
npx @microsoft/vally eval --suite pr
npx @microsoft/vally eval --suite full
```

## Viewing results

After a run, check the output directory (default `./results`):

- `results.jsonl` — one JSON record per stimulus/run with grader outcomes.
- `eval-results.md` — human-readable summary.

## More info

- Vally docs: <https://aka.ms/vally>
- Vally source: <https://github.com/microsoft/evaluate>
- Suite definitions: [`.vally.yaml`](../.vally.yaml)
