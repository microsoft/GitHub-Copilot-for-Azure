# Live AKS Evaluation Invocation Chain

## Complete invocation chain

```text
GitHub Actions workflow
    |
    v
npm run test:vally
    |
    v
tests\package.json
    |
    v
tests\run-vally-test.ts
    |
    v
@microsoft/vally-cli eval
    |
    v
eval.yaml + custom executor + graders
```

## 1. GitHub Actions workflow steps

File:

```text
.github\workflows\test-azure-diagnostics-live.yml
```

The job configures `tests` as the working directory around lines 50-53:

```yaml
defaults:
  run:
    working-directory: tests
```

That is why `npm run test:vally` uses `tests\package.json`.

The three scenario steps are in the same workflow:

| Scenario | Workflow lines |
|---|---:|
| CoreDNS scheduling | 158-169 |
| Missing Service endpoints | 171-182 |
| DNS NetworkPolicy | 184-195 |

For example, the CoreDNS workflow step is:

```yaml
- name: Test CoreDNS scheduling diagnosis
  id: coredns
  continue-on-error: true
  shell: bash
  run: |
    "$LIVE_SCENARIO_SCRIPT" setup coredns-scheduling
    trap '"$LIVE_SCENARIO_SCRIPT" cleanup coredns-scheduling' EXIT
    npm run test:vally -- \
      --eval-spec "$LIVE_EVAL_SPEC" \
      --tag liveScenario=coredns-scheduling \
      --workers 1 \
      --require-pass
```

This workflow step performs three operations:

1. Invokes `manage-scenario.sh setup`.
2. Registers `manage-scenario.sh cleanup` as an exit trap.
3. Invokes the npm Vally runner.

## 2. npm script

File:

```text
tests\package.json
```

Line 9:

```json
"test:vally": "npx tsx ./run-vally-test.ts"
```

Therefore:

```bash
npm run test:vally -- <arguments>
```

becomes approximately:

```bash
npx tsx ./run-vally-test.ts <arguments>
```

The `--` after `npm run test:vally` tells npm to forward the remaining arguments to `run-vally-test.ts`.

## 3. Vally wrapper

File:

```text
tests\run-vally-test.ts
```

This TypeScript file is the repository's wrapper around Vally.

At lines 285-300, it starts the Vally CLI:

```typescript
child = spawn("npx", [
  "-y",
  "@microsoft/vally-cli",
  "eval",
  ...args,
]);
```

On Windows it uses `cmd /c npx`, but GitHub Actions uses the non-Windows branch.

At lines 342-343, it registers the repository's custom executor and graders:

```typescript
forwardedArgs.splice(
  0,
  0,
  "--executor-plugin",
  path.join(__dirname, "vally", "vally-executor.ts"),
);

forwardedArgs.splice(
  0,
  0,
  "--grader-plugin",
  path.join(__dirname, "vally", "vally-graders.ts"),
);
```

The effective Vally command is similar to:

```bash
npx -y @microsoft/vally-cli eval \
  --executor-plugin tests/vally/vally-executor.ts \
  --grader-plugin tests/vally/vally-graders.ts \
  --output-dir ./results \
  --eval-spec ../evals/azure-skills/azure-diagnostics/live/eval.yaml \
  --tag liveScenario=coredns-scheduling \
  --workers 1 \
  --require-pass
```

## 4. Custom Vally executor

File:

```text
tests\vally\vally-executor.ts
```

This is the custom executor that Vally loads because `run-vally-test.ts` passes it through `--executor-plugin`.

It executes each selected stimulus through the configured agent runner and captures its trajectory.

## 5. Vally graders

File:

```text
tests\vally\vally-graders.ts
```

This file registers the repository's custom graders, including skill-invocation and shell-command-invocation checks.

## 6. Live eval specification

File:

```text
evals\azure-skills\azure-diagnostics\live\eval.yaml
```

The workflow points to this file through the environment variable at `.github\workflows\test-azure-diagnostics-live.yml:47`:

```yaml
LIVE_EVAL_SPEC: ../evals/azure-skills/azure-diagnostics/live/eval.yaml
```

The three stimuli are defined at:

| Scenario | Eval lines | Tag |
|---|---:|---|
| CoreDNS scheduling | 20-62 | `liveScenario: coredns-scheduling` |
| Missing Service endpoints | 64-89 | `liveScenario: missing-service-endpoints` |
| DNS NetworkPolicy | 91-116 | `liveScenario: dns-network-policy` |

The workflow selects exactly one stimulus per invocation:

```bash
--tag liveScenario=<scenario>
```

For example:

```bash
--tag liveScenario=coredns-scheduling
```

selects only the stimulus with this eval tag:

```yaml
liveScenario: coredns-scheduling
```

## 7. Fault setup and cleanup script

File:

```text
evals\azure-skills\azure-diagnostics\live\manage-scenario.sh
```

The workflow invokes this file immediately before running npm and Vally:

```bash
"$LIVE_SCENARIO_SCRIPT" setup <scenario>
```

It is invoked again by the shell trap when the workflow step exits:

```bash
"$LIVE_SCENARIO_SCRIPT" cleanup <scenario>
```

The workflow, not Vally, creates and cleans the fault. Vally runs the diagnostic prompt against the cluster after the bad state has been established.

```text
test-azure-diagnostics-live.yml
    |
    |-- manage-scenario.sh setup
    |
    |-- npm run test:vally
    |       |
    |       |-- tests\package.json
    |       |-- tests\run-vally-test.ts
    |       |-- @microsoft/vally-cli eval
    |       |-- tests\vally\vally-executor.ts
    |       `-- live\eval.yaml
    |
    `-- manage-scenario.sh cleanup through EXIT trap
```
