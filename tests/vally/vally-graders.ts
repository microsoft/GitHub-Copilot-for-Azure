import type { GraderRegistry } from "@microsoft/vally";
import { JsonGrader } from "./json-grader.ts";
import { JavaUpgradeFileContentGrader } from "./java-upgrade-grader.ts";
import { ToolCallStartedGrader } from "./tool-call-started-grader.ts";

export function registerGraders(registry: GraderRegistry): void {
  registry.register(new JsonGrader());
  registry.register(new JavaUpgradeFileContentGrader());
  registry.register(new ToolCallStartedGrader());
}