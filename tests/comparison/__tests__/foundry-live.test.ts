import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { loadEvalSpec, resolveStimulus } from "@microsoft/vally";
import { AzureHttpError, createGroup, deleteGroup, responseText, verifyHostedAgent, type RequestJson } from "../live/azure.ts";
import { liveContext } from "../live/outcome-grader.ts";
import { parseLiveArgs, runLive } from "../live/run.ts";
import { comparisonStimulus } from "../../vally/comparison-policy.ts";
import type { compareClients, ComparisonOptions } from "../compare-clients.ts";

const subscription = "00000000-0000-0000-0000-000000000001";
const group = "rg-vally-foundry-123456abcdef-claude";
const owner = "123456abcdef";
const accountId = `/subscriptions/${subscription}/resourceGroups/${group}/providers/Microsoft.CognitiveServices/accounts/test`;
const projectEndpoint = "https://test.services.ai.azure.com/api/projects/test-project";
const completed = (greeting: string) => ({
  id: "resp-test", status: "completed",
  output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: greeting }] }],
});

function verificationRequest() {
  return vi.fn<RequestJson>()
    .mockResolvedValueOnce({ tags: { "vally-run": owner } })
    .mockResolvedValueOnce({ value: [{ id: accountId, kind: "AIServices" }] })
    .mockResolvedValueOnce({ value: [{ id: `${accountId}/projects/test-project`, properties: {
      provisioningState: "Succeeded", endpoints: { "AI Foundry API": projectEndpoint },
    } }] })
    .mockResolvedValueOnce({ name: "hello-world", versions: { latest: {
      version: "1", status: "active", definition: { kind: "hosted" },
    } } })
    .mockResolvedValueOnce(completed("Hello, world! Welcome!"));
}

describe("independent Foundry outcome", () => {
  test("discovers only the owned project and invokes the remote hosted endpoint", async () => {
    const request = verificationRequest();
    expect(await verifyHostedAgent(subscription, group, owner, "hello-world", request))
      .toMatchObject({ kind: "hosted", version: "1", greeting: "Hello, world! Welcome!", projectEndpoint });
    expect(request).toHaveBeenLastCalledWith(
      `${projectEndpoint}/agents/hello-world/endpoint/protocols/openai/responses?api-version=v1`,
      "POST", { input: "Please greet me.", stream: false },
    );
  });

  test("does not accept an echoed input or an error message containing the expected greeting", () => {
    expect(() => responseText({ status: "failed", error: { message: "Hello, world!" } })).toThrow();
    expect(() => responseText({ status: "completed", output: [
      { type: "message", role: "user", content: [{ type: "output_text", text: "Hello, world!" }] },
    ] })).toThrow("no assistant");
  });

  test("follows scoped ARM continuation pages, including a final empty page", async () => {
    const base = verificationRequest();
    let projectPage: string | undefined;
    const request: RequestJson = async (url, method, body) => {
      if (url === projectPage) return { value: [] };
      const result = await base(url, method, body);
      if (url.includes("/projects?")) {
        projectPage = `${url}&$skiptoken=next`;
        return { ...result as object, nextLink: projectPage };
      }
      return result;
    };
    expect(await verifyHostedAgent(subscription, group, owner, "hello-world", request))
      .toMatchObject({ greeting: "Hello, world! Welcome!" });
  });

  test.each([
    "https://attacker.example/projects",
    `https://management.azure.com/subscriptions/${subscription}/resourceGroups/other`,
  ])("rejects inventory pagination outside its exact collection: %s", async nextLink => {
    const request = vi.fn<RequestJson>()
      .mockResolvedValueOnce({ tags: { "vally-run": owner } })
      .mockResolvedValueOnce({ value: [], nextLink });
    await expect(verifyHostedAgent(subscription, group, owner, "hello-world", request)).rejects.toThrow("pagination");
    expect(request).toHaveBeenCalledTimes(2);
  });

  test("rejects repeated continuation links", async () => {
    const request = vi.fn<RequestJson>()
      .mockResolvedValueOnce({ tags: { "vally-run": owner } })
      .mockImplementation(async url => ({ value: [], nextLink: url }));
    await expect(verifyHostedAgent(subscription, group, owner, "hello-world", request)).rejects.toThrow("pagination");
    expect(request).toHaveBeenCalledTimes(2);
  });

  test.each(["prompt", "managed"])("rejects a non-hosted %s agent", async kind => {
    const base = verificationRequest();
    const request: RequestJson = async (url, method, body) => {
      if (url.endsWith("/agents/hello-world?api-version=v1")) {
        return { name: "hello-world", versions: { latest: { definition: { kind }, status: "active", version: "1" } } };
      }
      return base(url, method, body);
    };
    await expect(verifyHostedAgent(subscription, group, owner, "hello-world", request)).rejects.toThrow("not hosted");
    expect(base).toHaveBeenCalledTimes(3);
  });

  test("fails a real invocation with the wrong greeting", async () => {
    const base = verificationRequest();
    const request: RequestJson = (url, method, body) => method === "POST"
      ? Promise.resolve(completed("Goodbye!")) : base(url, method, body);
    await expect(verifyHostedAgent(subscription, group, owner, "hello-world", request)).rejects.toThrow("not a hello-world");
  });

  test("does not invoke an agent that is still deploying", async () => {
    const base = verificationRequest();
    const request: RequestJson = (url, method, body) => url.endsWith("/agents/hello-world?api-version=v1")
      ? Promise.resolve({ name: "hello-world", versions: { latest: {
        definition: { kind: "hosted" }, status: "deploying", version: "1",
      } } }) : base(url, method, body);
    await expect(verifyHostedAgent(subscription, group, owner, "hello-world", request)).rejects.toThrow("status: deploying");
    expect(base).toHaveBeenCalledTimes(3);
  });

  test("does not treat an API error as successful empty evidence", async () => {
    const request = vi.fn<RequestJson>().mockRejectedValue(new AzureHttpError(403, "No data-plane access"));
    await expect(verifyHostedAgent(subscription, group, owner, "hello-world", request)).rejects.toThrow("No data-plane access");
  });

  test("refuses a forged project endpoint before sending a request to it", async () => {
    const base = verificationRequest();
    const request: RequestJson = (url, method, body) => url.includes("/projects?") ? Promise.resolve({
      value: [{ properties: { provisioningState: "Succeeded", endpoints: { "AI Foundry API": "https://attacker.example/api/projects/x" } } }],
    }) : base(url, method, body);
    await expect(verifyHostedAgent(subscription, group, owner, "hello-world", request)).rejects.toThrow("Unexpected ARM");
    expect(base).toHaveBeenCalledTimes(2);
  });
});

describe("owned resource lifecycle", () => {
  test("never reuses or deletes an existing group", async () => {
    const request = vi.fn<RequestJson>().mockResolvedValue({});
    await expect(createGroup(subscription, group, owner, "northcentralus", request)).rejects.toThrow("already exists");
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("creates only after an explicit 404", async () => {
    const request = vi.fn<RequestJson>()
      .mockRejectedValueOnce(new AzureHttpError(404, "missing"))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ tags: { "vally-run": owner } })
      .mockResolvedValueOnce({ properties: { provisioningState: "Succeeded" } });
    await createGroup(subscription, group, owner, "northcentralus", request);
    expect(request.mock.calls[1][1]).toBe("PUT");
    expect(request.mock.calls[1][2]).toMatchObject({ tags: { "vally-run": owner } });
  });

  test("an authentication failure does not become permission to create", async () => {
    const request = vi.fn<RequestJson>().mockRejectedValue(new AzureHttpError(401, "unauthorized"));
    await expect(createGroup(subscription, group, owner, "northcentralus", request)).rejects.toThrow("unauthorized");
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("refuses cleanup after ownership changes", async () => {
    const request = vi.fn<RequestJson>().mockResolvedValue({ tags: { "vally-run": "someone-else" } });
    await expect(deleteGroup(subscription, group, owner, request)).rejects.toThrow("Ownership");
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("refuses cleanup if both ownership markers are missing", async () => {
    const request = vi.fn<RequestJson>()
      .mockResolvedValueOnce({ tags: { "azd-env-name": "hello-world-dev" } })
      .mockRejectedValueOnce(new AzureHttpError(404, "Ownership deployment missing"));
    await expect(deleteGroup(subscription, group, owner, request)).rejects.toThrow("Ownership deployment missing");
    expect(request).toHaveBeenCalledTimes(2);
  });

  test("uses its preexisting deployment marker when azd overwrites group tags", async () => {
    const request = vi.fn<RequestJson>()
      .mockResolvedValueOnce({ tags: { "azd-env-name": "hello-world-dev" } })
      .mockResolvedValueOnce({ properties: { provisioningState: "Succeeded", outputs: { vallyRun: { value: owner } } } })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new AzureHttpError(404, "deleted"));
    await deleteGroup(subscription, group, owner, request, async () => {});
    expect(request.mock.calls[1][0]).toContain(`/deployments/vally-owner-${owner}?`);
    expect(request.mock.calls[2][1]).toBe("DELETE");
    expect(request.mock.calls.some(([, method]) => method === "PATCH" || method === "PUT")).toBe(false);
  });

  test.each(["wrong-owner", "failed-marker"])("refuses an invalid fallback marker: %s", async reason => {
    const request = vi.fn<RequestJson>()
      .mockResolvedValueOnce({ tags: {} })
      .mockResolvedValueOnce({ properties: {
        provisioningState: reason === "failed-marker" ? "Failed" : "Succeeded",
        outputs: { vallyRun: { value: reason === "wrong-owner" ? "other" : owner } },
      } });
    await expect(deleteGroup(subscription, group, owner, request)).rejects.toThrow("Ownership deployment mismatch");
    expect(request).toHaveBeenCalledTimes(2);
  });

  test("waits for confirmed deletion", async () => {
    const request = vi.fn<RequestJson>()
      .mockResolvedValueOnce({ tags: { "vally-run": owner } })
      .mockResolvedValueOnce(null).mockResolvedValueOnce({})
      .mockRejectedValueOnce(new AzureHttpError(404, "missing"));
    const pause = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await deleteGroup(subscription, group, owner, request, pause);
    expect(request.mock.calls[1][1]).toBe("DELETE");
    expect(pause).toHaveBeenCalledTimes(2);
  });

  test("reports unconfirmed cleanup instead of claiming deletion", async () => {
    const request = vi.fn<RequestJson>().mockResolvedValue({ tags: { "vally-run": owner } });
    await expect(deleteGroup(subscription, group, owner, request, async () => {})).rejects.toThrow("Cleanup not confirmed");
  });
});

describe("live comparison orchestration", () => {
  const roots: string[] = [];
  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
  });

  test("requires explicit execution and fixes one trial per client", () => {
    expect(() => parseLiveArgs([])).toThrow("--execute");
    const parsed = parseLiveArgs(["--execute", "--copilot-model", "claude-sonnet-5", "--claude-model", "claude-sonnet-5", "--judge-model", "gpt-5.5"]);
    expect(parsed?.comparison.runs).toBe(1);
    expect(parsed?.location).toBe("northcentralus");
    expect(() => liveContext({})).toThrow("requires");
  });

  test("the exact prompt is portable and outside automatic eval discovery", async () => {
    const file = path.resolve(import.meta.dirname, "../live/hello-world.eval.yaml");
    const spec = await loadEvalSpec(file);
    expect(spec.stimuli).toHaveLength(1);
    expect(spec.stimuli[0].prompt).toBe("Create and deploy a Microsoft Foundry hosted agent that returns a friendly hello-world greeting");
    expect(spec.stimuli[0].graders?.map(grader => grader.type)).toContain("foundry-live-outcome");
    const context = JSON.parse(String(spec.stimuli[0].tags?.systemPrompt)).content as string;
    expect(context).toContain("az tag update --operation Merge");
    expect(context).toContain("even a failed attempt");
    expect(context).toContain("VALLY_LIVE_RUN_ID");
    vi.stubEnv("MODEL_OVERRIDE", "");
    vi.stubEnv("NO_SKILLS", "false");
    const stimulus = resolveStimulus(spec.stimuli[0], undefined, {}, spec.tags);
    expect(() => comparisonStimulus(stimulus, { workDir: ".", model: "claude-sonnet-5", timeout: 1000 })).not.toThrow();
  });

  test("records a failing outcome, still runs both clients, and cleans both groups", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "foundry-live-test-"));
    roots.push(root);
    const options: ComparisonOptions = {
      evalSpec: "", outputDir: root, copilotModel: "claude-sonnet-5", claudeModel: "claude-sonnet-5",
      judgeModel: "gpt-5.5", runs: 1, timeout: "30m", skipJudge: false, failOnRegression: false,
    };
    const groups = new Map<string, unknown>();
    const request = vi.fn<RequestJson>(async (url, method = "GET", body) => {
      if (url.includes("/deployments/")) return { properties: { provisioningState: "Succeeded" } };
      if (method === "PUT") { groups.set(url, body); return body; }
      if (method === "DELETE") { groups.delete(url); return null; }
      if (!groups.has(url)) throw new AzureHttpError(404, "missing");
      return groups.get(url);
    });
    const run = vi.fn(async (_args: string[], env: NodeJS.ProcessEnv) => {
      const dir = env.VALLY_LIVE_EVIDENCE_DIR!;
      await writeFile(path.join(dir, "live-outcome.json"), JSON.stringify({ passed: env.VALLY_LIVE_RESOURCE_GROUP?.endsWith("copilot") }));
      return 0;
    });
    const compare: typeof compareClients = async (opts, command) => {
      if (!command) throw new Error("Missing command callback");
      await mkdir(path.join(opts.outputDir, "comparison"));
      for (const client of ["claude-cli", "integration-test-agent-runner"]) {
        expect(await command(["eval", "--executor", client], { VALLY_FAIR_COMPARISON: "true" })).toBe(0);
      }
      return path.join(opts.outputDir, "comparison");
    };
    await expect(runLive(options, "northcentralus", {
      subscription: async () => subscription, request, run, compare, pause: async () => {},
    })).rejects.toThrow("independent deployment");
    expect(run).toHaveBeenCalledTimes(2);
    expect(groups.size).toBe(0);
    const evidenceDir = run.mock.calls[0][1].VALLY_LIVE_EVIDENCE_DIR!;
    const manifest = JSON.parse(await readFile(path.join(evidenceDir, "..", "live-run.json"), "utf8"));
    expect(manifest.trials.map((trial: { cleanup: string }) => trial.cleanup)).toEqual(["deleted", "deleted"]);
    expect(manifest.status).toBe("failed");
  });

  test("cleans the owned group when launching the client throws", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "foundry-live-launch-test-"));
    roots.push(root);
    const options: ComparisonOptions = {
      evalSpec: "", outputDir: root, copilotModel: "claude-sonnet-5", claudeModel: "claude-sonnet-5",
      judgeModel: "gpt-5.5", runs: 1, timeout: "30m", skipJudge: false, failOnRegression: false,
    };
    const groups = new Map<string, unknown>();
    const request = vi.fn<RequestJson>(async (url, method = "GET", body) => {
      if (url.includes("/deployments/")) return { properties: { provisioningState: "Succeeded" } };
      if (method === "PUT") { groups.set(url, body); return body; }
      if (method === "DELETE") { groups.delete(url); return null; }
      if (!groups.has(url)) throw new AzureHttpError(404, "missing");
      return groups.get(url);
    });
    const run: (args: string[], env: NodeJS.ProcessEnv) => Promise<number> = async () => {
      throw new Error("Executable missing");
    };
    const compare: typeof compareClients = async (_opts, command) => {
      if (!command) throw new Error("Missing callback");
      await command(["eval", "--executor", "claude-cli"], {});
      throw new Error("Unreachable");
    };
    await expect(runLive(options, "northcentralus", {
      subscription: async () => subscription, request, run, compare, pause: async () => {},
    })).rejects.toThrow("Executable missing");
    expect(groups.size).toBe(0);
    expect(request.mock.calls.some(([, method]) => method === "DELETE")).toBe(true);
  });
});
