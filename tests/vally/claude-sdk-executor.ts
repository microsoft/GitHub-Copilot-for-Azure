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

  async shutdown(): Promise<void> {
    // no-op
  }
}

export function registerExecutors(registry: ExecutorRegistry): void {
  registry.register(new ClaudeSdkExecutor());
}