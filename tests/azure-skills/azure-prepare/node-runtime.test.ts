import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../", import.meta.url);
const prepare = "plugins/azure-skills/skills/azure-prepare/references/";
const migrate = "plugins/azure-skills/skills/azure-cloud-migrate/references/";
const fixtures = "evals/azure-skills/";

const sources = [
  `${prepare}runtimes/nodejs.md`,
  `${prepare}services/app-service/templates/web-api.md`,
  `${prepare}services/app-service/bicep.md`,
  `${prepare}services/app-service/deployment-slots.md`,
  `${prepare}services/functions/bicep.md`,
  `${prepare}services/functions/terraform.md`,
  `${migrate}services/app-service/code-migration.md`,
  `${fixtures}azure-prepare/fixture/containerized-web/Dockerfile`,
  `${fixtures}azure-prepare/fixture/nodejs-hello/Dockerfile`,
  `${fixtures}azure-validate/fixture/containerized-app/Dockerfile`,
];

const versionPatterns = [
  /\b(?:node|nodejs):(\d+)/gi,
  /\bnode\\?\|(\d+)/gi,
  /WEBSITE_NODE_DEFAULT_VERSION['"`]*\s*,\s*value:\s*['"]~?(\d+)/g,
  /\bnode_version\s*=\s*["']~?(\d+)/g,
];

describe("Node.js deployment runtime examples", () => {
  it.each(sources)("%s uses Node.js 22 or later", (path) => {
    const content = readFileSync(new URL(path, root), "utf8");
    const versions = versionPatterns.flatMap((pattern) =>
      [...content.matchAll(pattern)].map((match) => Number(match[1])));

    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(version).toBeGreaterThanOrEqual(22);
    }
  });

  it("keeps the legacy Linux Consumption example on Node.js 22", () => {
    const content = readFileSync(new URL(`${prepare}services/functions/bicep.md`, root), "utf8");
    const linuxConsumption = content.split("### Linux Consumption")[1].split("### Windows Consumption")[0];

    expect(linuxConsumption).toContain("linuxFxVersion: 'Node|22'");
    expect(linuxConsumption).not.toContain("Node|24");
  });
});
