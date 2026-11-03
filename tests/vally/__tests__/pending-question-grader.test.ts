import { readFileSync } from "node:fs";
import {
  computeMetrics, createDefaultGraderRegistry,
  type GraderInput, type Stimulus, type TrajectoryEvent,
} from "@microsoft/vally";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { PendingQuestionGrader } from "../pending-question-grader.ts";
import { registerGraders } from "../vally-graders.ts";

type ToolCall = Extract<TrajectoryEvent, { type: "tool_call" }>;
const questionArgs = {
  question: "When should the selected resources return?",
  choices: ["One week", "One month", "Choose a date and time", "Cancel"],
};
const config = {
  pattern: "(?is)^(?=.*one week)(?=.*one month)(?=.*choose a date and time)(?=.*cancel).*$",
  disallowed: [{
    name: "(?i)advisor_recommendation_(summary|list|prevalidate|update)",
  }],
};

function call(toolName = "ask_user", args: ToolCall["data"]["arguments"] = questionArgs, id = "question"): ToolCall {
  return { type: "tool_call", data: { toolName, toolCallId: id, arguments: args } };
}

function result(tool: ToolCall, success = true): TrajectoryEvent {
  return {
    type: "tool_result",
    agentId: tool.agentId,
    data: { toolName: tool.data.toolName, toolCallId: tool.data.toolCallId, success, result: "done" },
  };
}

function input(events: TrajectoryEvent[], graderConfig: Record<string, unknown> = config): GraderInput {
  return {
    config: graderConfig,
    trajectory: {
      id: "pending-question-test",
      stimulus: { name: "pending question", prompt: "Ask without answering.", tags: { questionOnly: "true" } },
      events,
      metrics: computeMetrics(events),
      output: "",
      workDir: "",
      metadata: { model: "test", skillsLoaded: [], executor: "test", sessionID: "test" },
    },
  };
}

describe("PendingQuestionGrader", () => {
  const grader = new PendingQuestionGrader();

  test("passes an unanswered question after completed calls without mutating events", async () => {
    const read = call("view", { path: "SKILL.md" }, "read");
    const events = [read, result(read), call()];
    const before = structuredClone(events);
    expect(await grader.grade(input(events))).toMatchObject({ passed: true, score: 1 });
    expect(events).toEqual(before);
    expect(events.filter(event => event.type === "tool_result")).toHaveLength(1);
  });

  test("rejects missing, answered or incorrect questions", async () => {
    expect((await grader.grade(input([]))).passed).toBe(false);
    const question = call();
    expect((await grader.grade(input([question, result(question)]))).passed).toBe(false);
    expect((await grader.grade(input([question, call("ask_user", questionArgs, "second")]))).passed).toBe(false);
    expect((await grader.grade(input([call("ask_user", { ...questionArgs, question: "" })]))).passed).toBe(false);
    expect((await grader.grade(input([call("ask_user", {
      ...questionArgs, choices: ["One week", "Cancel"],
    })]))).passed).toBe(false);
  });

  test("rejects forbidden attempts, unrelated unfinished calls and errors", async () => {
    const update = call("Azure.advisor_recommendation_update", {}, "update");
    const read = call("view", { path: "SKILL.md" }, "read");
    for (const events of [
      [update, call()], [update, result(update), call()], [read, call()],
      [call(), read, result(read)], [read, result(read, false), call()],
      [{ type: "error", data: { message: "Session failed" } }, call()] satisfies TrajectoryEvent[],
    ]) {
      expect((await grader.grade(input(events))).passed).toBe(false);
    }
  });

  test("registers separately without weakening ordinary Vally sequence grading", async () => {
    const registry = createDefaultGraderRegistry();
    const ordinary = registry.get("tool-calls");
    registerGraders(registry);
    expect(registry.get("pending-question")).toBeInstanceOf(PendingQuestionGrader);
    expect(registry.get("tool-calls")).toBe(ordinary);
    if (!ordinary) throw new Error("Missing built-in tool-calls grader");
    await expect(ordinary.grade(input([call()], { sequence: [{ name: "ask_user" }] })))
      .rejects.toThrow("dangling tool_call");
    const question = call();
    expect((await ordinary.grade(input([question, result(question)], { sequence: [{ name: "ask_user" }] }))).passed)
      .toBe(true);
    const testInput = input([question]);
    testInput.stimulus = { name: "ordinary evaluation", prompt: "Finish normally." };
    await expect(grader.grade(testInput)).rejects.toThrow("questionOnly");
  });

  test("wires only the four question-only cases to the new grader with their existing constraints", async () => {
    const suite: { stimuli: Stimulus[] } = parse(readFileSync(new URL(
      "../../../evals/azure-advisor/azure-advisor-cost-optimization/eval.yaml", import.meta.url,
    ), "utf8"));
    const cases = suite.stimuli.filter(stimulus => stimulus.tags?.questionOnly === "true");
    expect(cases).toHaveLength(4);
    expect(suite.stimuli.filter(stimulus =>
      stimulus.graders?.some(entry => entry.type === "pending-question"))).toHaveLength(4);
    for (const stimulus of cases) {
      const entry = stimulus.graders?.find(entry => entry.type === "pending-question");
      expect(entry).toBeDefined();
      expect(stimulus.graders?.some(entry => entry.type === "tool-calls" || entry.type === "completed")).toBe(false);
      const learn = call("advisor", { command: "advisor_recommendation_update", learn: true }, "learn");
      const testInput = input([learn, result(learn), call("functions.ask_user", {
        question: "Which resources should return on a date and time in UTC?",
        choices: questionArgs.choices.map(choice => choice.replace("a date", "a specific date")),
      })], entry?.config);
      testInput.stimulus = stimulus;
      expect((await grader.grade(testInput)).passed).toBe(true);
      const update = call("advisor_recommendation_update", {}, "update");
      if (!testInput.trajectory) throw new Error("Missing test trajectory");
      testInput.trajectory.events.unshift(update, result(update));
      expect((await grader.grade(testInput)).passed).toBe(false);
    }
  });
});
