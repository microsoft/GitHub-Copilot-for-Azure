import * as fs from "node:fs";
import * as path from "node:path";

const MARKETPLACE_PATHS = [
  ".claude-plugin/marketplace.json",
  ".github/plugin/marketplace.json",
  ".cursor-plugin/marketplace.json"
] as const;

interface PluginManifest {
  name: string;
  description: string;
  version: string;
  author: unknown;
  homepage: string;
}

interface Marketplace {
  plugins: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface SyncMarketplaceOptions {
  sourceRoot: string;
  targetRoot: string;
  repository: string;
  homepage: string;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readPluginManifest(filePath: string): PluginManifest {
  const value = readJson(filePath);
  if (
    typeof value !== "object" || value === null ||
    !("name" in value) || typeof value.name !== "string" ||
    !("description" in value) || typeof value.description !== "string" ||
    !("version" in value) || typeof value.version !== "string" ||
    !("author" in value) ||
    !("homepage" in value) || typeof value.homepage !== "string"
  ) {
    throw new Error(`Invalid plugin manifest: ${filePath}`);
  }

  return value as PluginManifest;
}

function readMarketplace(filePath: string): Marketplace {
  const value = readJson(filePath);
  if (
    typeof value !== "object" || value === null ||
    !("plugins" in value) || !Array.isArray(value.plugins) ||
    value.plugins.some((plugin) => typeof plugin !== "object" || plugin === null || Array.isArray(plugin) || typeof (plugin as { name?: unknown }).name !== "string")
  ) {
    throw new Error(`Invalid marketplace manifest: ${filePath}`);
  }

  return value as Marketplace;
}

export function syncMarketplacePlugins(options: SyncMarketplaceOptions): void {
  const marketplaceFiles = MARKETPLACE_PATHS
    .map(relativePath => path.join(options.targetRoot, relativePath))
    .filter(filePath => fs.existsSync(filePath));
  const marketplaces = marketplaceFiles.map(readMarketplace);
  const pluginDirectories = fs.readdirSync(options.sourceRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  for (const pluginDirectory of pluginDirectories) {
    const manifestPath = path.join(options.sourceRoot, pluginDirectory, ".plugin/plugin.json");
    const manifest = readPluginManifest(manifestPath);
    const pluginEntry = {
      name: manifest.name,
      source: `./.github/plugins/${pluginDirectory}`,
      description: manifest.description,
      author: manifest.author,
      homepage: options.homepage,
      repository: options.repository
    };

    for (const marketplace of marketplaces) {
      const existingIndex = marketplace.plugins.findIndex(plugin => plugin.name === manifest.name);
      if (existingIndex === -1) {
        marketplace.plugins.push(pluginEntry);
      } else {
        marketplace.plugins[existingIndex] = {
          ...marketplace.plugins[existingIndex],
          ...pluginEntry
        };
      }
    }
  }

  for (let index = 0; index < marketplaceFiles.length; index += 1) {
    fs.writeFileSync(marketplaceFiles[index], `${JSON.stringify(marketplaces[index], null, 2)}\n`);
  }
}
