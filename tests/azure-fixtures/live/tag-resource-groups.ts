import { execFileSync } from "node:child_process";
import { getProfileEnvironment } from "../../utils/azure-environment.ts";

const AZ_COMMAND = process.platform === "win32" ? "az.cmd" : "az";
const separatorIndex = process.argv.indexOf("--resource-groups");
const resourceGroups = separatorIndex === -1 ? [] : process.argv.slice(separatorIndex + 1);

if (resourceGroups.length === 0) {
  throw new Error("At least one resource group must follow --resource-groups");
}

for (const resourceGroup of resourceGroups) {
  execFileSync(AZ_COMMAND, [
    "group",
    "update",
    "--name",
    resourceGroup,
    "--set",
    "tags.LiveTestPostProvisioned=True",
    "-o",
    "none",
  ], {
    env: getProfileEnvironment("write"),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}
