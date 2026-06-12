import type { GraderRegistry } from "@microsoft/vally";
import { JsonGrader } from "./json-grader.ts";
import { FileContentGrader } from "./file-content-grader.ts";

export function registerGraders(registry: GraderRegistry): void {
  registry.register(new JsonGrader());
  registry.register(new FileContentGrader());
}