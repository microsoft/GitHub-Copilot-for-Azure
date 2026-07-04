/**
 * Unit tests for hosted-agent toolbox reference paths.
 *
 * These tests lock down sample/doc paths that have moved in foundry-samples.
 */

import { readFile } from "fs/promises";
import path from "path";

const SKILL_NAME = "microsoft-foundry";

const readSkillFile = (relativePath: string) =>
  readFile(path.join(SKILLS_PATH, SKILL_NAME, relativePath), "utf-8");

describe("foundry-agent create toolbox reference paths", () => {
  test("uses current toolbox sample and docs paths", async () => {
    const reference = await readSkillFile("foundry-agent/create/references/use-toolbox-in-hosted-agent.md");

    expect(reference).toContain("samples/python/hosted-agents/agent-framework/responses/04-foundry-toolbox");
    expect(reference).toContain("samples/csharp/hosted-agents/agent-framework/foundry-toolbox-server-side");
    expect(reference).toContain("learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox#configure-tools");
  });

  test("does not reference removed toolbox sample paths", async () => {
    const reference = await readSkillFile("foundry-agent/create/references/use-toolbox-in-hosted-agent.md");

    expect(reference).not.toContain("samples/python/toolbox/maf");
    expect(reference).not.toContain("samples/python/toolbox/copilot-sdk");
    expect(reference).not.toContain("samples/python/toolbox/SUPPORTED_TOOLBOX_TOOLS.md");
  });
});
