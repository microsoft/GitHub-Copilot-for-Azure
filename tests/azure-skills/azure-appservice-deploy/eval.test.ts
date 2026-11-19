import { readdirSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { expect, test } from "vitest";
import { getRequiredSkillsCondition } from "../../vally/tag-helpers.ts";

type Tags = NonNullable<Parameters<typeof getRequiredSkillsCondition>[0]>;
interface EvalSuite {
  tags: Tags;
  stimuli: {
    tags?: Tags;
    graders: { type: string; config?: { required?: string[] } }[];
  }[];
}

const evalDir = new URL("../../../evals/azure-skills/azure-appservice-deploy/", import.meta.url);
const suites = readdirSync(evalDir).filter(file => file.endsWith(".yaml")).map(file => {
  const suite = parse(readFileSync(new URL(file, evalDir), "utf8")) as EvalSuite;
  return { file, suite };
});

test.each(suites)("$file protects the skills needed by its graders", ({ suite }) => {
  for (const stimulus of suite.stimuli) {
    const required = stimulus.graders
      .filter(grader => grader.type === "skill-invocation")
      .flatMap(grader => grader.config?.required ?? []);
    const protectedSkills = getRequiredSkillsCondition({ ...suite.tags, ...stimulus.tags });
    expect(protectedSkills).toEqual(
      expect.arrayContaining(["azure-appservice-deploy", ...required]),
    );
  }
});
