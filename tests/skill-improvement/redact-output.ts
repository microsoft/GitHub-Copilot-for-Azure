import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { redactSecrets } from "../utils/redact.ts";

function isProbablyText(contents: Buffer): boolean {
  return !contents.subarray(0, 8192).includes(0);
}

export function redactOutputDirectory(directory: string): number {
  let redactedFiles = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      redactedFiles += redactOutputDirectory(filePath);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const contents = fs.readFileSync(filePath);
    if (!isProbablyText(contents)) {
      continue;
    }
    const original = contents.toString("utf8");
    const redacted = redactSecrets(original);
    if (redacted !== original) {
      fs.writeFileSync(filePath, redacted, "utf8");
      redactedFiles += 1;
    }
  }
  return redactedFiles;
}

function main(): void {
  const directory = process.argv[2];
  if (!directory) {
    throw new Error("Usage: redact-output.ts <directory>");
  }
  const resolved = path.resolve(directory);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Output directory not found: ${resolved}`);
  }
  const count = redactOutputDirectory(resolved);
  console.log(`Applied repository-standard best-effort secret redaction to ${count} file(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
