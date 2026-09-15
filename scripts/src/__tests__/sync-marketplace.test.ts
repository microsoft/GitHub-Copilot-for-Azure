import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { syncMarketplacePlugins } from "../plugin/marketplace-helper.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURES_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

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

  it.each([
    {
      repositoryName: "microsoft/azure-skills",
      catalogs: [
        [".claude-plugin/marketplace.json", "marketplace-azure-skills-claude.json"],
        [".cursor-plugin/marketplace.json", "marketplace-azure-skills-cursor.json"]
      ],
      homepage: "https://github.com/microsoft/azure-skills"
    },
    {
      repositoryName: "microsoft/skills",
      catalogs: [
        [".claude-plugin/marketplace.json", "marketplace-skills-claude.json"],
        [".github/plugin/marketplace.json", "marketplace-skills-github.json"]
      ],
      homepage: "https://github.com/microsoft/github-copilot-for-azure"
    }
  ])("adds aks-skills to current $repositoryName catalog shapes without disturbing existing entries", ({
    catalogs,
    homepage
  }) => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sync-marketplace-real-shapes-"));
    const sourceRoot = path.join(testRoot, "source-repo/output");
    const targetRoot = path.join(testRoot, "target-repo");

    for (const pluginDirectory of ["azure-skills", "aks-skills"]) {
      const sourceManifest = path.join(REPOSITORY_ROOT, "plugins", pluginDirectory, ".plugin", "plugin.json");
      const builtManifest = path.join(sourceRoot, pluginDirectory, ".plugin", "plugin.json");
      fs.mkdirSync(path.dirname(builtManifest), { recursive: true });
      fs.copyFileSync(sourceManifest, builtManifest);
    }

    const originals = new Map<string, Record<string, unknown>>();
    for (const [relativePath, fixtureName] of catalogs) {
      const marketplacePath = path.join(targetRoot, relativePath);
      fs.mkdirSync(path.dirname(marketplacePath), { recursive: true });
      fs.copyFileSync(path.join(FIXTURES_ROOT, fixtureName), marketplacePath);
      originals.set(relativePath, JSON.parse(fs.readFileSync(marketplacePath, "utf8")) as Record<string, unknown>);
    }

    const options = {
      sourceRoot,
      targetRoot,
      repository: "https://github.com/microsoft/github-copilot-for-azure",
      homepage
    };
    syncMarketplacePlugins(options);
    syncMarketplacePlugins(options);

    const aksManifest = JSON.parse(fs.readFileSync(
      path.join(sourceRoot, "aks-skills", ".plugin", "plugin.json"),
      "utf8"
    )) as { description: string; author: unknown };

    for (const [relativePath] of catalogs) {
      const marketplacePath = path.join(targetRoot, relativePath);
      const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8")) as {
        plugins: Record<string, unknown>[];
        [key: string]: unknown;
      };
      const original = originals.get(relativePath);
      const originalUnrelated = (original?.plugins as Record<string, unknown>[]).find(plugin => plugin.name !== "azure");
      const updatedUnrelated = marketplace.plugins.find(plugin => plugin.name === originalUnrelated?.name);
      const aksEntries = marketplace.plugins.filter(plugin => plugin.name === "aks-skills");
      const azureEntries = marketplace.plugins.filter(plugin => plugin.name === "azure");

      expect(aksEntries).toEqual([{
        name: "aks-skills",
        source: "./.github/plugins/aks-skills",
        description: aksManifest.description,
        author: aksManifest.author,
        homepage,
        repository: "https://github.com/microsoft/github-copilot-for-azure"
      }]);
      expect(azureEntries).toHaveLength(1);
      expect(azureEntries[0]?.source).toBe("./.github/plugins/azure-skills");
      expect(updatedUnrelated).toEqual(originalUnrelated);
      expect(marketplace.name).toBe(original?.name);
      expect(marketplace.owner).toEqual(original?.owner);
      expect(marketplace.metadata).toEqual(original?.metadata);
      expect(marketplace.renames).toEqual(original?.renames);
      expect(fs.readFileSync(marketplacePath, "utf8")).toMatch(/\n$/);
    }
  });
});