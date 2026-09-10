import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findVallyRunDirectory,
  isGradedVallyRecord,
} from "../evaluation.ts";

describe("findVallyRunDirectory", () => {
  test("finds the timestamped directory containing eval results", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "vally-run-"));
    const runDirectory = path.join(root, "2026-09-10T05-09-08-698Z");
    fs.mkdirSync(runDirectory);
    fs.writeFileSync(path.join(runDirectory, "eval-results.md"), "# Results\n");
    fs.writeFileSync(path.join(root, "answers.jsonl"), "{}\n");

    try {
      expect(findVallyRunDirectory(root)).toBe(runDirectory);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("recognizes Vally 0.14 grade records without a type field", () => {
    expect(isGradedVallyRecord({
      status: "success",
      trajectory: { output: "answer" },
      gradeResult: { passed: true, score: 1 },
    })).toBe(true);
  });
});
