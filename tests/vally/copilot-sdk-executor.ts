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

  async shutdown(): Promise<void> {
    // no-op
  }
}

export function registerExecutors(registry: ExecutorRegistry): void {
  registry.register(new CopilotSdkAgentRunner());
}
