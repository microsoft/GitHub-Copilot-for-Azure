import {
  createDefaultGraderRegistry,
  type Grader, type GraderInput, type GraderMetadata, type GraderResult, type TrajectoryEvent,
} from "@microsoft/vally";
import { compileEarlyTerminatePattern } from "./tag-helpers.ts";

const ASK_USER = /(^|[._])ask_user$/i;
const toolCallsGrader = createDefaultGraderRegistry().get("tool-calls");

function callKey(event: Extract<TrajectoryEvent, { type: "tool_call" | "tool_result" }>): string {
  return JSON.stringify([event.agentId ?? null, event.data.toolCallId]);
}

/** Grade an intentionally unanswered ask_user without manufacturing a tool result. */
export class PendingQuestionGrader implements Grader {
  metadata: GraderMetadata = {
    name: "pending-question",
    description: "Checks a single pending ask_user and rejects forbidden tool attempts or unrelated unfinished calls.",
    behavior: { requiresLlmClient: false, requiresWorkspace: false },
    costProfile: "free",
    reference: "reference-free",
    temporalScope: "trajectory-level",
    determinism: "static",
  };

  async grade(input: GraderInput): Promise<GraderResult> {
    if (!input.trajectory) throw new Error("Missing trajectory");
    const stimulus = input.stimulus ?? input.trajectory.stimulus;
    if (stimulus.tags?.questionOnly !== "true") {
      throw new Error("pending-question requires the questionOnly: 'true' tag.");
    }
    const config = input.config ?? {};
    if (config.pattern !== undefined && typeof config.pattern !== "string") {
      throw new Error("pending-question pattern must be a string.");
    }
    const pattern = config.pattern === undefined ? undefined : compileEarlyTerminatePattern(config.pattern);
    if (!toolCallsGrader) throw new Error("Missing built-in tool-calls grader");
    // Vally checks completed forbidden calls; the pending-call guard rejects unfinished ones.
    const tools = await toolCallsGrader.grade({ ...input, config: { disallowed: config.disallowed } });
    const calls = input.trajectory.events.filter(event => event.type === "tool_call");
    const questions = calls.filter(event => ASK_USER.test(event.data.toolName));
    const pending = new Set<string>();
    const failures: string[] = [];

    for (const event of input.trajectory.events) {
      if (event.type === "tool_call") pending.add(callKey(event));
      if (event.type === "tool_result") pending.delete(callKey(event));
      if (event.type === "error") failures.push(`Unexpected error: ${event.data.message}`);
      if (event.type === "tool_result" && !event.data.success) failures.push(`Tool failed: ${event.data.toolName}`);
    }

    const question = questions[0];
    if (questions.length !== 1) {
      failures.push(`Expected exactly one ask_user call, found ${questions.length}.`);
    } else {
      const args = question.data.arguments;
      if (typeof args !== "object" || args === null || Array.isArray(args)
        || typeof args.question !== "string" || !args.question.trim()) {
        failures.push("ask_user must contain a non-empty question.");
      }
      if (pattern !== undefined && !pattern.test(JSON.stringify(args ?? {}))) {
        failures.push("Question arguments do not match the expected pattern.");
      }
      if (calls.at(-1) !== question || pending.size !== 1 || !pending.has(callKey(question))) {
        failures.push("Only the final ask_user call may remain pending; all earlier calls must be completed.");
      }
    }

    if (!tools.passed) failures.push(tools.evidence);
    const passed = failures.length === 0;
    return {
      name: this.metadata.name,
      kind: "code",
      passed,
      score: passed ? 1 : 0,
      evidence: passed
        ? "Expected question captured and left unanswered; no forbidden calls or unrelated unfinished calls."
        : failures.join("\n"),
      label: passed ? "correct" : "incorrect",
    };
  }
}
