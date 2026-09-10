import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { unlinkDependencyLinks } from "../engine.ts";

describe("worktree dependency cleanup", () => {
  test("unlinks dependency junctions without deleting their targets", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-improvement-links-"));
    const source = path.join(root, "source");
    const worktree = path.join(root, "worktree");
    const link = path.join(worktree, "node_modules");
    fs.mkdirSync(source);
    fs.mkdirSync(worktree);
    fs.writeFileSync(path.join(source, "marker.txt"), "keep", "utf8");
    fs.symlinkSync(source, link, process.platform === "win32" ? "junction" : "dir");

    unlinkDependencyLinks(worktree);

    expect(fs.existsSync(link)).toBe(false);
    expect(fs.readFileSync(path.join(source, "marker.txt"), "utf8")).toBe("keep");
    fs.rmSync(root, { recursive: true, force: true });
  });
});
