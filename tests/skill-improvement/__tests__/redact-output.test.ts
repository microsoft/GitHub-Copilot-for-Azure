import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { redactOutputDirectory } from "../redact-output.ts";
import { describe, expect, test } from "vitest";

describe("Azure Storage report redaction", () => {
  test("redacts text recursively and preserves binary files", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-redact-"));
    const nested = path.join(root, "generation");
    const binary = Buffer.from([0, 1, 2, 3]);
    fs.mkdirSync(nested);
    fs.writeFileSync(
      path.join(nested, "answers.jsonl"),
      '{"token":"123456789-secret-value"}\n',
      "utf8"
    );
    fs.writeFileSync(path.join(root, "candidate.bin"), binary);

    try {
      expect(redactOutputDirectory(root)).toBe(1);
      expect(fs.readFileSync(path.join(nested, "answers.jsonl"), "utf8"))
        .toContain('"token":"[REDACTED]"');
      expect(fs.readFileSync(path.join(root, "candidate.bin"))).toEqual(binary);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
