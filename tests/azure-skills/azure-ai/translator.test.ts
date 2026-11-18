import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, it } from "vitest";

type Report = {
  mode: string;
  status: string;
  batch?: { documentCount: number; totalDocumentBytes: number };
  glossary?: {
    validEntryCount?: number;
    malformedRowCount?: number;
    emptyCellRowCount?: number;
    duplicateSourceCount?: number;
    utf8Valid?: boolean;
  };
  findings: Array<{ code: string; severity: string; detail: string }>;
};

const script = process.env.TRANSLATOR_VALIDATOR_PATH ?? fileURLToPath(new URL(
  "../../../output/azure-skills/skills/azure-ai/scripts/validate-document-translation.mjs", import.meta.url,
));
const { validateDocumentTranslation } = (await import(pathToFileURL(script).href)) as {
  validateDocumentTranslation: (opts: Record<string, unknown>) => Promise<Report>;
};
const SECRET = "SYNTHETIC_PRIVATE_TERM_DO_NOT_EMIT";
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

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "translator-preflight-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

it("validates clean async batch documents and TSV glossary without emitting terms or filenames", async () => {
  await withTempDir(async (dir) => {
    const doc = join(dir, `${SECRET}.txt`);
    const glossary = join(dir, `${SECRET}.tsv`);
    await writeFile(doc, `Hello ${SECRET}\n`, "utf8");
    await writeFile(glossary, `Bank\tBanque\n${SECRET}\tTarget_${SECRET}\n`, "utf8");

    const report = await validateDocumentTranslation({
      mode: "async",
      documents: [doc],
      glossaryFile: glossary,
      targetCount: 2,
    });
    expect(report.status).toBe("passed_local_checks");
    expect(report.glossary?.validEntryCount).toBe(2);
    expect(JSON.stringify(report)).not.toContain(SECRET);
  });
});

it("catches malformed TSV/CSV glossaries, UTF-16 BOM, duplicates, encrypted PDF, and sync limits", async () => {
  await withTempDir(async (dir) => {
    const badGlossary = join(dir, "bad.tsv");
    await writeFile(
      badGlossary,
      [
        `${SECRET}\tTargetA`,
        `${SECRET}\tTargetB`,
        " Three\tCols\tHere",
        "EmptyTarget\t",
      ].join("\n"),
      "utf8",
    );
    const badRes = await validateDocumentTranslation({ glossaryFile: badGlossary });
    // Glossary format problems are review signals; Learn documents no rejection code for them.
    expect(badRes.status).toBe("passed_with_warnings");
    expect(badRes.findings.every((f) => f.severity !== "error")).toBe(true);
    const codes = badRes.findings.map((f) => f.code);
    expect(codes).toContain("GLOSSARY_COLUMN_COUNT_MISMATCH");
    expect(codes).toContain("GLOSSARY_EMPTY_CELL");
    expect(codes).toContain("GLOSSARY_DUPLICATE_SOURCE_TERMS");
    expect(JSON.stringify(badRes)).not.toContain(SECRET);

    const utf16Glossary = join(dir, "utf16.tsv");
    await writeFile(utf16Glossary, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("a\tb\n", "utf16le")]));
    const utf16Res = await validateDocumentTranslation({ glossaryFile: utf16Glossary });
    expect(utf16Res.findings.map((f) => f.code)).toContain("GLOSSARY_UTF16_ENCODING");

    // Characters immediately after a closing CSV quote ("source"junk,target) must trigger MALFORMED_CSV_QUOTES.
    const trailingQuoteCsv = join(dir, "bad-quote.csv");
    await writeFile(trailingQuoteCsv, `"${SECRET}"junk,target\n`, "utf8");
    const trailingQuoteRes = await validateDocumentTranslation({ glossaryFile: trailingQuoteCsv });
    expect(trailingQuoteRes.status).toBe("passed_with_warnings");
    expect(trailingQuoteRes.findings.map((f) => f.code)).toContain("MALFORMED_CSV_QUOTES");
    expect(JSON.stringify(trailingQuoteRes)).not.toContain(SECRET);

    const lockedPdf = join(dir, "locked.pdf");
    await writeFile(lockedPdf, "%PDF-1.7\ntrailer << /Root 1 0 R /Encrypt 2 0 R >>\n%%EOF\n", "latin1");
    const htmlAsDocx = join(dir, "error.docx");
    await writeFile(htmlAsDocx, `<html>${SECRET}</html>`, "utf8");

    const syncRes = await validateDocumentTranslation({
      mode: "sync",
      documents: [lockedPdf, htmlAsDocx],
      targetCount: 3,
    });
    // Encrypted documents and the sync file/target limits are documented service limits.
    expect(syncRes.status).toBe("failed_preflight");
    const syncCodes = syncRes.findings.map((f) => f.code);
    expect(syncCodes).toContain("EXCEEDS_TARGET_LANGUAGE_LIMIT");
    expect(syncCodes).toContain("EXCEEDS_BATCH_FILE_COUNT_LIMIT");
    expect(syncCodes).toContain("ENCRYPTED_PDF_DOCUMENT");
    expect(syncCodes).toContain("DOCUMENT_EXTENSION_MISMATCH");
    expect(syncCodes).toContain("UNSUPPORTED_IN_SYNC_MODE");
    expect(JSON.stringify(syncRes)).not.toContain(SECRET);
  });
});

it("scans whole PDFs and OLE2 files for encryption, enforces sync formats, and keeps reporting past oversized files", async () => {
  await withTempDir(async (dir) => {
    // /Encrypt only in the trailer, 3 MiB into the file.
    const bigLockedPdf = join(dir, "big-locked.pdf");
    await writeFile(bigLockedPdf, Buffer.concat([
      Buffer.from("%PDF-1.7\n", "latin1"),
      Buffer.alloc(3 * 1024 * 1024, 0x20),
      Buffer.from("trailer << /Root 1 0 R /Encrypt 9 0 R >>\n%%EOF\n", "latin1"),
    ]));
    // /EncryptMetadata alone is not an encryption dictionary, and /Encrypt in visible text, comments, or streams is not encryption.
    const metaOnlyPdf = join(dir, "meta-only.pdf");
    await writeFile(
      metaOnlyPdf,
      [
        "%PDF-1.7",
        "% Comment mentioning /Encrypt dictionary",
        "1 0 obj << /Type /Page /Title (A PDF /Encrypt example) /EncryptMetadata false >> endobj",
        "2 0 obj << /Length 34 >> stream",
        "BT /F1 12 Tf (Body /Encrypt) Tj ET",
        "endstream endobj",
        "trailer << /Root 1 0 R >>",
        "%%EOF",
      ].join("\n"),
      "latin1",
    );

    // OLE2 header with the EncryptedPackage stream name far past the first 64 KiB.
    const ole2Header = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const lockedDocx = join(dir, "locked.docx");
    await writeFile(lockedDocx, Buffer.concat([
      ole2Header, Buffer.alloc(300 * 1024), Buffer.from("EncryptedPackage", "utf16le"), Buffer.alloc(512),
    ]));
    const legacyDoc = join(dir, "legacy.doc");
    await writeFile(legacyDoc, Buffer.concat([ole2Header, Buffer.alloc(4096)]));

    // 41 MiB exceeds the 40 MiB async limit; it must be reported without aborting the other documents.
    const oversized = join(dir, "oversized.txt");
    await writeFile(oversized, Buffer.alloc(41 * 1024 * 1024, 0x61));

    const asyncRes = await validateDocumentTranslation({
      mode: "async",
      documents: [bigLockedPdf, metaOnlyPdf, lockedDocx, legacyDoc, oversized],
    });
    const byDoc = (n: number) => asyncRes.findings.filter((f) => f.detail.startsWith(`Document #${n} `)).map((f) => f.code);
    expect(byDoc(1)).toContain("ENCRYPTED_PDF_DOCUMENT");
    expect(byDoc(2)).toEqual([]);
    expect(byDoc(3)).toContain("ENCRYPTED_OFFICE_DOCUMENT");
    expect(byDoc(4)).toEqual([]);
    expect(byDoc(5)).toEqual(expect.arrayContaining(["EXCEEDS_DOCUMENT_SIZE_LIMIT", "CONTENT_CHECKS_SKIPPED_OVER_LIMIT"]));
    expect(asyncRes.batch?.documentCount).toBe(5);

    const syncLegacy = await validateDocumentTranslation({ mode: "sync", documents: [legacyDoc] });
    expect(syncLegacy.findings.map((f) => f.code)).toContain("UNSUPPORTED_IN_SYNC_MODE");

    // A UTF-8 BOM and trailing blank lines are reported, not treated as glossary errors.
    const bomGlossary = join(dir, "bom.tsv");
    await writeFile(bomGlossary, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`a\tb\n${SECRET}\tc\n\n\n`, "utf8")]));
    const bom = await validateDocumentTranslation({ glossaryFile: bomGlossary });
    expect(bom.status).toBe("passed_local_checks");
    expect((bom.glossary as Record<string, unknown>)?.hasUtf8Bom).toBe(true);
    expect(bom.findings.map((f) => f.code)).toContain("GLOSSARY_BLANK_ROWS");
    expect(JSON.stringify(bom)).not.toContain(SECRET);

    const xliffSync = join(dir, "terms.xliff");
    await writeFile(xliffSync, "<xliff><file><body><trans-unit><source>a</source><target>b</target></trans-unit></body></file></xliff>", "utf8");
    const xs = await validateDocumentTranslation({ mode: "sync", glossaryFile: xliffSync });
    // .xliff is not in the Learn glossary list (.xlf is); list misses only warn because GET formats is authoritative.
    expect(xs.findings.find((f) => f.code === "UNSUPPORTED_GLOSSARY_EXTENSION")?.severity).toBe("warning");

    // Non-glossary binary/JSON extension warns and returns status 'unknown' without attempting TSV row parsing.
    const binGlossary = join(dir, "glossary.pdf");
    await writeFile(binGlossary, Buffer.from([0x25, 0x50, 0x44, 0x46, 0xff, 0xfe, 0x80]));
    const binGlossRes = await validateDocumentTranslation({ glossaryFile: binGlossary });
    expect(binGlossRes.status).toBe("unknown");
    expect(binGlossRes.findings.map((f) => f.code)).toEqual(["UNSUPPORTED_GLOSSARY_EXTENSION"]);

    const mkd = join(dir, "notes.mkd");
    const rmd = join(dir, "report.rmd");
    const xliffDoc = join(dir, "strings.xliff");
    await writeFile(mkd, "# Title\n", "utf8");
    await writeFile(rmd, "# Title\n", "utf8");
    await writeFile(xliffDoc, "<xliff version=\"1.2\"><file><body></body></file></xliff>", "utf8");
    const formats = await validateDocumentTranslation({ mode: "async", documents: [mkd, rmd, xliffDoc] });
    const byFormatDoc = (n: number) => formats.findings.filter((f) => f.detail.startsWith(`Document #${n} `));
    expect(byFormatDoc(1).map((f) => f.code)).not.toContain("UNSUPPORTED_DOCUMENT_EXTENSION");
    expect(byFormatDoc(2).map((f) => f.code)).not.toContain("UNSUPPORTED_DOCUMENT_EXTENSION");
    expect(byFormatDoc(3).find((f) => f.code === "UNSUPPORTED_DOCUMENT_EXTENSION")?.severity).toBe("warning");
  });
});

const launchers = [
  {
    name: "Bash",
    executable: isWindows ? undefined : resolveExecutable("bash"),
    file: "validate-document-translation.sh",
    args: (file: string, ...rest: string[]) => [file, ...rest],
  },
  {
    name: "PowerShell",
    executable: resolveExecutable(isWindows ? "powershell" : "pwsh"),
    file: "validate-document-translation.ps1",
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
