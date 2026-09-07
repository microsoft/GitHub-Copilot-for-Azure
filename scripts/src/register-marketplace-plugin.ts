#!/usr/bin/env node

import {
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, unknown>;

interface RegistrationOptions {
  catalogPath: string;
  pluginManifestPath: string;
  source: string;
  homepage?: string;
}

function parseObjectFile(filePath: string, label: string): JsonObject {
  let value: unknown;

  try {
    value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is missing or malformed at ${filePath}: ${detail}`, {
      cause: error,
    });
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must contain a JSON object: ${filePath}`);
  }

  return value as JsonObject;
}

function requiredString(object: JsonObject, key: string, label: string): string {
  const value = object[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label}.${key} must be a non-empty string`);
  }

  return value;
}

function registerMarketplacePlugin(options: RegistrationOptions): boolean {
  const catalog = parseObjectFile(options.catalogPath, "Marketplace catalog");
  const manifest = parseObjectFile(options.pluginManifestPath, "Plugin manifest");
  const name = requiredString(manifest, "name", "Plugin manifest");
  const description = requiredString(manifest, "description", "Plugin manifest");

  if (!Array.isArray(catalog.plugins)) {
    throw new Error(`Marketplace catalog.plugins must be an array: ${options.catalogPath}`);
  }

  const plugins = catalog.plugins.map((entry, index) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Marketplace catalog.plugins[${index}] must be an object`);
    }
    const plugin = entry as JsonObject;
    requiredString(plugin, "name", `Marketplace catalog.plugins[${index}]`);
    requiredString(plugin, "source", `Marketplace catalog.plugins[${index}]`);
    return plugin;
  });

  const matchingName = plugins.filter(entry => entry.name === name);

  if (matchingName.length > 1) {
    throw new Error(`Marketplace catalog contains duplicate registrations for ${name}`);
  }

  const conflictingSource = plugins.find(entry =>
    entry.source === options.source && entry.name !== name
  );
  if (conflictingSource !== undefined) {
    throw new Error(`Marketplace source ${options.source} is already registered to another plugin`);
  }

  const desiredFields: JsonObject = {
    name,
    description,
    source: options.source,
  };
  if (options.homepage !== undefined) {
    desiredFields.homepage = options.homepage;
  }

  let changed = false;
  if (matchingName.length === 0) {
    catalog.plugins.push(desiredFields);
    changed = true;
  } else {
    const existing = matchingName[0];
    const existingSource = requiredString(existing, "source", `Marketplace entry ${name}`);
    if (existingSource !== options.source) {
      throw new Error(
        `Marketplace entry ${name} points to ${existingSource}, expected ${options.source}`,
      );
    }

    for (const [key, value] of Object.entries(desiredFields)) {
      if (existing[key] !== value) {
        existing[key] = value;
        changed = true;
      }
    }
  }

  if (changed) {
    const temporaryPath = resolve(dirname(options.catalogPath), `.${name}-marketplace.tmp`);
    writeFileSync(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, options.catalogPath);
  }

  return changed;
}

function parseArguments(args: string[]): RegistrationOptions {
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(
        "Usage: register-marketplace-plugin --catalog <path> --plugin-manifest <path> "
        + "--source <relative-source> [--homepage <url>]",
      );
    }
    if (!["--catalog", "--plugin-manifest", "--source", "--homepage"].includes(key)) {
      throw new Error(`Unknown option: ${key}`);
    }
    values.set(key, value);
  }

  const catalogPath = values.get("--catalog");
  const pluginManifestPath = values.get("--plugin-manifest");
  const source = values.get("--source");
  if (catalogPath === undefined || pluginManifestPath === undefined || source === undefined) {
    throw new Error(
      "Usage: register-marketplace-plugin --catalog <path> --plugin-manifest <path> "
      + "--source <relative-source> [--homepage <url>]",
    );
  }

  return {
    catalogPath,
    pluginManifestPath,
    source,
    homepage: values.get("--homepage"),
  };
}

function main(): void {
  const options = parseArguments(process.argv.slice(2));
  const changed = registerMarketplacePlugin(options);
  console.log(`${changed ? "Registered" : "Already registered"} plugin from ${options.source}`);
}

const currentFile = fileURLToPath(import.meta.url);
if (currentFile === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export { registerMarketplacePlugin, type RegistrationOptions };
