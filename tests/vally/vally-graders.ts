import type { GraderRegistry } from "@microsoft/vally";
import { JsonGrader } from "./json-grader.ts";
import { JavaUpgradeFileContentGrader } from "./java-upgrade-grader.ts";
import { ShellCommandInvokedGrader } from "./shell-command-invoked-grader.ts";
import { PendingQuestionGrader } from "./pending-question-grader.ts";

export function registerGraders(registry: GraderRegistry): void {
  registry.register(new JsonGrader());
  registry.register(new JavaUpgradeFileContentGrader());
  registry.register(new ShellCommandInvokedGrader());
  registry.register(new PendingQuestionGrader());
}