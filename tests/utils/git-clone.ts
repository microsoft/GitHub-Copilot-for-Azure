/**
 * Git Clone Utility
 *
 * Clones a Git repository to a local directory using simple-git.
 * Useful for integration tests that need a real repository as a workspace.
 */

import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { simpleGit, type SimpleGitOptions } from "simple-git";

export interface CloneOptions {
  /** Full repository URL (HTTPS or SSH). */
  repoUrl: string;
  /** Target directory to clone into. */
  targetDir: string;
  /** Clone only a single branch. */
  branch?: string;
  /** Shallow clone with the given depth (e.g. 1). */
  depth?: number;
  /** Only check out a specific path within the repo (sparse checkout). */
  sparseCheckoutPath?: string;
}

/**
 * Clone a Git repository.
 *
 * @example
 * ```ts
 * await cloneRepo({
 *   repoUrl: "https://github.com/Azure-Samples/todo-nodejs-mongo.git",
 *   targetDir: "/path/to/workspace",
 *   depth: 1,
 * });
 * ```
 */
export async function cloneRepo(options: CloneOptions): Promise<void> {
  const { repoUrl, targetDir, branch, depth, sparseCheckoutPath } = options;

  mkdirSync(targetDir, { recursive: true });

  const gitOptions: Partial<SimpleGitOptions> = {
    baseDir: targetDir,
    binary: "git",
    maxConcurrentProcesses: 1,
  };

  const git = simpleGit(gitOptions);

  const cloneArgs: string[] = [];
  if (branch) {
    cloneArgs.push("--branch", branch, "--single-branch");
  }
  if (depth) {
    cloneArgs.push("--depth", String(depth));
  }

  if (sparseCheckoutPath) {
    // Clone without checking out files, then sparse-checkout the target path
    cloneArgs.push("--filter=tree:0", "--no-checkout");
    await git.clone(repoUrl, targetDir, cloneArgs);
    await git.raw(["sparse-checkout", "set", sparseCheckoutPath]);
    await git.checkout();
  } else {
    await git.clone(repoUrl, targetDir, cloneArgs);
  }
}
