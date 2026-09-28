import type { AgentRunConfig } from "../agent-runner.ts";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAgentRunner } from "../agent-runner.ts";
import { tmpdir } from "node:os";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const sdk = vi.hoisted(() => {
  const session = {
    on: vi.fn(() => vi.fn()), sendAndWait: vi.fn(async () => undefined),
    abort: vi.fn(async () => {}), disconnect: vi.fn(async () => {}),
    rpc: {
      tools: { initializeAndValidate: vi.fn(async () => ({})) },
      skills: { list: vi.fn(async () => ({ skills: [] as { name: string; path: string; enabled: boolean }[] })) },
      mcp: { list: vi.fn(async () => ({ servers: [] as { name: string }[] })) },
    },
  };
  return { session, createSession: vi.fn(async (_config: unknown) => session), stop: vi.fn(async () => {}), clientOptions: vi.fn() };
});

vi.mock("@github/copilot-sdk", () => ({
  CopilotClient: class {
    createSession = sdk.createSession;
    stop = sdk.stop;
    constructor(options: unknown) { sdk.clientOptions(options); }
  },
  RuntimeConnection: { forStdio: vi.fn() },
  approveAll: vi.fn(),
}));

describe("Copilot comparison session wiring", () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(path.join(tmpdir(), "vally-auth-fixture-"));
    writeFileSync(path.join(home, "config.json"), "// Auth configuration supports comments.\n" + JSON.stringify({
      lastLoggedInUser: { login: "fixture" }, loggedInUsers: [{ login: "fixture" }],
      installedPlugins: ["unrelated"], staff: true,
    }));
    vi.stubEnv("COPILOT_HOME", home);
    vi.stubEnv("NO_SKILLS", "false");
    vi.stubEnv("VALLY_RUNNER_DISABLE_AZURE_MCP", "false");
    sdk.session.sendAndWait.mockResolvedValue(undefined);
    sdk.session.rpc.skills.list.mockResolvedValue({ skills: [] });
    sdk.session.rpc.mcp.list.mockResolvedValue({ servers: [] });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(home, { recursive: true, force: true });
  });

  test.each<NonNullable<AgentRunConfig["mcpServers"]>>([
    {},
    { fixture: { type: "stdio", command: "node", args: ["fixture.js"], tools: ["*"] } },
  ])("uses the supplied MCP set without implicitly adding Azure: %j", async mcpServers => {
    sdk.session.rpc.mcp.list.mockResolvedValue({ servers: Object.keys(mcpServers).map(name => ({ name })) });
    sdk.createSession.mockImplementationOnce(async config => {
      const options = config as { configDirectory: string };
      expect(JSON.parse(readFileSync(path.join(options.configDirectory, "config.json"), "utf8")))
        .toEqual({ lastLoggedInUser: { login: "fixture" }, loggedInUsers: [{ login: "fixture" }] });
      return sdk.session;
    });
    const runner = useAgentRunner({ isTest: false });
    await runner.run({
      workspace: tmpdir(), preserveWorkspace: true, comparisonMode: true,
      prompt: "first", followUp: ["second"], timeout: 1000, model: "claude-sonnet-5",
      mcpServers, env: { COMPARISON_TEST_ENV: "forwarded" },
    });
    expect(sdk.clientOptions).toHaveBeenCalledWith(expect.objectContaining({
      env: expect.objectContaining({ COMPARISON_TEST_ENV: "forwarded" }),
    }));
    expect(sdk.createSession).toHaveBeenCalledWith(expect.objectContaining({
      mcpServers, enableConfigDiscovery: false, enableSessionStore: false, enableSkills: true,
    }));
    const clientConfig = sdk.clientOptions.mock.calls[0][0].baseDirectory as string;
    expect(clientConfig).not.toBe(home);
    expect(existsSync(clientConfig)).toBe(false);
    expect(sdk.session.sendAndWait).toHaveBeenCalledTimes(2);
    expect(sdk.session.disconnect).toHaveBeenCalledOnce();
    expect(sdk.stop).toHaveBeenCalledOnce();
  });

  test.each(["skills", "mcp"] as const)("rejects unexpected runtime %s before sending a prompt", async inventory => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    if (inventory === "skills") sdk.session.rpc.skills.list.mockResolvedValue({
      skills: [{ name: "ambient", path: path.join(home, "SKILL.md"), enabled: true }],
    });
    else sdk.session.rpc.mcp.list.mockResolvedValue({ servers: [{ name: "ambient" }] });
    await expect(useAgentRunner({ isTest: false }).run({
      workspace: tmpdir(), preserveWorkspace: true, comparisonMode: true,
      prompt: "first", mcpServers: {},
    })).rejects.toThrow("inventory");
    expect(sdk.session.sendAndWait).not.toHaveBeenCalled();
  });

  test("propagates errors and closes the client instead of returning partial success", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sdk.session.sendAndWait.mockRejectedValueOnce(new Error("timeout"));
    await expect(useAgentRunner({ isTest: false }).run({
      workspace: tmpdir(), preserveWorkspace: true, comparisonMode: true,
      prompt: "first", timeout: 1000, mcpServers: {},
    })).rejects.toThrow("timeout");
    expect(sdk.session.abort).toHaveBeenCalledOnce();
    expect(sdk.session.disconnect).toHaveBeenCalledOnce();
    expect(sdk.stop).toHaveBeenCalledOnce();
  });
});
