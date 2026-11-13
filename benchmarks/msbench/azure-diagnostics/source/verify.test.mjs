import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse } from "yaml";
import { createVerifierRuntime, verifierConfig } from "../tasks/container-app-restart-troubleshooting/tests/test.mjs";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const taskDir = resolve(sourceDir, "../tasks/container-app-restart-troubleshooting");
const prompt = "My Azure Container App keeps restarting, how do I troubleshoot it?";

test("pipeline is manual-only, defaults to dry run and consumes the local task", async () => {
  const pipeline = parse(await readFile(resolve(sourceDir,
    "../../../../pipelines/azure-diagnostics-harbor.yml"), "utf8"));
  assert.equal(pipeline.trigger, "none");
  assert.equal(pipeline.pr, "none");
  assert.equal(pipeline.schedules, undefined);
  assert.equal(pipeline.parameters.find(parameter => parameter.name === "dryRun").default, true);
  const steps = pipeline.stages[0].jobs[0].steps;
  const submission = steps.find(step => step.task === "AzureCLI@2");
  assert.match(submission.inputs.scriptPath, /azure-diagnostics-harbor\/Invoke-Smoke\.ps1$/);
  assert.equal(submission.env.HARBOR_TASK_COMMIT, "$(Build.SourceVersion)");
  assert.equal(submission.env.HARBOR_TASK_REPO, "$(Build.Repository.Uri)");
  assert.equal(submission.env.HARBOR_TASK_CLIENT_ID, undefined);
  assert.equal(submission.env.HARBOR_TASK_TENANT_ID, undefined);
  assert.equal(submission.env.CAPI_HMAC_KEY, undefined);
  assert.equal(submission.env.GITHUB_COPILOT_INTEGRATION_ID, undefined);
  const liveSecrets = submission.env["${{ if eq(parameters.dryRun, false) }}"];
  assert.equal(liveSecrets.GITHUB_COPILOT_INTEGRATION_ID, "$(GITHUB_COPILOT_INTEGRATION_ID)");
  assert.equal(liveSecrets.CAPI_HMAC_KEY, "$(CAPI_HMAC_KEY)");
  assert.equal(steps.at(-1).condition, "succeededOrFailed()");
});

test("the model map selects the documented direct CAPI index", async () => {
  const modelMap = parse(await readFile(resolve(sourceDir,
    "../../../../pipelines/scripts/azure-diagnostics-harbor/models.yaml"), "utf8"));
  const index = modelMap.indexes["capi-direct"];
  assert.equal(modelMap.version, 2);
  assert.equal(modelMap.models, undefined);
  assert.equal(index.provider, "copilot-direct");
  assert.equal(index.endpoint, "https://api.githubcopilot.com");
  assert.equal(index.auth.type, "env");
  assert.equal(index.auth.api_key_env, "CAPI_HMAC_KEY");
  assert.equal(index.auth.integration_id_env, "GITHUB_COPILOT_INTEGRATION_ID");
});

test("the export retains the selected prompt, graders and timeout", async () => {
  const source = parse(await readFile(join(sourceDir, "eval.yaml"), "utf8"));
  const exported = parse(await readFile(join(taskDir, "tests/_vally/eval.yaml"), "utf8"));
  assert.equal(source.stimuli.length, 1);
  assert.equal(exported.stimuli.length, 1);
  assert.equal(exported.stimuli[0].prompt, prompt);
  assert.deepEqual(exported.stimuli[0].graders, source.stimuli[0].graders);
  assert.equal(exported.scoring.threshold, 0.8);
  assert.match(await readFile(join(taskDir, "task.toml"), "utf8"), /timeout_sec = 600/);
  const dockerfile = await readFile(join(taskDir, "environment/Dockerfile"), "utf8");
  assert.match(dockerfile, /@microsoft\/vally-cli@0\.21\.0/);
  assert.match(dockerfile, /\/app\/\.agents\/skills\/azure-diagnostics/);
  assert.doesNotMatch(dockerfile, /COPY.*(?:tests|solution)/);
});

for (const scenario of [
  { name: "activation passes", activated: true, output: "Check revision logs and health probes.", score: 1 },
  { name: "skill tool call passes", toolActivation: true, output: "Check revision logs.", score: 1 },
  { name: "missing activation fails", activated: false, output: "Check revision logs.", score: 0.5 },
  { name: "mentioning the skill does not count", activated: false, output: "Activated skill: azure-diagnostics", score: 0.5 },
  { name: "fatal output fails even with activation", activated: true, output: "Fatal error: test fixture", score: 0.5 },
]) {
  test(`real Vally verifier: ${scenario.name}`, async () => {
    const scratch = await mkdtemp(join(tmpdir(), "azure-diagnostics-verifier-"));
    try {
      const trajectoryDir = join(scratch, "agent");
      const workspacePath = join(scratch, "app");
      await mkdir(trajectoryDir);
      await mkdir(workspacePath);
      const steps = [{ step_id: 1, timestamp: "2026-11-11T00:00:00Z", source: "user", message: prompt }];
      if (scenario.activated) {
        steps.push({ step_id: steps.length + 1, timestamp: "2026-11-11T00:00:01Z",
          source: "system", message: "Activated skill: azure-diagnostics" });
      }
      const agentStep = { step_id: steps.length + 1, timestamp: "2026-11-11T00:00:02Z",
        source: "agent", message: scenario.output };
      if (scenario.toolActivation) {
        agentStep.tool_calls = [{ tool_call_id: "skill-1", function_name: "skill",
          arguments: { skill: "azure-diagnostics" } }];
      }
      steps.push(agentStep);
      await writeFile(join(trajectoryDir, "trajectory.json"), JSON.stringify({
        schema_version: "ATIF-v1.6", session_id: scenario.name,
        agent: { name: "offline-fixture", version: "1", model_name: "none" }, steps,
      }));
      const runtime = createVerifierRuntime({
        config: { ...verifierConfig, trajectoryDir, workspacePath,
          evalSpecPath: join(taskDir, "tests/_vally/eval.yaml"),
          rewardDir: join(scratch, "verifier"), outputDir: join(scratch, "artifacts") },
        // Force entry-point discovery on every OS so the checked-in dependency pins are used.
        platform: "win32",
        env: { PATH: `${sourceDir}${delimiter}${process.env.PATH ?? ""}` },
        log: () => {},
      });
      assert.equal(await runtime.main([]), 0);
      const reward = Number(await readFile(join(scratch, "verifier/reward.txt"), "utf8"));
      assert.equal(reward, scenario.score);
      assert.equal(reward >= 0.8, scenario.score === 1);
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  });
}
