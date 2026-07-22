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

  test("does not describe a declarative toolbox lifecycle", async () => {
    const create = await readSkillFile("foundry-agent/create/create-hosted.md");
    const usage = await readSkillFile("foundry-agent/create/references/use-toolbox-in-hosted-agent.md");
    const deploy = await readSkillFile("foundry-agent/deploy/deploy.md");
    const cli = await readSkillFile("foundry-agent/azd-guidance/references/azd-ai-cli.md");
    const guidance = `${create}\n${usage}\n${deploy}\n${cli}`;

    expect(guidance).not.toContain("Does not create a toolbox");
    expect(guidance).not.toContain("host: azure.ai.toolbox");
    expect(guidance).not.toContain("kind: toolbox");
    expect(guidance).not.toContain("declaring the toolbox in `azure.yaml`");
    expect(guidance).not.toContain("connection/toolbox services");
  });
});

describe("foundry-agent toolbox sub-skill", () => {
  const TOOLBOX_ENTRY = "foundry-agent/toolbox/toolbox.md";

  test("lists the supported tool types", async () => {
    const toolbox = await readSkillFile(TOOLBOX_ENTRY);

    for (const type of [
      "mcp",
      "web_search",
      "azure_ai_search",
      "code_interpreter",
      "file_search",
      "openapi",
      "a2a_preview",
      "toolbox_search_preview",
    ]) {
      expect(toolbox).toContain(`\`${type}\``);
    }
  });

  test("every reference file linked from toolbox.md exists", async () => {
    const toolbox = await readSkillFile(TOOLBOX_ENTRY);

    const linked = [...toolbox.matchAll(/\]\((references\/[^)#]+\.md)/g)].map(
      (m) => m[1],
    );
    expect(linked.length).toBeGreaterThan(0);

    const unique = [...new Set(linked)];
    for (const relative of unique) {
      await expect(
        readSkillFile(`foundry-agent/toolbox/${relative}`),
      ).resolves.toBeTruthy();
    }
  });

  test("locks down the MCP endpoint facts", async () => {
    const toolbox = await readSkillFile(TOOLBOX_ENTRY);

    expect(toolbox).toContain("?api-version=v1");
    expect(toolbox).toContain("/toolboxes/{toolbox_name}/mcp?api-version=v1");
    expect(toolbox).toContain(
      "/toolboxes/{toolbox_name}/versions/{version}/mcp?api-version=v1",
    );
    expect(toolbox).toContain("https://ai.azure.com/.default");
  });

  test("locks down the tool-naming facts in mcp-protocol.md", async () => {
    const mcpProtocol = await readSkillFile(
      "foundry-agent/toolbox/references/mcp-protocol.md",
    );

    expect(mcpProtocol).toContain("{server_label}___{tool_name}");
    expect(mcpProtocol).toContain("three underscores");
  });
});
