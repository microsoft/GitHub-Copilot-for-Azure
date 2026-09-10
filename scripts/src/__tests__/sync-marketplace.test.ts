import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncMarketplacePlugins } from "../plugin/marketplace-helper.js";

describe("sync marketplace plugins", () => {
  let testRoot: string | undefined;

  afterEach(() => {
    if (testRoot) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it("updates and appends every source plugin in both marketplaces", () => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sync-marketplace-"));
    const sourceRoot = path.join(testRoot, "source-repo/output");
    const targetRoot = path.join(testRoot, "target-repo");
    const marketplacePaths = [
      path.join(targetRoot, ".claude-plugin/marketplace.json"),
      path.join(targetRoot, ".github/plugin/marketplace.json"),
      path.join(targetRoot, ".cursor-plugin/marketplace.json")
    ];

    for (const marketplacePath of marketplacePaths) {
      fs.mkdirSync(path.dirname(marketplacePath), { recursive: true });
      fs.writeFileSync(marketplacePath, JSON.stringify({
        name: "target-marketplace",
        plugins: [
          { name: "azure", description: "old", customField: true },
          { name: "unrelated", source: "./plugins/unrelated" }
        ]
      }));
    }

    const manifests = [
      ["azure-skills", "azure", "Azure plugin", "1.2.3"],
      ["kusto-skills", "kusto", "Kusto plugin", "2.0.0"]
    ];
    for (const [directory, name, description, version] of manifests) {
      const manifestDirectory = path.join(sourceRoot, directory, ".plugin");
      fs.mkdirSync(manifestDirectory, { recursive: true });
      fs.writeFileSync(path.join(manifestDirectory, "plugin.json"), JSON.stringify({
        name,
        description,
        version,
        author: { name: "Microsoft" },
        homepage: "https://example.test/plugin"
      }));
    }

    syncMarketplacePlugins({
      sourceRoot,
      targetRoot,
      repository: "https://github.com/microsoft/target",
      homepage: "https://example.test/marketplace"
    });

    for (const marketplacePath of marketplacePaths) {
      const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8")) as {
        name: string;
        plugins: Record<string, unknown>[];
      };
      expect(marketplace.name).toBe("target-marketplace");
      expect(marketplace.plugins).toEqual([
        {
          name: "azure",
          description: "Azure plugin",
          customField: true,
          source: "./.github/plugins/azure-skills",
          author: { name: "Microsoft" },
          homepage: "https://example.test/marketplace",
          repository: "https://github.com/microsoft/target"
        },
        { name: "unrelated", source: "./plugins/unrelated" },
        {
          name: "kusto",
          source: "./.github/plugins/kusto-skills",
          description: "Kusto plugin",
          author: { name: "Microsoft" },
          homepage: "https://example.test/marketplace",
          repository: "https://github.com/microsoft/target"
        }
      ]);
      expect(fs.readFileSync(marketplacePath, "utf8")).toMatch(/\n$/);
    }
  });
});