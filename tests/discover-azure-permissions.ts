import { appendFileSync, readdirSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { filterStimuli, loadEvalSpec, parseSuiteFilter } from "@microsoft/vally";

export async function readEvalSuites(evalDir: string) {
  const files = readdirSync(evalDir, { recursive: true, encoding: "utf8" }).sort()
    .filter(file => file.endsWith(".yaml") && !file.split(path.sep).includes("fixture"));
  return Promise.all(files.map(async file => {
    const absolute = path.join(evalDir, file);
    return { file: absolute, suite: await loadEvalSpec(absolute) };
  }));
}

export async function discoverAzurePermissions(evalDir: string, tags: string[] = []) {
  const permissions = new Set<string>();
  let fixtures = false;
  const filter = parseSuiteFilter(tags);
  for (const { suite } of await readEvalSuites(evalDir)) {
    const { matched } = filterStimuli(suite.stimuli, suite.tags, filter);
    for (const stimulus of matched) {
      const effectiveTags = { ...suite.tags, ...stimulus.tags };
      const permission = effectiveTags.azurePermission ?? "admin";
      if (permission !== "read" && permission !== "write" && permission !== "admin" && permission !== "none") {
        throw new Error(`Unsupported Azure permission: ${JSON.stringify(permission)}`);
      }
      permissions.add(permission);
      fixtures ||= effectiveTags.azureFixture !== undefined;
    }
  }
  return { permissions: [...permissions], fixtures };
}

async function main(): Promise<void> {
  const { GITHUB_WORKSPACE, SKILL, TEST_TAG, GITHUB_OUTPUT } = process.env;
  if (!GITHUB_WORKSPACE || !SKILL || !GITHUB_OUTPUT || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(SKILL)) {
    throw new Error("GITHUB_WORKSPACE, a valid SKILL (plugin/skill), and GITHUB_OUTPUT are required");
  }
  const { permissions, fixtures } = await discoverAzurePermissions(
    path.join(GITHUB_WORKSPACE, "evals", SKILL), TEST_TAG ? [TEST_TAG] : [],
  );
  console.log(`Required Azure permissions: ${JSON.stringify(permissions)}; fixtures: ${fixtures}`);
  appendFileSync(GITHUB_OUTPUT, `permissions=${JSON.stringify(permissions)}\nfixtures=${fixtures}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
