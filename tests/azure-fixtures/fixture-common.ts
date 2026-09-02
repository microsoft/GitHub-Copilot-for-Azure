/**
 * Shared types and helpers for the Azure fixture scripts.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export type JsonValue = string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

export type BicepParameterConfig = {
  /**
   * The name of the parameter.
   */
  key: string;

  /**
   * If no value is provided, the script will attempt to resolve the value using the key.
   * See resolveBicepParameter for how they are resolved.
   */
  value?: JsonValue;
};

export type BicepConfig = {
  /**
   * Unique identifier of the fixture.
   */
  fixtureId: string;

  /**
   * Path to a Bicep template.
   * The path is relative to the location of the manifest file.
   * The template is deployed at resource group scope into a resource group
   * the script creates beforehand.
   */
  path: string;

  /**
   * Azure region to provision the resource group and its child resources.
   */
  location: string;

  /**
   * Base name of the resource group.
   */
  resourceGroupNameBase: string;

  /**
   * The parameter values for the Bicep template.
   * The location parameter is always computed and provided.
   */
  parameters: BicepParameterConfig[];
};

export type PostProvisionScriptConfig = {
  /**
   * Path to the data plane script.
   * The path is relative to the location of the manifest file.
   */
  path: string;
};

/**
 * Manifest for provisioning the Azure fixture for integration test.
 */
export type FixtureManifest = {
  type: "readOnly" | "readWrite";
  version: number;
  schemaVersion: number;

  /**
   * A human facing description of the Azure fixtures.
   * This description will not be used by the provisioning script.
   */
  description: string;

  /**
   * Bicep templates to provision.
   * The templates will be provisioned to each resource group computed
   * from resourceGroupNameBases in the given order.
   */
  bicepConfigs: BicepConfig[];

  /**
   * Additional post-provision scripts to run after provisioning the fixtures.
   * Post-provision scripts are given the computed resource group names.
   * --resource-groups <rg-1> <rg-2> ... <rg-n>
   *
   * The post-provision scripts will be executed via tsx and must be written in Typescript.
   */
  postProvisionScripts?: PostProvisionScriptConfig[];
};

export type ProvisionScriptOutput = {
  /**
   * Names of the resource groups to use for test.
   */
  resourceGroups: string[];
};

export const FIXTURE_ID_TAG = "FixtureId";
export const FIXTURE_VERSION_TAG = "FixtureVersion";
export const FIXTURE_STATE_TAG = "FixtureState";
export const FIXTURE_STATE_PROVISIONING = "provisioning";

const AZ_COMMAND = process.platform === "win32" ? "az.cmd" : "az";

let deadline = Number.POSITIVE_INFINITY;

/**
 * Caps the total wall clock time the script may spend in child processes.
 */
export function setBudget(totalMs: number) {
  deadline = Date.now() + totalMs;
}

/**
 * Milliseconds left in the run budget, or undefined when no budget was set.
 * @throws An error if the budget is already exhausted.
 */
export function remainingMs(step: string): number | undefined {
  if (deadline === Number.POSITIVE_INFINITY) {
    return undefined;
  }

  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error(`Time budget was exhausted before ${step}`);
  }
  return remaining;
}

/**
 * Helper function to run a single AZ CLI command.
 * @param args arguments to pass to the AZ CLI command, excluding `az`.
 * @returns A string capturing the stdout output.
 * @throws An error if the command exits with a non-zero exit code or the budget runs out.
 */
export function runAz(args: string[]): string {
  const step = `az ${args.join(" ")}`;
  try {
    // az traps SIGTERM and can hang, so kill it outright.
    return execFileSync(AZ_COMMAND, args, {
      encoding: "utf8",
      timeout: remainingMs(step),
      killSignal: "SIGKILL",
    }).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
      throw new Error(`Time budget was exhausted during ${step}`, { cause: error });
    }
    throw error;
  }
}

export type FixtureResourceGroup = {
  name: string;
  tags: Record<string, string>;
};

/** Finds every resource group previously provisioned for a fixture, whatever its name. */
export function findFixtureResourceGroups(fixtureId: string): FixtureResourceGroup[] {
  const groups = JSON.parse(
    runAz([
      "group",
      "list",
      "--tag",
      `${FIXTURE_ID_TAG}=${fixtureId}`,
      "--query",
      "[].{name:name, tags:tags}",
      "-o",
      "json",
    ]),
  ) as { name: string; tags: Record<string, string> | null }[];

  return groups.map((group) => ({ name: group.name, tags: group.tags ?? {} }));
}

/**
 * Starts deleting a fixture resource group without waiting for completion.
 */
export function deleteResourceGroup(resourceGroupName: string) {
  runAz(["group", "delete", "--name", resourceGroupName, "--yes", "--no-wait", "-o", "none"]);
}

/**
 * Reads a fixture manifest from disk.
 */
export function readManifest(manifestPath: string): FixtureManifest {
  // Un-validated cast. Schema validation happens before provisioning.
  return JSON.parse(readFileSync(manifestPath, "utf8")) as FixtureManifest;
}
