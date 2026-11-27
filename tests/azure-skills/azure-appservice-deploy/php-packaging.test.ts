import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

const reference = fs.readFileSync(new URL(
  "../../../plugins/azure-skills/skills/azure-appservice-deploy/references/php/package.md", import.meta.url,
), "utf8").split("### Create a fresh ZIP")[1];
const snippets = [...reference.matchAll(/```(bash|powershell)\n([\s\S]*?)```/g)]
  .slice(0, 2).map(([, shell, code]) => [shell, code] as const);

test.each(snippets)("PHP %s packaging excludes secrets and cached config without changing source", (shell, code) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "php-package-"));
  const files = [
    "index.php", "composer.json", ".env", ".env.production", "nested/.env", "nested/.env.local",
    "bootstrap/cache/config.php", "bootstrap/cache/packages.php", "bootstrap/cache/.gitignore",
    "nested/bootstrap/cache/config.php", "storage/framework/views/.gitignore",
    "vendor/library.php", "nested/vendor/library.php", "node_modules/package.json", ".git/config",
  ];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), file);
  }
  const bashPath = (value: string) => process.platform === "win32"
    ? value.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`).replaceAll("\\", "/")
    : value;
  const bash = process.platform === "win32"
    ? path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Git", "bin", "bash.exe")
    : "bash";
  const ps = process.platform === "win32" ? "powershell" : "pwsh";
  try {
    const result = shell === "bash"
      ? spawnSync(bash, ["-c", `zip() { find . -type f | sed 's|^./||' > "$PACKAGE_FILES"; }\n${code}`], {
        cwd: root, encoding: "utf8", env: { ...process.env, PACKAGE_FILES: bashPath(path.join(root, "packaged-files")) },
      })
      : spawnSync(ps, ["-NoProfile", "-Command", code], { cwd: root, encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    let packaged: string[];
    if (shell === "bash") {
      packaged = fs.readFileSync(path.join(root, "packaged-files"), "utf8").trim().split(/\r?\n/);
    } else {
      const listing = spawnSync(ps, ["-NoProfile", "-Command",
        "Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead((Join-Path (Get-Location) 'app.zip')); try {$z.Entries.FullName -replace '\\\\','/'} finally {$z.Dispose()}",
      ], { cwd: root, encoding: "utf8" });
      expect(listing.status).toBe(0);
      packaged = listing.stdout.trim().split(/\r?\n/);
    }
    expect(packaged.sort()).toEqual([
      "bootstrap/cache/.gitignore", "composer.json", "index.php", "storage/framework/views/.gitignore",
    ]);
    for (const file of files) {
      expect(fs.readFileSync(path.join(root, file), "utf8")).toBe(file);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
