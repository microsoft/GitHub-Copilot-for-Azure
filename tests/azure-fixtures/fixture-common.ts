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
  path?: string;

  /**
   * Azure region to provision the resource group and its child resources.
   */
  location: string;

  /**
   * Base name of the resource group.
   */
  resourceGroupNameBase: string;

  /**
   * The parameter values for the Bicep template. Parameters are invalid when path is omitted.
   * The location parameter is always computed and provided.
   */
  parameters?: BicepParameterConfig[];
};

export type PostProvisionScriptConfig = {
  /**
   * Path to the script.
   * The path is relative to the location of the manifest file.
   */
  path: string;
};

export type PostTestScriptConfig = {
  /**
   * Path to the script.
   * The path is relative to the location of the manifest file.
   */
  path: string;
};

/**
 * Manifest for provisioning the Azure fixture.
 */
export type FixtureManifest = {
  /**
   * Stable identifier used for locating fixtures for a manifest.
   */
  id: string;

  /**
   * Whether the fixture expects modification from the tasks depending on it.
   */
  type: "readOnly" | "readWrite";

  /**
   * Version of the fixture.
   */
  version: number;

  /**
   * Version of the manifest schema.
   */
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
   * Persistence policy: never (default) creates a new fixture with a 3-hour lifetime;
   * temporary coordinates reuse with a blob lease and refreshes a 24-hour lifetime;
   * permanent discovers existing fixtures or provisions them with DoNotDelete=True.
   */
  persistence?: "never" | "temporary" | "permanent";

  /**
   * Additional post-provision script to run after provisioning the fixtures but before running the test.
   * Post-provision scripts are given the computed resource group names.
   * --resource-groups <rg-1> <rg-2> ... <rg-n>
   *
   * The post-provision script will be executed via tsx and must be written in Typescript.
   */
  postProvisionScript?: PostProvisionScriptConfig;

  /**
   * Only executed when the fixture is referenced by a Vally stimuli.
   *
   * Additional post-provision script to run after the test finishes.
   * Post-provision scripts are given the computed resource group names.
   * --resource-groups <rg-1> <rg-2> ... <rg-n>
   *
   * The post-test script will be executed via tsx and must be written in Typescript.
   */
  postTestScript?: PostTestScriptConfig;
};

export type ProvisionScriptOutput = {
  /**
   * Names of the resource groups to use for test.
   */
  resourceGroups: string[];

  /**
   * Workflow fixture identity and the exact resource groups selected for use.
   */
  fixtureId?: string;
  fixtureVersion?: number;
  fixtureInstanceId?: string;
  resourceGroupIdsByComponent?: Record<string, string>;
};

export const FIXTURE_ID_TAG = "FixtureId";
export const FIXTURE_VERSION_TAG = "FixtureVersion";

const AZ_COMMAND = process.platform === "win32" ? "az.cmd" : "az";

export type RunBudget = {
  /** Caps the total wall clock time the script may spend in child processes. */
  set(totalMs: number): void;
  /**
   * Milliseconds left in the run budget, or undefined when no budget was set.
   * @throws An error if the budget is already exhausted.
   */
  remainingMs(step: string): number | undefined;
};

/** Creates a budget measured with the supplied clock. */
export function createBudget(now: () => number = Date.now): RunBudget {
  let deadline = Number.POSITIVE_INFINITY;
  return {
    set(totalMs) {
      deadline = now() + totalMs;
    },
    remainingMs(step) {
      if (deadline === Number.POSITIVE_INFINITY) {
        return undefined;
      }
      const remaining = deadline - now();
      if (remaining <= 0) {
        throw new Error(`Time budget was exhausted before ${step}`);
      }
      return remaining;
    },
  };
}

/**
 * Helper function to run a single AZ CLI command.
 * @param args arguments to pass to the AZ CLI command, excluding `az`.
 * @param options supplies the run budget and controls whether it constrains the command.
 * @returns A string capturing the stdout output.
 * @throws An error if the command exits with a non-zero exit code or the budget runs out.
 */
export function runAz(args: string[], options: { subjectToBudget?: boolean; budget?: RunBudget } = {}): string {
  const step = `az ${args.join(" ")}`;
  try {
    // az traps SIGTERM and can hang, so kill it outright.
    return execFileSync(AZ_COMMAND, args, {
      encoding: "utf8",
      timeout: options.subjectToBudget === false ? undefined : options.budget?.remainingMs(step),
      killSignal: "SIGKILL",
      shell: process.platform === "win32"
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
export function findFixtureResourceGroups(
  fixtureId: string,
  runCommand: typeof runAz = runAz,
): FixtureResourceGroup[] {
  const groups = JSON.parse(
    runCommand([
      "group",
      "list",
      "--tag",
      `${FIXTURE_ID_TAG}=${fixtureId}`,
      "--query",
      "[].{name:name,tags:tags}",
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
  runAz(
    ["group", "delete", "--name", resourceGroupName, "--yes", "--no-wait", "-o", "none"],
    { subjectToBudget: false },
  );
}

/**
 * Reads a fixture manifest from disk.
 */
export function readManifest(manifestPath: string): FixtureManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as FixtureManifest;
}
