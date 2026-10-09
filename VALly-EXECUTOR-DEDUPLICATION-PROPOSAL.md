# Vally SDK Executor Deduplication Proposal

## Summary

`tests/vally/claude-sdk-executor.ts` and `tests/vally/copilot-sdk-executor.ts` duplicate almost the entire executor lifecycle:

- Parse stimulus tags and turns.
- Resolve the model, plugin, and required skills.
- Build `AgentRunConfig`.
- Provision and constrain Azure fixtures.
- Run an `IAgentRunner`.
- Convert metadata to a Vally trajectory.
- Write the Markdown report and run post-test scripts.
- Clean up the agent runner and Azure resource groups.
- Register an executor with Vally.

The meaningful differences are limited to:

| Concern | Claude executor | Copilot executor |
|---|---|---|
| Executor name | `claude-sdk-agent-runner` | `copilot-sdk-agent-runner` |
| Runner factory | `useClaudeAgentRunner` | `useAgentRunner` |
| Exported class | `ClaudeSdkExecutor` | `CopilotSdkAgentRunner` |

This makes the current design susceptible to behavior drift. Any change to fixture handling, skill selection, trajectory construction, reporting, or cleanup must be copied manually into both files.

## Recommended Design

Extract the shared implementation into a new module:

```text
tests/vally/sdk-agent-executor.ts
```

Keep the existing Claude and Copilot modules as thin adapters so their current module paths, exported classes, and registration entry points remain stable.

### Shared executor configuration

Define the SDK-specific variation explicitly:

```ts
import type { AgentRunnerConfig, IAgentRunner } from "../utils/agent-runner.ts";

export type SdkAgentExecutorConfig = {
  name: string;
  createRunner: (config: AgentRunnerConfig) => IAgentRunner;
};
```

If `AgentRunnerConfig` or `IAgentRunner` are not currently exported, export those existing types rather than introducing duplicate local interfaces.

### Shared executor class

Move the complete `execute` lifecycle and no-op `shutdown` implementation into one class:

```ts
export class SdkAgentExecutor implements Executor {
  readonly supportsMultiTurn = true;
  readonly supportsPreparedWorkspace = true;

  constructor(private readonly config: SdkAgentExecutorConfig) {}

  get name(): string {
    return this.config.name;
  }

  async execute(
    stimulus: Stimulus,
    options: ExecutorOptions,
  ): Promise<Trajectory> {
    // Existing shared implementation.
    const agentRunner = this.config.createRunner({
      testName: normalizedTestName,
    });
  }

  async shutdown(): Promise<void> {
    // no-op
  }
}
```

The shared class should own all behavior that is currently identical, including:

1. Model override resolution.
2. Tag parsing.
3. Plugin and required-skill resolution.
4. Multi-turn prompt splitting.
5. `AgentRunConfig` construction.
6. Fixture path containment validation.
7. Fixture provisioning and Azure scope injection.
8. Agent execution.
9. Trajectory and metric construction.
10. Markdown report creation.
11. Post-test script execution.
12. Resource-group cleanup.

### Thin Claude adapter

`tests/vally/claude-sdk-executor.ts` would retain its public class and registration function:

```ts
import type { ExecutorRegistry } from "@microsoft/vally";
import { useClaudeAgentRunner } from "../utils/claude-sdk-runner.ts";
import { SdkAgentExecutor } from "./sdk-agent-executor.ts";

export class ClaudeSdkExecutor extends SdkAgentExecutor {
  constructor() {
    super({
      name: "claude-sdk-agent-runner",
      createRunner: useClaudeAgentRunner,
    });
  }
}

export function registerExecutors(registry: ExecutorRegistry): void {
  registry.register(new ClaudeSdkExecutor());
}
```

### Thin Copilot adapter

`tests/vally/copilot-sdk-executor.ts` would become:

```ts
import type { ExecutorRegistry } from "@microsoft/vally";
import { useAgentRunner } from "../utils/copilot-sdk-runner.ts";
import { SdkAgentExecutor } from "./sdk-agent-executor.ts";

export class CopilotSdkAgentRunner extends SdkAgentExecutor {
  constructor() {
    super({
      name: "copilot-sdk-agent-runner",
      createRunner: useAgentRunner,
    });
  }
}

export function registerExecutors(registry: ExecutorRegistry): void {
  registry.register(new CopilotSdkAgentRunner());
}
```

This preserves the existing exported class names and registration behavior while reducing each SDK-specific file to its actual differences.

## Cleanup Semantics to Improve During Extraction

The shared implementation should preserve behavior initially, but extraction exposes one cleanup issue worth addressing in the same change because it affects both executors.

### Ensure runner cleanup on failures

Currently, `agentRunner.cleanup()` runs only after:

- `agentRunner.run` succeeds,
- trajectory conversion succeeds, and
- Markdown report creation succeeds.

If any of those operations throw, runner resources may remain allocated. Put runner cleanup in an inner `finally`:

```ts
let agentMetadata: AgentMetadata;
try {
  agentMetadata = await agentRunner.run(runConfig);
  // Convert events and create the report.
} finally {
  await agentRunner.cleanup();
}
```

Keep Azure fixture cleanup in the existing outer `finally`, because it has a different lifetime and honors `persistFixture`.

### Preserve the primary failure

If runner cleanup can fail, avoid replacing the original execution error with a cleanup error. Use the repository's preferred aggregate-error pattern or explicitly preserve the primary error.

Do not change the existing resource-group cleanup policy during the initial refactor: it intentionally suppresses deletion failures so they do not mask test results.

## Optional Follow-up Extraction

The following helpers could be extracted from the shared class after the first deduplication, but they are not required:

```ts
resolveRequiredSkillRefs(...)
splitStimulusPrompts(...)
buildAgentRunConfig(...)
provisionAzureFixture(...)
createTrajectory(...)
cleanupFixtureResourceGroups(...)
```

Keeping them as private functions in `sdk-agent-executor.ts` would make the lifecycle easier to unit test. Avoid creating many tiny modules; the primary goal is one shared executor implementation.

## Behavior That Must Remain Unchanged

- `MODEL_OVERRIDE` precedence over `options.model`.
- Default model remains `claude-sonnet-5`.
- `UV_CACHE_DIR` remains scoped to the prepared workspace.
- `VALLY_RUNNER_EXACT_SKILL` behavior remains unchanged.
- Prompt and follow-up ordering remains unchanged.
- Azure fixture paths remain constrained beneath the evaluated skill directory.
- Azure scope text is appended only to the initial prompt.
- Persisted fixtures are not deleted.
- Post-test scripts run only after a successful agent run and report generation.
- Executor names and exported class names remain stable.
- Vally registration remains one executor instance per adapter.
- Trajectory metadata and metrics retain their current shape.

## Suggested Tests

Add focused unit tests for the shared executor with a fake `IAgentRunner` and mocked fixture helpers:

1. Builds the same `AgentRunConfig` for both runner factories.
2. Splits `stimulus.turns` into the initial prompt and follow-ups.
3. Uses `stimulus.prompt` when turns are absent.
4. Resolves required skills and exact-skill mode correctly.
5. Rejects fixture paths escaping the skill fixture directory.
6. Appends the Azure scope prompt after provisioning.
7. Produces the expected trajectory output and metadata.
8. Calls runner cleanup after success.
9. Calls runner cleanup when execution, conversion, or report generation fails.
10. Deletes fixture resource groups unless the manifest requests persistence.
11. Runs the post-test script with the provision context.
12. Confirms both thin adapters register the expected executor names.

## Migration Plan

1. Add `tests/vally/sdk-agent-executor.ts` containing the shared implementation.
2. Add shared-executor unit tests using a fake runner.
3. Replace each existing executor body with its thin adapter.
4. Run:

   ```bash
   cd tests
   npm run typecheck
   npm run lint
   npm test
   ```

5. Run one Claude and one Copilot Vally evaluation to verify executor discovery, registration, fixture handling, reports, and trajectory output end to end.

## Expected Result

The refactor should remove roughly 150 duplicated lines from each adapter while centralizing all executor behavior in one tested implementation. Future changes to fixtures, skill selection, reporting, cleanup, or trajectory generation would then be made once rather than synchronized manually across two near-identical files.
