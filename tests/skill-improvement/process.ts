import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { WriteStream } from "node:fs";

export type ProcessOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  stdinFile?: string;
  stdoutFile?: string;
  stderrFile?: string;
  timeoutMs?: number;
  allowFailure?: boolean;
};

export type ProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function finishStream(stream: WriteStream | undefined): Promise<void> {
  if (!stream) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    stream.once("error", reject);
    stream.end(resolve);
  });
}

export function commandName(name: string): string {
  return process.platform === "win32" && (name === "npx" || name === "npm")
    ? `${name}.cmd`
    : name;
}

type ProcessRuntime = {
  platform: NodeJS.Platform;
  nodeExecutable: string;
  nodeInstallDirectory: string;
};

const defaultProcessRuntime: ProcessRuntime = {
  platform: process.platform,
  nodeExecutable: process.execPath,
  nodeInstallDirectory: path.dirname(process.execPath),
};

export function resolveProcessLaunch(
  command: string,
  args: string[],
  runtime: ProcessRuntime = defaultProcessRuntime,
): { command: string; args: string[] } {
  if (runtime.platform !== "win32" || !/\.(cmd|bat)$/i.test(command)) {
    return { command, args };
  }
  const commandBaseName = path.basename(command).toLowerCase();
  if (commandBaseName !== "npm.cmd" && commandBaseName !== "npx.cmd") {
    throw new Error(
      `Cannot safely execute Windows batch command without a shell: ${command}`
    );
  }
  const cliName = commandBaseName === "npm.cmd" ? "npm-cli.js" : "npx-cli.js";
  const cliPath = path.join(
    runtime.nodeInstallDirectory,
    "node_modules",
    "npm",
    "bin",
    cliName
  );
  if (!fs.existsSync(cliPath)) {
    throw new Error(
      `Unable to resolve ${commandBaseName} JavaScript CLI at ${cliPath}.`
    );
  }
  return {
    command: runtime.nodeExecutable,
    args: [cliPath, ...args],
  };
}

export async function runProcess(
  command: string,
  args: string[],
  options: ProcessOptions,
): Promise<ProcessResult> {
  return await new Promise<ProcessResult>((resolve, reject) => {
    fs.mkdirSync(path.dirname(options.stdoutFile ?? path.join(options.cwd, "unused")), {
      recursive: true,
    });
    const stdoutStream = options.stdoutFile
      ? fs.createWriteStream(options.stdoutFile, { encoding: "utf8" })
      : undefined;
    const stderrStream = options.stderrFile
      ? fs.createWriteStream(options.stderrFile, { encoding: "utf8" })
      : undefined;
    const stdinFd = options.stdinFile ? fs.openSync(options.stdinFile, "r") : undefined;
    const launch = resolveProcessLaunch(command, args);
    const child = spawn(launch.command, launch.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: [
        stdinFd ?? "ignore",
        "pipe",
        "pipe",
      ],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = options.timeoutMs
      ? setTimeout(() => {
        timedOut = true;
        child.kill();
      }, options.timeoutMs)
      : undefined;

    child.stdout!.setEncoding("utf8");
    child.stderr!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => {
      if (!options.stdoutFile) {
        stdout += chunk;
      }
      stdoutStream?.write(chunk);
    });
    child.stderr!.on("data", (chunk: string) => {
      if (!options.stderrFile || stderr.length < 20_000) {
        stderr += chunk;
      }
      stderrStream?.write(chunk);
    });
    child.on("error", error => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (stdinFd !== undefined) {
        fs.closeSync(stdinFd);
      }
      stdoutStream?.end();
      stderrStream?.end();
      reject(error);
    });
    child.on("close", code => {
      void (async () => {
        if (timeout) {
          clearTimeout(timeout);
        }
        if (stdinFd !== undefined) {
          fs.closeSync(stdinFd);
        }
        await Promise.all([
          finishStream(stdoutStream),
          finishStream(stderrStream),
        ]);
        const exitCode = code ?? 1;
        if (timedOut) {
          reject(new Error(`${command} timed out after ${options.timeoutMs}ms.`));
          return;
        }
        if (exitCode !== 0 && !options.allowFailure) {
          reject(new Error(
            `${command} ${args.join(" ")} failed with exit code ${exitCode}.\n${stderr || stdout}`
          ));
          return;
        }
        resolve({ exitCode, stdout, stderr });
      })().catch(reject);
    });
  });
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(items[index], index);
      }
    }
  );
  await Promise.all(workers);
}
