# Evals

Skill evaluation suites run by [Vally](https://github.com/microsoft/evaluate) (`@microsoft/vally-cli`). Each subdirectory corresponds to a skill and contains an `eval.yaml` defining stimuli, graders, and configuration.

Full docs: <https://aka.ms/vally>

> **You don't need access to the Vally source repo to run evals locally.** You only need the `@microsoft/vally-cli` package from GitHub Packages (see [Prerequisites](#prerequisites) below). If you need source access (e.g., to debug vally internals), reach out via <https://aka.ms/vally>.

## Prerequisites

`@microsoft/vally-cli` is published to GitHub Packages. You need a GitHub **Personal Access Token** with the `read:packages` scope.

1. Create a PAT: <https://github.com/settings/tokens> (classic) → enable `read:packages`.
2. Configure npm to use GitHub Packages for the `@microsoft` scope. Create or update `~/.npmrc`:

   ```ini
   @microsoft:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
   ```

3. Export your token:

   ```bash
   export GITHUB_PACKAGES_TOKEN=ghp_xxxxxxxxxxxx
   ```

4. Install the CLI (either globally, or invoke with `npx`):

   ```bash
   npm install -g @microsoft/vally-cli
   # or, no install: use `npx @microsoft/vally-cli ...` below
   ```

You will also need a `GITHUB_TOKEN` (Copilot-enabled) in your environment for the `copilot-sdk` executor used by most evals.

## Running a single eval spec

From the repo root:

```bash
npx @microsoft/vally-cli eval \
  --eval-spec evals/azure-hosted-copilot-sdk/eval.yaml \
  --output-dir ./results \
  --output jsonl
```

## Running a suite

Suites are defined in [`.vally.yaml`](../.vally.yaml) at the repo root and filter across all `evals/**/eval.yaml` files.

```bash
npx @microsoft/vally-cli eval --suite pr
npx @microsoft/vally-cli eval --suite full
```

## Viewing results

After a run, check the output directory (default `./results`):

- `results.jsonl` — one JSON record per stimulus/run with grader outcomes.
- `eval-results.md` — human-readable summary.

## More info

- Vally docs: <https://aka.ms/vally>
- Vally source: <https://github.com/microsoft/evaluate>
- Suite definitions: [`.vally.yaml`](../.vally.yaml)
