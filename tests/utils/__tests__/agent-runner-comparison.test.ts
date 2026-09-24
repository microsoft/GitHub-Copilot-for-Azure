import type { AgentRunConfig } from "../agent-runner.ts";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAgentRunner } from "../agent-runner.ts";
import { tmpdir } from "node:os";

const sdk = vi.hoisted(() => {
  const session = {
    on: vi.fn(() => vi.fn()), sendAndWait: vi.fn(async () => undefined),
    abort: vi.fn(async () => {}), disconnect: vi.fn(async () => {}),
  };
  return { session, createSession: vi.fn(async () => session), stop: vi.fn(async () => {}), clientOptions: vi.fn() };
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
  beforeEach(() => {
    vi.stubEnv("NO_SKILLS", "false");
    vi.stubEnv("VALLY_RUNNER_DISABLE_AZURE_MCP", "false");
    sdk.session.sendAndWait.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test.each<NonNullable<AgentRunConfig["mcpServers"]>>([
    {},
    { fixture: { type: "stdio", command: "node", args: ["fixture.js"], tools: ["*"] } },
  ])("uses the supplied MCP set without implicitly adding Azure: %j", async mcpServers => {
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
      mcpServers, enableConfigDiscovery: false, enableSessionStore: false,
    }));
    expect(sdk.session.sendAndWait).toHaveBeenCalledTimes(2);
    expect(sdk.session.disconnect).toHaveBeenCalledOnce();
    expect(sdk.stop).toHaveBeenCalledOnce();
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
