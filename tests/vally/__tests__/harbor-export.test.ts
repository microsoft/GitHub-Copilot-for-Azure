import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { harborExport } from "../harbor-export.ts";

const { readDirectory } = vi.hoisted(() => ({ readDirectory: vi.fn() }));

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("node:fs", () => ({
  readdirSync: readDirectory,
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const root = fileURLToPath(new URL("../../../", import.meta.url));
const evalPath = path.join(root, "evals/azure-skills/azure-kusto/eval.yaml");
const taskDir = path.join(root, "harbor/azure-kusto/query-logs");

describe("harborExport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(statSync).mockReturnValue({
      isFile: () => true,
      isDirectory: () => true,
    } as ReturnType<typeof statSync>);
    readDirectory.mockReturnValue([
      { name: "query-logs", isDirectory: () => true },
    ]);
    vi.mocked(readFileSync).mockImplementation(file =>
      String(file).endsWith("Dockerfile")
        ? 'FROM ubuntu:24.04\nUSER root\nWORKDIR /app\nCOPY ["fixture/", "/app/fixture/"]\n'
        : '[agent]\ntimeout_sec = 600\n[environment]\nbuild_timeout_sec = 600\n[metadata]\nname = "query"\n');
  });

  test("exports, rebases fixtures, builds from the root, and configures the image", () => {
    harborExport(evalPath);

    expect(execFileSync).toHaveBeenNthCalledWith(1, expect.stringMatching(/^npx(\.cmd)?$/), [
      "--no-install", "vally", "export",
      "--eval-spec", evalPath,
      "--exporter", "@microsoft/vally-exporter-harbor",
      "--output-dir", path.join(root, "harbor/azure-kusto"),
    ], expect.objectContaining({ cwd: path.join(root, "tests") }));
    expect(writeFileSync).toHaveBeenNthCalledWith(1, path.join(taskDir, "environment/Dockerfile"),
      expect.stringContaining('USER root\nENV npm_config_registry=https://packagefeedproxy.microsoft.io/npm/\nRUN command apt-get update && apt-get install -y --no-install-recommends build-essential python3\nCOPY ["output/azure-skills/skills/","/skills/"]'));
    expect(writeFileSync).toHaveBeenNthCalledWith(1, expect.any(String),
      expect.stringContaining('COPY ["harbor/azure-kusto/query-logs/environment/fixture/","/app/fixture/"]'));
    expect(execFileSync).toHaveBeenNthCalledWith(2, "docker", [
      "build", "--file", path.join(taskDir, "environment/Dockerfile"),
      "--tag", "harbor/azure-kusto:query-logs", root,
    ], expect.objectContaining({ cwd: root }));
    expect(writeFileSync).toHaveBeenLastCalledWith(path.join(taskDir, "task.toml"),
      '[agent]\ntimeout_sec = 600\n[environment]\ndocker_image = "harbor/azure-kusto:query-logs"\nbuild_timeout_sec = 600\n[metadata]\nname = "query"\n');
  });

  test("does not configure an image when its build fails", () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => Buffer.from(""))
      .mockImplementationOnce(() => { throw new Error("Docker build failed"); });

    expect(() => harborExport(evalPath)).toThrow("Docker build failed");
    expect(writeFileSync).toHaveBeenCalledTimes(1);
  });

  test("rejects relative eval paths before executing commands", () => {
    expect(() => harborExport("../evals/eval.yaml")).toThrow("absolute path");
    expect(execFileSync).not.toHaveBeenCalled();
  });
});
