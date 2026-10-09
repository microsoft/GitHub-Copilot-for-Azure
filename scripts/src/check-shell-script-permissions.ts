import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Runs a Git command and returns its text output. */
function runGit(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

/** Verifies tracked shebang-bearing shell scripts have executable Git modes. */
function checkShellScriptPermissions(): boolean {
  const repositoryRoot = runGit(["rev-parse", "--show-toplevel"]).trim();
  const entries = runGit(["ls-files", "--stage", "-z", "--", ":(glob)**/*.sh"])
    .split("\0")
    .filter(Boolean);
  const invalidFiles: string[] = [];

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("\t");
    if (separatorIndex < 0) {
      throw new Error(`Unexpected git ls-files output: ${entry}`);
    }

    const metadata = entry.slice(0, separatorIndex).split(" ");
    const file = entry.slice(separatorIndex + 1);
    const firstLine = readFileSync(join(repositoryRoot, file), "utf8").split(/\r?\n/, 1)[0];

    if (firstLine.startsWith("#!") && metadata[0] !== "100755") {
      invalidFiles.push(file);
    }
  }

  if (invalidFiles.length === 0) {
    console.log("All tracked shebang-bearing .sh files are executable.");
    return true;
  }

  console.error("The following tracked shebang-bearing .sh files are not executable:");
  for (const file of invalidFiles) {
    console.error(`  ${file}`);
  }
  console.error("Run: git update-index --chmod=+x <path-to-script>");
  return false;
}

const valid = checkShellScriptPermissions();
process.exitCode = valid ? 0 : 1;

export { checkShellScriptPermissions };
