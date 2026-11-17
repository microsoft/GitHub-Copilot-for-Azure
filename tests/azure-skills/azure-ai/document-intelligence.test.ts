import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdtemp, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, it } from "vitest";

type Finding = { code: string; severity: string; detail: string };
type Report = {
  specVersion: string;
  tier: string;
  modelKind: string;
  status: string;
  document?: {
    extension: string;
    byteLength: number;
    detectedFormat: string;
    encrypted: boolean;
    dimensions?: { width: number; height: number };
    pageCount?: number;
    pageCountBasis: string;
  };
  labels?: {
    labelCount: number;
    emptyValueCount: number;
    duplicateLabelCount: number;
    outOfBoundsBoxCount: number;
    overlappingPairCount: number;
    ocr?: { hasAnalyzeResult: boolean; pageCount?: number };
  };
  findings: Finding[];
};

const script = process.env.DI_INSPECTOR_PATH ?? fileURLToPath(new URL(
  "../../../output/azure-skills/skills/azure-ai/scripts/inspect-document-input.mjs", import.meta.url,
));
const { inspectDocumentInput } = (await import(pathToFileURL(script).href)) as {
  inspectDocumentInput: (opts: Record<string, unknown>) => Promise<Report>;
};
const SECRET = "SYNTHETIC_PRIVATE_CONTENT_DO_NOT_EMIT";
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
  buf[24] = 8;
  buf[25] = 2;
  return buf;
}

function makeFakeZipEntry(entryName: string): Buffer {
  const nameBytes = Buffer.from(entryName, "ascii");
  const local = Buffer.alloc(30 + nameBytes.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(nameBytes.length, 26);
  nameBytes.copy(local, 30);
  return local;
}

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "di-preflight-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

it("valid PDF passes S0 preflight and flags F0 2-page cap without emitting text", async () => {
  await withTempDir(async (dir) => {
    const pdf = join(dir, "sample.pdf");
    const content = `%PDF-1.7\n1 0 obj << /Type /Page >> endobj\n2 0 obj << /Type /Page >> endobj\n3 0 obj << /Type /Page /Contents (${SECRET}) >> endobj\n%%EOF`;
    await writeFile(pdf, content, "latin1");

    const s0 = await inspectDocumentInput({ file: pdf, tier: "S0", modelKind: "layout" });
    expect(s0.status).toBe("passed_local_checks");
    expect(s0.document?.detectedFormat).toBe("pdf");
    expect(s0.document?.pageCount).toBe(3);
    expect(JSON.stringify(s0)).not.toContain(SECRET);

    const f0 = await inspectDocumentInput({ file: pdf, tier: "F0", modelKind: "layout" });
    expect(f0.findings.map((f) => f.code)).toContain("F0_TWO_PAGE_LIMIT");

    // Tiny single-page PDF (<= 64 bytes) and chunk-boundary /Type /Page + /EncryptMetadata must be counted accurately.
    const tinyPdf = join(dir, "one-page.pdf");
    await writeFile(tinyPdf, "%PDF-1.7\n<< /Type /Page >>\n%%EOF", "latin1");
    const onePage = await inspectDocumentInput({ file: tinyPdf, tier: "F0", modelKind: "layout" });
    expect(onePage.document?.pageCount).toBe(1);
    expect(onePage.findings.map((f) => f.code)).not.toContain("F0_TWO_PAGE_LIMIT");

    const boundaryPdf = join(dir, "boundary.pdf");
    const prefixLen = 1024 * 1024 - 6; // splits "/Type /Page" and "/EncryptMetadata" right across 1 MiB chunk boundaries
    const chunk1 = `%PDF-1.7\n${" ".repeat(prefixLen - 9)}/Type /Page >>\n`;
    const pad2 = 2 * 1024 * 1024 - chunk1.length - 8;
    const fullBoundary = `${chunk1}${" ".repeat(pad2)}/EncryptMetadata false >>\n%%EOF`;
    await writeFile(boundaryPdf, fullBoundary, "latin1");
    const boundaryRes = await inspectDocumentInput({ file: boundaryPdf });
    expect(boundaryRes.document?.pageCount).toBe(1);
    expect(boundaryRes.document?.encrypted).toBe(false);
    expect(boundaryRes.status).toBe("passed_local_checks");
  });
});

it("detects encrypted PDF, HTML disguised as PDF, small PNG, and unsupported GIF", async () => {
  await withTempDir(async (dir) => {
    const lockedPdf = join(dir, "locked.pdf");
    await writeFile(lockedPdf, "%PDF-1.7\n1 0 obj << /Encrypt 2 0 R >> endobj\n", "latin1");
    const locked = await inspectDocumentInput({ file: lockedPdf });
    // A /Encrypt marker can mean a password lock or only permission restrictions, so it warns.
    expect(locked.status).toBe("passed_with_warnings");
    expect(locked.findings.find((f) => f.code === "PASSWORD_OR_ENCRYPTION_DETECTED")?.severity).toBe("warning");

    const htmlAsPdf = join(dir, "login.pdf");
    await writeFile(htmlAsPdf, `<!DOCTYPE html><html><body>${SECRET}</body></html>`, "utf8");
    const mismatch = await inspectDocumentInput({ file: htmlAsPdf });
    expect(mismatch.status).toBe("passed_with_warnings");
    expect(mismatch.findings.map((f) => f.code)).toContain("EXTENSION_FORMAT_MISMATCH");
    expect(JSON.stringify(mismatch)).not.toContain(SECRET);

    const tinyPng = join(dir, "tiny.png");
    await writeFile(tinyPng, makePng(32, 100));
    const tiny = await inspectDocumentInput({ file: tinyPng });
    expect(tiny.findings.map((f) => f.code)).toContain("IMAGE_DIMENSIONS_OUT_OF_RANGE");

    const gif = join(dir, "anim.gif");
    await writeFile(gif, "GIF89a000000", "ascii");
    const gifReport = await inspectDocumentInput({ file: gif });
    expect(gifReport.findings.map((f) => f.code)).toContain("UNSUPPORTED_DOCUMENT_FORMAT");

    // Plain text starting with "BM" must not be misidentified as a BMP image.
    const bmText = join(dir, "notes.txt");
    await writeFile(bmText, `BMWs and other vehicles discussed in ${SECRET} plain text notes.\n`, "utf8");
    const bmReport = await inspectDocumentInput({ file: bmText });
    expect(bmReport.document?.detectedFormat).toBe("unrecognized");
    expect(bmReport.status).toBe("unknown");
    expect(JSON.stringify(bmReport)).not.toContain(SECRET);

    // TIFF with IFD placed past 4 MiB (standard libtiff strip-first layout) still resolves dimensions and page count.
    const tiff = join(dir, "scan.tiff");
    const ifdOffset = 5 * 1024 * 1024;
    const tiffHead = Buffer.alloc(8);
    tiffHead.write("II", 0, "ascii");
    tiffHead.writeUInt16LE(42, 2);
    tiffHead.writeUInt32LE(ifdOffset, 4);
    const ifd = Buffer.alloc(2 + 2 * 12 + 4);
    ifd.writeUInt16LE(2, 0);
    ifd.writeUInt16LE(256, 2); ifd.writeUInt16LE(4, 4); ifd.writeUInt32LE(1, 6); ifd.writeUInt32LE(600, 10);
    ifd.writeUInt16LE(257, 14); ifd.writeUInt16LE(4, 16); ifd.writeUInt32LE(1, 18); ifd.writeUInt32LE(800, 22);
    ifd.writeUInt32LE(0, 26);
    await writeFile(tiff, tiffHead);
    await truncate(tiff, ifdOffset);
    const { open } = await import("node:fs/promises");
    const h = await open(tiff, "r+");
    try {
      await h.write(ifd, 0, ifd.length, ifdOffset);
    } finally {
      await h.close();
    }
    const tiffRes = await inspectDocumentInput({ file: tiff });
    expect(tiffRes.status).toBe("passed_local_checks");
    expect(tiffRes.document?.dimensions).toEqual({ width: 600, height: 800 });
    expect(tiffRes.document?.pageCount).toBe(1);

    // Multi-page TIFF with valid page 1 and out-of-range page 2 must fail dimension preflight.
    const multiTiff = join(dir, "multi-bad-page2.tiff");
    const ifdSize = 2 + 2 * 12 + 4;
    const writeIfd = (target: Buffer, offset: number, w: number, hVal: number, nextOffset: number): void => {
      target.writeUInt16LE(2, offset);
      target.writeUInt16LE(256, offset + 2); target.writeUInt16LE(4, offset + 4);
      target.writeUInt32LE(1, offset + 6); target.writeUInt32LE(w, offset + 10);
      target.writeUInt16LE(257, offset + 14); target.writeUInt16LE(4, offset + 16);
      target.writeUInt32LE(1, offset + 18); target.writeUInt32LE(hVal, offset + 22);
      target.writeUInt32LE(nextOffset, offset + 26);
    };
    const twoPageBuf = Buffer.alloc(8 + ifdSize * 2);
    twoPageBuf.write("II", 0, "ascii"); twoPageBuf.writeUInt16LE(42, 2); twoPageBuf.writeUInt32LE(8, 4);
    writeIfd(twoPageBuf, 8, 600, 800, 8 + ifdSize);
    writeIfd(twoPageBuf, 8 + ifdSize, 20, 800, 0);
    await writeFile(multiTiff, twoPageBuf);
    const multiRes = await inspectDocumentInput({ file: multiTiff });
    expect(multiRes.status).toBe("failed_preflight");
    expect(multiRes.document?.dimensions).toEqual({ width: 600, height: 800 });
    expect(multiRes.findings.map((f) => f.code)).toContain("IMAGE_DIMENSIONS_OUT_OF_RANGE");

    // TIFF exceeding the 2,500-IFD scan cap preserves the 2,500 lower bound, triggers EXCEEDS_MAX_PAGES, and returns 'unknown'.
    const cappedTiff = join(dir, "capped-pages.tiff");
    const totalIfds = 2505;
    const cappedBuf = Buffer.alloc(8 + ifdSize * totalIfds);
    cappedBuf.write("II", 0, "ascii"); cappedBuf.writeUInt16LE(42, 2); cappedBuf.writeUInt32LE(8, 4);
    for (let p = 0; p < totalIfds; p += 1) {
      const cur = 8 + p * ifdSize;
      const next = p + 1 < totalIfds ? 8 + (p + 1) * ifdSize : 0;
      writeIfd(cappedBuf, cur, 200, 200, next);
    }
    await writeFile(cappedTiff, cappedBuf);
    const cappedRes = await inspectDocumentInput({ file: cappedTiff, tier: "S0" });
    expect(cappedRes.status).toBe("unknown");
    expect(cappedRes.document?.pageCount).toBe(2500);
    expect(cappedRes.findings.map((f) => f.code)).toEqual(
      expect.arrayContaining(["TIFF_PAGE_SCAN_INCOMPLETE", "EXCEEDS_MAX_PAGES"]),
    );

    // Cyclic TIFF IFD chain (IFD pointing back to itself) reports TIFF_PAGE_SCAN_INCOMPLETE and status 'unknown'.
    const cyclicTiff = join(dir, "cyclic.tiff");
    const cyclicBuf = Buffer.alloc(8 + ifdSize);
    cyclicBuf.write("II", 0, "ascii"); cyclicBuf.writeUInt16LE(42, 2); cyclicBuf.writeUInt32LE(8, 4);
    writeIfd(cyclicBuf, 8, 200, 200, 8);
    await writeFile(cyclicTiff, cyclicBuf);
    const cyclicRes = await inspectDocumentInput({ file: cyclicTiff });
    expect(cyclicRes.status).toBe("unknown");
    expect(cyclicRes.findings.map((f) => f.code)).toContain("TIFF_PAGE_SCAN_INCOMPLETE");

    // JPEG whose SOF0 marker sits past 256 KiB of APP1 metadata still resolves small dimensions (< 50 px),
    // while a headerless/truncated JPEG without SOF reports status 'unknown'.
    const makeApp1 = (payloadLen: number): Buffer => {
      const seg = Buffer.alloc(2 + 2 + payloadLen);
      seg[0] = 0xff; seg[1] = 0xe1;
      seg.writeUInt16BE(2 + payloadLen, 2);
      return seg;
    };
    const sof0Tiny = Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x20, 0x00, 0x20, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);
    const bigMetaJpeg = join(dir, "big-exif-tiny.jpg");
    await writeFile(bigMetaJpeg, Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      makeApp1(60000), makeApp1(60000), makeApp1(60000), makeApp1(60000), makeApp1(60000),
      sof0Tiny,
    ]));
    const bigMetaRes = await inspectDocumentInput({ file: bigMetaJpeg });
    expect(bigMetaRes.status).toBe("failed_preflight");
    expect(bigMetaRes.document?.dimensions).toEqual({ width: 32, height: 32 });
    expect(bigMetaRes.findings.map((f) => f.code)).toContain("IMAGE_DIMENSIONS_OUT_OF_RANGE");

    const truncJpeg = join(dir, "truncated.jpg");
    await writeFile(truncJpeg, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const truncJpegRes = await inspectDocumentInput({ file: truncJpeg });
    expect(truncJpegRes.status).toBe("unknown");
    expect(truncJpegRes.findings.map((f) => f.code)).toContain("IMAGE_DIMENSIONS_NOT_DETERMINED");
  });
});

it("enforces v4 Office/HTML model-kind restrictions and unrecognized files stay unknown", async () => {
  await withTempDir(async (dir) => {
    const docx = join(dir, "contract.docx");
    await writeFile(docx, makeFakeZipEntry("word/document.xml"));

    const layoutReport = await inspectDocumentInput({ file: docx, modelKind: "layout" });
    expect(layoutReport.status).toBe("passed_local_checks");
    expect(layoutReport.findings.map((f) => f.code)).toContain("OFFICE_HTML_FEATURE_RESTRICTIONS");

    const prebuiltReport = await inspectDocumentInput({ file: docx, modelKind: "prebuilt" });
    expect(prebuiltReport.status).toBe("failed_preflight");
    expect(prebuiltReport.findings.map((f) => f.code)).toContain("FORMAT_UNSUPPORTED_FOR_MODEL_KIND");

    // Learn pages disagree on Office/HTML for custom classification, so it only warns; custom extraction is unsupported.
    const classifierReport = await inspectDocumentInput({ file: docx, modelKind: "classifier" });
    expect(classifierReport.status).toBe("passed_with_warnings");
    expect(classifierReport.findings.map((f) => f.code)).toContain("FORMAT_SUPPORT_UNCLEAR_FOR_MODEL_KIND");
    const customReport = await inspectDocumentInput({ file: docx, modelKind: "custom" });
    expect(customReport.findings.map((f) => f.code)).toContain("FORMAT_UNSUPPORTED_FOR_MODEL_KIND");

    const unknownBin = join(dir, `mystery.${SECRET}`);
    await writeFile(unknownBin, Buffer.from([0x13, 0x37, 0x42, 0x99]));
    const unk = await inspectDocumentInput({ file: unknownBin });
    expect(unk.status).toBe("unknown");
    expect(unk.document?.extension).toBe("(other)");
    expect(JSON.stringify(unk)).not.toContain(SECRET);
  });
});

it("flags legacy OLE2 Office, finds encryption markers past the header window, and reports oversized files", async () => {
  await withTempDir(async (dir) => {
    const ole2Header = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const legacyXls = join(dir, "legacy.xls");
    await writeFile(legacyXls, Buffer.concat([ole2Header, Buffer.alloc(4096)]));
    const xls = await inspectDocumentInput({ file: legacyXls, modelKind: "layout" });
    expect(xls.status).toBe("passed_with_warnings");
    expect(xls.findings.map((f) => f.code)).toEqual(["UNSUPPORTED_DOCUMENT_FORMAT"]);

    // EncryptedPackage stream name 400 KiB in: beyond the 256 KiB header window.
    const lockedDocx = join(dir, "locked.docx");
    await writeFile(lockedDocx, Buffer.concat([
      ole2Header, Buffer.alloc(400 * 1024), Buffer.from("EncryptedPackage", "utf16le"), Buffer.alloc(512),
    ]));
    const locked = await inspectDocumentInput({ file: lockedDocx, modelKind: "layout" });
    expect(locked.findings.map((f) => f.code)).toEqual(["PASSWORD_OR_ENCRYPTION_DETECTED"]);

    const renamedDoc = join(dir, "renamed.docx");
    await writeFile(renamedDoc, Buffer.concat([ole2Header, Buffer.alloc(4096)]));
    const renamed = await inspectDocumentInput({ file: renamedDoc, modelKind: "layout" });
    expect(renamed.findings.map((f) => f.code)).toEqual(["UNSUPPORTED_DOCUMENT_FORMAT"]);
  });
});

it("inspects custom labels and OCR JSON without leaking label names or text", async () => {
  await withTempDir(async (dir) => {
    const labelsPath = join(dir, "doc.pdf.labels.json");
    const ocrPath = join(dir, "doc.pdf.ocr.json");
    await writeFile(labelsPath, JSON.stringify({
      $schema: "https://schema.cognitiveservices.azure.com/formrecognizer/2021-03-01/labels.json",
      document: `${SECRET}.pdf`,
      labels: [
        {
          label: `Field_${SECRET}`,
          value: [{ page: 1, text: SECRET, boundingBoxes: [[0.1, 0.1, 0.5, 0.1, 0.5, 0.5, 0.1, 0.5]] }],
        },
        {
          label: `Field_${SECRET}`,
          value: [{ page: 1, text: SECRET, boundingBoxes: [[0.2, 0.2, 1.2, 0.2, 1.2, 0.6, 0.2, 0.6]] }],
        },
        { label: "EmptyField", value: [] },
      ],
    }));
    await writeFile(ocrPath, JSON.stringify({ analyzeResult: { pages: [{ pageNumber: 1, words: [{ content: SECRET }] }] } }));

    const report = await inspectDocumentInput({ labelsFile: labelsPath, ocrFile: ocrPath });
    // No public labels.json schema exists, so label checks are review signals (warnings), not rejections.
    expect(report.status).toBe("passed_with_warnings");
    expect(report.findings.every((f) => f.severity !== "error")).toBe(true);
    expect(report.labels?.duplicateLabelCount).toBe(1);
    expect(report.labels?.outOfBoundsBoxCount).toBe(1);
    expect(report.labels?.overlappingPairCount).toBe(1);
    expect(report.labels?.emptyValueCount).toBe(1);
    expect(report.labels?.ocr?.pageCount).toBe(1);
    expect(JSON.stringify(report)).not.toContain(SECRET);

    // Oversized labels JSON (> 10 MiB) is not inspected and yields status 'unknown' rather than 'passed_with_warnings'.
    const bigLabels = join(dir, "huge.labels.json");
    await writeFile(bigLabels, "{}");
    await truncate(bigLabels, 10 * 1024 * 1024 + 16);
    const skipped = await inspectDocumentInput({ labelsFile: bigLabels });
    expect(skipped.status).toBe("unknown");
    expect(skipped.findings.map((f) => f.code)).toContain("LABELS_FILE_NOT_INSPECTED");

    // Non-object analyzeResult values (true, string, array) must fail INVALID_OCR_JSON_SHAPE.
    for (const invalidVal of [true, "invalid", []]) {
      const badOcr = join(dir, "bad.ocr.json");
      await writeFile(badOcr, JSON.stringify({ analyzeResult: invalidVal }));
      const cleanLabels = join(dir, "clean.labels.json");
      await writeFile(cleanLabels, JSON.stringify({
        labels: [{ label: "A", value: [{ page: 1, boundingBoxes: [[0.1, 0.1, 0.2, 0.1, 0.2, 0.2, 0.1, 0.2]] }] }],
      }));
      const badOcrRes = await inspectDocumentInput({ labelsFile: cleanLabels, ocrFile: badOcr });
      expect(badOcrRes.status).toBe("failed_preflight");
      expect(badOcrRes.labels?.ocr?.hasAnalyzeResult).toBe(false);
      expect(badOcrRes.findings.map((f) => f.code)).toContain("INVALID_OCR_JSON_SHAPE");
    }

    // Degenerate all-overlapping label boxes hit the pair-check budget fast and report status 'unknown'.
    const denseLabels = join(dir, "dense.labels.json");
    const stackedBoxes = Array.from({ length: 800 }, () => [0, 0, 1, 0, 1, 1, 0, 1]);
    await writeFile(denseLabels, JSON.stringify({
      labels: [{ label: "Stacked", value: [{ page: 1, boundingBoxes: stackedBoxes }] }],
    }));
    const denseRes = await inspectDocumentInput({ labelsFile: denseLabels });
    expect(denseRes.status).toBe("unknown");
    expect(denseRes.findings.map((f) => f.code)).toContain("LABEL_OVERLAP_CHECK_INCOMPLETE");
  });
});

const launchers = [
  {
    name: "Bash",
    executable: isWindows ? undefined : resolveExecutable("bash"),
    file: "inspect-document-input.sh",
    args: (file: string, ...rest: string[]) => [file, ...rest],
  },
  {
    name: "PowerShell",
    executable: resolveExecutable(isWindows ? "powershell" : "pwsh"),
    file: "inspect-document-input.ps1",
    args: (file: string, ...rest: string[]) => ["-NoProfile", "-File", file, ...rest],
  },
];

function envWithPath(path: string): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toLowerCase() !== "path"));
  return { ...env, PATH: path };
}

for (const launcher of launchers) {
  it.skipIf(!launcher.executable)(`${launcher.name} launcher enforces Node.js 22+ and runs --help`, async () => {
    await withTempDir(async (dir) => {
      const noNodeEnv = isWindows ? [dir, join(process.env.SystemRoot ?? "C:\\Windows", "System32")].join(delimiter) : dir;
      const missing = spawnSync(launcher.executable as string, launcher.args(join(dirname(script), launcher.file), "--help"), {
        encoding: "utf8",
        env: envWithPath(noNodeEnv),
      });
      expect(missing.status).toBe(3);
      expect(JSON.parse(missing.stderr).error).toBe("NODE_REQUIRED");

      if (isWindows) {
        await writeFile(join(dir, "node.cmd"), "@echo v20.11.0\r\n");
      } else {
        await writeFile(join(dir, "node"), "#!/bin/sh\necho v20.11.0\n");
        await chmod(join(dir, "node"), 0o755);
      }
      const oldNode = spawnSync(launcher.executable as string, launcher.args(join(dirname(script), launcher.file), "--help"), {
        encoding: "utf8",
        env: envWithPath(noNodeEnv),
      });
      expect(oldNode.status).toBe(3);
      expect(JSON.parse(oldNode.stderr).error).toBe("NODE_VERSION_UNSUPPORTED");

      const ok = spawnSync(
        launcher.executable as string,
        launcher.args(join(dirname(script), launcher.file), "--help"),
        { encoding: "utf8", env: envWithPath([dirname(process.execPath), process.env.PATH ?? ""].join(delimiter)) },
      );
      expect(ok.status).toBe(0);
      expect(ok.stdout).toContain("inspect-document-input.mjs");
    });
  });
}
