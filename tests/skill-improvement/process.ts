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

function processCommand(
  command: string,
  args: string[],
): { command: string; args: string[] } {
  if (process.platform !== "win32" || !/\.(cmd|bat)$/i.test(command)) {
    return { command, args };
  }
  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", command, ...args],
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
    const launch = processCommand(command, args);
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
