import type { Grader, GraderInput, GraderMetadata, GraderRegistry, GraderResult } from "@microsoft/vally";
import { writeFile } from "node:fs/promises";
import * as path from "node:path";
import { azureRequest, text, verifyHostedAgent } from "./azure.ts";

export function liveContext(env: NodeJS.ProcessEnv) {
  if (env.VALLY_LIVE_AUTHORIZED !== "true" || env.VALLY_FAIR_COMPARISON !== "true") {
    throw new Error("Live Foundry verification requires compare:foundry-live --execute.");
  }
  return {
    subscription: text(env.VALLY_LIVE_SUBSCRIPTION, "VALLY_LIVE_SUBSCRIPTION"),
    group: text(env.VALLY_LIVE_RESOURCE_GROUP, "VALLY_LIVE_RESOURCE_GROUP"),
    owner: text(env.VALLY_LIVE_RUN_ID, "VALLY_LIVE_RUN_ID"),
    agentName: text(env.VALLY_LIVE_AGENT_NAME, "VALLY_LIVE_AGENT_NAME"),
    evidenceDir: text(env.VALLY_LIVE_EVIDENCE_DIR, "VALLY_LIVE_EVIDENCE_DIR"),
  };
}

export class FoundryLiveOutcomeGrader implements Grader {
  metadata: GraderMetadata = {
    name: "foundry-live-outcome",
    description: "Independently verify hosted deployment and remote hello-world response in the owned Azure group.",
    behavior: {}, determinism: "complex-static", reference: "reference-free",
    temporalScope: "trajectory-level", costProfile: "low",
  };

  async grade(input: GraderInput): Promise<GraderResult> {
    const context = liveContext(process.env);
    if (!input.trajectory) throw new Error("Missing trajectory for live verification.");
    let result: GraderResult;
    try {
      const evidence = await verifyHostedAgent(
        context.subscription, context.group, context.owner, context.agentName, azureRequest(context.subscription),
      );
      result = {
        name: this.metadata.name, kind: "code", passed: true, score: 1,
        evidence: "Independent ARM inspection confirmed a hosted agent; a remote Responses API invocation returned a hello-world greeting.",
        metadata: evidence,
      };
    } catch (error) {
      // Verification failure is an explicit failing grader, never a successful
      // empty result. Keep the agent trajectory for comparison and diagnosis.
      result = {
        name: this.metadata.name, kind: "code", passed: false, score: 0,
        evidence: error instanceof Error ? error.message : String(error),
      };
    }
    await writeFile(path.join(context.evidenceDir, "live-outcome.json"), JSON.stringify(result, null, 2));
    return result;
  }
}

export function registerGraders(registry: GraderRegistry): void {
  registry.register(new FoundryLiveOutcomeGrader());
}
