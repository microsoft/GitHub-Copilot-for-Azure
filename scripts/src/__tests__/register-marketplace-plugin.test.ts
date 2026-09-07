import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerMarketplacePlugin } from "../register-marketplace-plugin.js";

const PLUGIN_NAME = "aks-skills";
const PLUGIN_DESCRIPTION =
  "AKS operational skills for troubleshooting, known issues, GPU inference, and packet capture.";
const PLUGIN_SOURCE = "./.github/plugins/aks-skills";
const HOMEPAGE = "https://github.com/microsoft/azure-skills";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("registerMarketplacePlugin", () => {
  let testDirectory: string;
  let catalogPath: string;
  let manifestPath: string;

  beforeEach(() => {
    testDirectory = mkdtempSync(join(tmpdir(), "marketplace-registration-"));
    catalogPath = join(testDirectory, "marketplace.json");
    manifestPath = join(testDirectory, "plugin.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({
        name: PLUGIN_NAME,
        description: PLUGIN_DESCRIPTION,
        version: "1.2.3",
      }),
    );
  });

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true });
  });

  function writeCatalog(catalog: unknown): void {
    writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  }

  function readCatalog(): Record<string, unknown> {
    return JSON.parse(readFileSync(catalogPath, "utf8")) as Record<string, unknown>;
  }

  it.each([
    {
      name: "azure-skills catalog",
      catalog: {
        name: "azure-skills",
        owner: { name: "Microsoft", url: "https://www.microsoft.com" },
        plugins: [
          {
            name: "azure",
            description: "Azure plugin",
            source: "./.github/plugins/azure-skills",
            homepage: "https://github.com/microsoft/azure-skills",
          },
        ],
      },
      homepage: HOMEPAGE,
    },
    {
      name: "azure-skills Cursor catalog",
      catalog: {
        name: "azure-skills",
        owner: { name: "Microsoft" },
        metadata: { description: "Azure marketplace" },
        plugins: [
          {
            name: "azure",
            description: "Azure plugin",
            source: "./.github/plugins/azure-skills",
          },
        ],
      },
      homepage: undefined,
    },
    {
      name: "skills Claude catalog",
      catalog: {
        name: "skills",
        owner: { name: "microsoft", url: "https://github.com/microsoft" },
        metadata: { version: "1.0.0", pluginRoot: "./.github/plugins" },
        plugins: [
          {
            name: "azure-skills",
            description: "Azure plugin",
            source: "./.github/plugins/azure-skills",
            version: "1.0.0",
            category: "orchestration",
          },
        ],
      },
      homepage: "https://github.com/microsoft/skills",
    },
    {
      name: "skills GitHub catalog",
      catalog: {
        name: "skills",
        owner: { name: "microsoft", url: "https://github.com/microsoft" },
        metadata: { version: "1.0.0" },
        plugins: [
          {
            name: "azure-skills",
            description: "Azure plugin",
            source: "./.github/plugins/azure-skills",
            author: { name: "microsoft" },
          },
        ],
      },
      homepage: undefined,
    },
  ])("appends to the $name without changing existing data", ({ catalog, homepage }) => {
    writeCatalog(catalog);

    expect(registerMarketplacePlugin({
      catalogPath,
      pluginManifestPath: manifestPath,
      source: PLUGIN_SOURCE,
      homepage,
    })).toBe(true);

    const result = readCatalog();
    const { plugins: _expectedPlugins, ...expectedRoot } = catalog;
    const { plugins: _actualPlugins, ...actualRoot } = result;
    expect(actualRoot).toEqual(expectedRoot);
    expect(result.plugins).toEqual([
      ...catalog.plugins,
      {
        name: PLUGIN_NAME,
        description: PLUGIN_DESCRIPTION,
        source: PLUGIN_SOURCE,
        ...(homepage === undefined ? {} : { homepage }),
      },
    ]);
  });

  it("is idempotent and preserves additional entry fields and ordering", () => {
    const original = {
      name: "skills",
      metadata: { version: "1.0.0" },
      plugins: [
        { name: "before", source: "./before", custom: true },
        {
          name: PLUGIN_NAME,
          description: PLUGIN_DESCRIPTION,
          source: PLUGIN_SOURCE,
          version: "9.9.9",
          custom: { preserved: true },
        },
        { name: "after", source: "./after" },
      ],
    };
    writeCatalog(original);
    const before = readFileSync(catalogPath, "utf8");

    expect(registerMarketplacePlugin({
      catalogPath,
      pluginManifestPath: manifestPath,
      source: PLUGIN_SOURCE,
    })).toBe(false);

    expect(readFileSync(catalogPath, "utf8")).toBe(before);
    expect(readCatalog()).toEqual(original);
  });

  it("fails for a same-name registration with a different source", () => {
    writeCatalog({
      name: "skills",
      plugins: [{ name: PLUGIN_NAME, source: "./wrong-source" }],
    });

    expect(() => registerMarketplacePlugin({
      catalogPath,
      pluginManifestPath: manifestPath,
      source: PLUGIN_SOURCE,
    })).toThrow(`Marketplace entry ${PLUGIN_NAME} points to ./wrong-source`);
  });

  it.each([
    ["malformed JSON", "{not-json"],
    ["missing plugins array", JSON.stringify({ name: "skills" })],
    ["invalid plugins value", JSON.stringify({ name: "skills", plugins: {} })],
  ])("fails for %s", (_name, content) => {
    writeFileSync(catalogPath, content);

    expect(() => registerMarketplacePlugin({
      catalogPath,
      pluginManifestPath: manifestPath,
      source: PLUGIN_SOURCE,
    })).toThrow();
  });

  it("fails when the target source belongs to a different plugin", () => {
    writeCatalog({
      name: "skills",
      plugins: [{ name: "other-plugin", source: PLUGIN_SOURCE }],
    });

    expect(() => registerMarketplacePlugin({
      catalogPath,
      pluginManifestPath: manifestPath,
      source: PLUGIN_SOURCE,
    })).toThrow(`Marketplace source ${PLUGIN_SOURCE} is already registered`);
  });

  it("fails for a malformed plugin entry", () => {
    writeCatalog({
      name: "skills",
      plugins: [{ name: "missing-source" }],
    });

    expect(() => registerMarketplacePlugin({
      catalogPath,
      pluginManifestPath: manifestPath,
      source: PLUGIN_SOURCE,
    })).toThrow("Marketplace catalog.plugins[0].source must be a non-empty string");
  });

  it("matches the repository AKS plugin identity and target output path", () => {
    const manifest = JSON.parse(readFileSync(
      join(REPO_ROOT, "plugins", "aks-skills", ".claude-plugin", "plugin.json"),
      "utf8",
    )) as Record<string, unknown>;

    expect(manifest.name).toBe(PLUGIN_NAME);
    expect(manifest.description).toBe(PLUGIN_DESCRIPTION);
    expect(PLUGIN_SOURCE).toBe("./.github/plugins/aks-skills");
  });
});
