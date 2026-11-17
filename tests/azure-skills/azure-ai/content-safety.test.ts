import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, it } from "vitest";

type Report = {
  specVersion: string;
  operation: string;
  status: string;
  details: Record<string, unknown>;
  findings: Array<{ code: string; severity: string; detail: string }>;
};

const script = process.env.CS_VALIDATOR_PATH ?? fileURLToPath(new URL(
  "../../../output/azure-skills/skills/azure-ai/scripts/validate-content-safety-request.mjs", import.meta.url,
));
const { validateContentSafetyRequest } = (await import(pathToFileURL(script).href)) as {
  validateContentSafetyRequest: (opts: Record<string, unknown>) => Promise<Report>;
};
const SECRET = "SYNTHETIC_PRIVATE_PROMPT_DO_NOT_EMIT";
const isWindows = process.platform === "win32";

function resolveExecutable(command: string): string | undefined {
  try {
    return execFileSync(isWindows ? "where.exe" : "which", [command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().split(/\r?\n/)[0] || undefined;
  } catch {
    return undefined;
  }
}

function makePng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "cs-preflight-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

it("validates text-analyze limits, blocklist name rules, and haltOnBlocklistHit without emitting text", async () => {
  await withTempDir(async (dir) => {
    const okFile = join(dir, "text-ok.json");
    await writeFile(okFile, JSON.stringify({
      text: SECRET,
      categories: ["Hate", "Violence"],
      blocklistNames: ["valid_list-1.0"],
      haltOnBlocklistHit: true,
      outputType: "EightSeverityLevels",
    }));
    const ok = await validateContentSafetyRequest({ operation: "text-analyze", payloadFile: okFile });
    expect(ok.status).toBe("passed_local_checks");
    expect(ok.findings.map((f) => f.code)).toContain("HALT_ON_BLOCKLIST_HIT_OMITS_CATEGORIES");
    expect(JSON.stringify(ok)).not.toContain(SECRET);

    const badFile = join(dir, "text-bad.json");
    await writeFile(badFile, JSON.stringify({
      text: "x".repeat(10001),
      categories: ["InvalidCat"],
      blocklistNames: ["bad space!"],
    }));
    const bad = await validateContentSafetyRequest({ operation: "text-analyze", payloadFile: badFile });
    expect(bad.status).toBe("failed_preflight");
    const codes = bad.findings.map((f) => f.code);
    expect(codes).toContain("EXCEEDS_TEXT_CHAR_LIMIT");
    expect(codes).toContain("UNSUPPORTED_HARM_CATEGORY");
    expect(codes).toContain("INVALID_BLOCKLIST_NAME_CHARACTERS");

    // An empty categories array is undocumented (omit it for the default set); a non-array is invalid.
    const emptyCats = join(dir, "text-empty-cats.json");
    await writeFile(emptyCats, JSON.stringify({ text: "hello", categories: [] }));
    const empty = await validateContentSafetyRequest({ operation: "text-analyze", payloadFile: emptyCats });
    expect(empty.status).toBe("passed_with_warnings");
    expect(empty.findings.map((f) => f.code)).toEqual(["EMPTY_CATEGORIES_ARRAY"]);

    const stringCats = join(dir, "text-string-cats.json");
    await writeFile(stringCats, JSON.stringify({ text: "hello", categories: "Hate" }));
    const notArray = await validateContentSafetyRequest({ operation: "text-analyze", payloadFile: stringCats });
    expect(notArray.status).toBe("failed_preflight");
    expect(notArray.findings.map((f) => f.code)).toContain("INVALID_CATEGORIES_ARRAY");

    // Non-boolean haltOnBlocklistHit (e.g. string "false") is rejected rather than coerced to true.
    const stringHalt = join(dir, "text-string-halt.json");
    await writeFile(stringHalt, JSON.stringify({ text: "hello", haltOnBlocklistHit: "false" }));
    const badHalt = await validateContentSafetyRequest({ operation: "text-analyze", payloadFile: stringHalt });
    expect(badHalt.status).toBe("failed_preflight");
    expect(badHalt.details.haltOnBlocklistHit).toBe("invalid");
    expect(badHalt.findings.map((f) => f.code)).toContain("INVALID_HALT_ON_BLOCKLIST_HIT_TYPE");
  });
});

it("validates image-analyze dimensions, data-URI prefix, and EightSeverityLevels rejection", async () => {
  await withTempDir(async (dir) => {
    const validPng = makePng(120, 120);
    const okImg = join(dir, "img.png");
    await writeFile(okImg, validPng);
    const ok = await validateContentSafetyRequest({ operation: "image-analyze", imageFile: okImg });
    expect(ok.status).toBe("passed_local_checks");

    const badPayload = join(dir, "img-bad.json");
    await writeFile(badPayload, JSON.stringify({
      image: { content: `data:image/png;base64,${makePng(20, 8000).toString("base64")}` },
      outputType: "EightSeverityLevels",
    }));
    const bad = await validateContentSafetyRequest({ operation: "image-analyze", payloadFile: badPayload });
    const codes = bad.findings.map((f) => f.code);
    expect(codes).toContain("DATA_URI_PREFIX_IN_BASE64");
    expect(codes).toContain("UNSUPPORTED_IMAGE_OUTPUT_TYPE");
    expect(codes).toContain("IMAGE_DIMENSIONS_OUT_OF_RANGE");
    expect(codes).not.toContain("BASE64URL_ALPHABET_IN_CONTENT");

    const urlSafe = join(dir, "img-base64url.json");
    // Trailing 0xFB 0xFF 0xFE guarantees '-'/'_' in base64url (standard base64 would use '+'/'/').
    const pngWithTail = Buffer.concat([makePng(120, 120), Buffer.from([0xfb, 0xff, 0xfe])]);
    await writeFile(urlSafe, JSON.stringify({ image: { content: pngWithTail.toString("base64url") } }));
    const urlRes = await validateContentSafetyRequest({ operation: "image-analyze", payloadFile: urlSafe });
    expect(urlRes.findings.map((f) => f.code)).toContain("BASE64URL_ALPHABET_IN_CONTENT");

    // Learn states 2048x2048 (2024-09-01 API reference) and 7200x7200 (input-requirements table): warn in between.
    const midImg = join(dir, "mid.png");
    await writeFile(midImg, makePng(3000, 3000));
    const mid = await validateContentSafetyRequest({ operation: "image-analyze", imageFile: midImg });
    expect(mid.status).toBe("passed_with_warnings");
    expect(mid.findings.map((f) => f.code)).toEqual(["IMAGE_DIMENSIONS_ABOVE_2048"]);

    const hugeImg = join(dir, "huge.png");
    await writeFile(hugeImg, makePng(7201, 100));
    const huge = await validateContentSafetyRequest({ operation: "image-analyze", imageFile: hugeImg });
    expect(huge.findings.find((f) => f.code === "IMAGE_DIMENSIONS_OUT_OF_RANGE")?.severity).toBe("error");

    // Remote blobUrl and unrecognized image bytes report status 'unknown' instead of claiming passed_local_checks.
    const blobPayload = join(dir, "img-blob.json");
    await writeFile(blobPayload, JSON.stringify({ image: { blobUrl: `https://blob.example/img.png?sig=${SECRET}` } }));
    const blobRes = await validateContentSafetyRequest({ operation: "image-analyze", payloadFile: blobPayload });
    expect(blobRes.status).toBe("unknown");
    expect(blobRes.findings.map((f) => f.code)).toContain("REMOTE_BLOB_IMAGE_NOT_INSPECTED");
    expect(JSON.stringify(blobRes)).not.toContain(SECRET);

    const unkImg = join(dir, "mystery.bin");
    await writeFile(unkImg, `BMWs and text ${SECRET}`);
    const unkImgRes = await validateContentSafetyRequest({ operation: "image-analyze", imageFile: unkImg });
    expect(unkImgRes.status).toBe("unknown");
    expect(unkImgRes.details.detectedFormat).toBe("unrecognized");
    expect(JSON.stringify(unkImgRes)).not.toContain(SECRET);
  });
});

it("validates shield-prompt userPrompt and documents limits without emitting prompts", async () => {
  await withTempDir(async (dir) => {
    const okShield = join(dir, "shield-ok.json");
    await writeFile(okShield, JSON.stringify({
      userPrompt: SECRET,
      documents: [`Doc_${SECRET}`],
    }));
    const ok = await validateContentSafetyRequest({ operation: "shield-prompt", payloadFile: okShield });
    expect(ok.status).toBe("passed_local_checks");
    expect(JSON.stringify(ok)).not.toContain(SECRET);

    const badShield = join(dir, "shield-bad.json");
    await writeFile(badShield, JSON.stringify({
      userPrompt: "",
      documents: ["a".repeat(2000), "b".repeat(2000), "c".repeat(2000), "d".repeat(2000), "e".repeat(2000), "f".repeat(100)],
    }));
    const bad = await validateContentSafetyRequest({ operation: "shield-prompt", payloadFile: badShield });
    const codes = bad.findings.map((f) => f.code);
    expect(codes).toContain("EXCEEDS_DOCUMENTS_COUNT_LIMIT");
    expect(codes).toContain("EXCEEDS_DOCUMENTS_TOTAL_CHAR_LIMIT");
  });
});

const launchers = [
  {
    name: "Bash",
    executable: isWindows ? undefined : resolveExecutable("bash"),
    file: "validate-content-safety-request.sh",
    args: (file: string, ...rest: string[]) => [file, ...rest],
  },
  {
    name: "PowerShell",
    executable: resolveExecutable(isWindows ? "powershell" : "pwsh"),
    file: "validate-content-safety-request.ps1",
    args: (file: string, ...rest: string[]) => ["-NoProfile", "-File", file, ...rest],
  },
];

for (const launcher of launchers) {
  it.skipIf(!launcher.executable)(`${launcher.name} launcher enforces Node.js 22+ preflight`, async () => {
    await withTempDir(async (dir) => {
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toLowerCase() !== "path"));
      const noNodePath = isWindows ? [dir, join(process.env.SystemRoot ?? "C:\\Windows", "System32")].join(delimiter) : dir;
      const missing = spawnSync(launcher.executable as string, launcher.args(join(dirname(script), launcher.file), "--help"), {
        encoding: "utf8",
        env: { ...env, PATH: noNodePath },
      });
      expect(missing.status).toBe(3);
      expect(JSON.parse(missing.stderr).error).toBe("NODE_REQUIRED");
    });
  });
}
