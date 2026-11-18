import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, it } from "vitest";

type Finding = { code: string; severity: string; detail: string };
type FieldRow = {
  field: string;
  inFieldsJson: boolean | string;
  labeledDocuments: number;
  unlabeledDocuments: number;
  emptyValueOnlyDocuments: number;
  labeledByFileType: Record<string, number>;
};
type Report = {
  specVersion: string;
  status: string;
  dataset: {
    documents: number;
    labeledDocuments: number;
    documentsWithoutLabels: number;
    byFileType: Record<string, { documents: number; labeled: number }>;
    fieldsJson: string;
    schemaFieldCount: number;
    ocrApiVersions: Record<string, number>;
  };
  fields: FieldRow[];
  findings: Finding[];
};

const script = process.env.DI_TRAINING_AUDIT_PATH ?? fileURLToPath(new URL(
  "../../../output/azure-skills/skills/azure-ai/scripts/audit-di-training-set.mjs", import.meta.url,
));
const { auditTrainingSet } = (await import(pathToFileURL(script).href)) as {
  auditTrainingSet: (opts: Record<string, unknown>) => Promise<Report>;
};
const SECRET = "SYNTHETIC_FIELD_VALUE_DO_NOT_EMIT";
const isWindows = process.platform === "win32";
const OCR_HEAD_BYTES = 256 * 1024;

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "di-training-audit-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const label = (name: string, empty = false) => ({
  label: name,
  value: empty ? [] : [{ page: 1, text: SECRET, boundingBoxes: [[0.1, 0.1, 0.2, 0.1, 0.2, 0.2, 0.1, 0.2]] }],
});

async function writeDataset(dir: string) {
  await writeFile(join(dir, "fields.json"), JSON.stringify({
    fields: [
      { fieldKey: "agent_code", fieldType: "string" },
      { fieldKey: "agent_phone", fieldType: "string" },
      { fieldKey: "policy_number", fieldType: "string" },
      { fieldKey: "owner_signature", fieldType: "signature" },
    ],
  }));
  for (let i = 1; i <= 6; i += 1) {
    const ext = i <= 4 ? "pdf" : "jpg";
    const doc = `${SECRET}-${i}.${ext}`;
    await writeFile(join(dir, doc), "synthetic");
    const labels = i <= 3
      ? [label("agent_code"), label("policy_number"), { label: "items/0/amount", value: [{ page: 1, text: SECRET }] }]
      : [label("policy_number"), label("old_agent_code"), label("agent_phone", true)];
    await writeFile(join(dir, `${doc}.labels.json`), JSON.stringify({ document: doc, labels }));
    if (i !== 5) {
      const version = i === 6 ? "2023-07-31" : "2024-11-30";
      await writeFile(join(dir, `${doc}.ocr.json`), JSON.stringify({ status: "succeeded", analyzeResult: { apiVersion: version, content: SECRET } }));
    }
  }
}

it("reports per-field label coverage, schema drift and OCR version drift without emitting values or file names", async () => {
  await withTempDir(async (dir) => {
    await writeDataset(dir);
    const report = await auditTrainingSet({ dir });
    expect(JSON.stringify(report)).not.toContain(SECRET);
    expect(report.status).toBe("passed_with_warnings");
    expect(report.dataset).toMatchObject({ documents: 6, labeledDocuments: 6, fieldsJson: "ok", schemaFieldCount: 4 });
    expect(report.dataset.byFileType).toEqual({ pdf: { documents: 4, labeled: 4 }, jpeg: { documents: 2, labeled: 2 } });
    expect(report.dataset.ocrApiVersions).toEqual({ "2024-11-30": 4, "2023-07-31": 1 });

    const byName = Object.fromEntries(report.fields.map((f) => [f.field, f]));
    expect(byName.agent_code).toMatchObject({ labeledDocuments: 3, unlabeledDocuments: 3, labeledByFileType: { pdf: 3 } });
    expect(byName.policy_number).toMatchObject({ labeledDocuments: 6, unlabeledDocuments: 0 });
    expect(byName.agent_phone).toMatchObject({ labeledDocuments: 0, emptyValueOnlyDocuments: 3 });
    expect(byName.items).toMatchObject({ inFieldsJson: false, labeledDocuments: 3 });
    expect(byName.old_agent_code).toMatchObject({ inFieldsJson: false });

    const codes = report.findings.map((f) => f.code);
    for (const code of ["FIELD_NEVER_LABELED", "FIELD_PARTIALLY_LABELED", "LABEL_NOT_IN_FIELDS_JSON", "OCR_FILE_MISSING", "OCR_API_VERSION_MIXED", "OCR_API_VERSION_DIFFERS"]) {
      expect(codes).toContain(code);
    }
    expect(report.findings.find((f) => f.code === "FIELD_NEVER_LABELED")?.detail).toContain("owner_signature");
  });
});

it("anonymizes field names and fails datasets with fewer than five labeled documents", async () => {
  await withTempDir(async (dir) => {
    const sub = join(dir, "project");
    await mkdir(sub);
    await writeFile(join(sub, "fields.json"), JSON.stringify({ fields: [{ fieldKey: "secret_field_name", fieldType: "string" }] }));
    for (let i = 1; i <= 3; i += 1) {
      await writeFile(join(sub, `doc${i}.pdf`), "synthetic");
      await writeFile(join(sub, `doc${i}.pdf.labels.json`), JSON.stringify({ labels: [label("secret_field_name")] }));
      await writeFile(join(sub, `doc${i}.pdf.ocr.json`), JSON.stringify({ analyzeResult: { apiVersion: "2024-11-30" } }));
    }
    const report = await auditTrainingSet({ dir, anonymizeFields: true });
    expect(JSON.stringify(report)).not.toContain("secret_field_name");
    expect(report.fields[0].field).toBe("field-1");
    expect(report.status).toBe("failed_preflight");
    expect(report.findings.map((f) => f.code)).toContain("TOO_FEW_LABELED_DOCUMENTS");
  });
});

it("flags a missing fields.json and rejects a file path", async () => {
  await withTempDir(async (dir) => {
    for (let i = 1; i <= 5; i += 1) {
      await writeFile(join(dir, `doc${i}.png`), "synthetic");
      await writeFile(join(dir, `doc${i}.png.labels.json`), JSON.stringify({ labels: [label("total")] }));
      await writeFile(join(dir, `doc${i}.png.ocr.json`), JSON.stringify({ analyzeResult: { apiVersion: "2024-11-30" } }));
    }
    const report = await auditTrainingSet({ dir });
    expect(report.dataset.fieldsJson).toBe("missing");
    expect(report.findings.map((f) => f.code)).toContain("FIELDS_JSON_NOT_USABLE");
    expect(report.fields[0]).toMatchObject({ field: "total", inFieldsJson: "unknown", labeledDocuments: 5 });
    await expect(auditTrainingSet({ dir: join(dir, "doc1.png") })).rejects.toThrow("NOT_A_DIRECTORY");
  });
});

it("does not reject an OCR version header split at the prefix boundary", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "fields.json"), JSON.stringify({ fields: [{ fieldKey: "total", fieldType: "string" }] }));
    const prefix = Buffer.from('{"analyzeResult":{"apiVersion":"2024-11-30","content":"', "utf8");
    const padding = Buffer.alloc(OCR_HEAD_BYTES - prefix.length - 1, 0x61);
    for (let i = 1; i <= 5; i += 1) {
      const doc = `doc${i}.pdf`;
      await writeFile(join(dir, doc), "synthetic");
      await writeFile(join(dir, `${doc}.labels.json`), JSON.stringify({ labels: [label("total")] }));
      await writeFile(join(dir, `${doc}.ocr.json`), Buffer.concat([
        prefix,
        padding,
        Buffer.from("😀", "utf8"),
        Buffer.from('"}}', "utf8"),
      ]));
    }
    const report = await auditTrainingSet({ dir });
    expect(report.dataset.ocrApiVersions).toEqual({ "2024-11-30": 5 });
    expect(report.status).toBe("passed_local_checks");
  });
});

it.skipIf(isWindows)("keeps case-distinct training documents separate", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "fields.json"), JSON.stringify({ fields: [{ fieldKey: "total", fieldType: "string" }] }));
    for (const doc of ["A.pdf", "a.pdf", "B.pdf", "C.pdf", "D.pdf"]) {
      await writeFile(join(dir, doc), "synthetic");
      await writeFile(join(dir, `${doc}.labels.json`), JSON.stringify({ labels: [label("total")] }));
      await writeFile(join(dir, `${doc}.ocr.json`), JSON.stringify({ analyzeResult: { apiVersion: "2024-11-30" } }));
    }
    const report = await auditTrainingSet({ dir });
    expect(report.dataset.documents).toBe(5);
    expect(report.fields[0]).toMatchObject({ labeledDocuments: 5, unlabeledDocuments: 0 });
    expect(report.findings.map((f) => f.code)).not.toContain("TOO_FEW_LABELED_DOCUMENTS");
  });
});

it("counts source documents without usable labels as field coverage gaps", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "fields.json"), JSON.stringify({ fields: [{ fieldKey: "total", fieldType: "string" }] }));
    for (let i = 1; i <= 6; i += 1) {
      const doc = `doc${i}.pdf`;
      await writeFile(join(dir, doc), "synthetic");
      if (i <= 5) {
        await writeFile(join(dir, `${doc}.labels.json`), JSON.stringify({ labels: [label("total")] }));
        await writeFile(join(dir, `${doc}.ocr.json`), JSON.stringify({ analyzeResult: { apiVersion: "2024-11-30" } }));
      }
    }
    const report = await auditTrainingSet({ dir });
    expect(report.fields[0]).toMatchObject({ labeledDocuments: 5, unlabeledDocuments: 1 });
    expect(report.findings.map((f) => f.code)).toContain("FIELD_PARTIALLY_LABELED");
  });
});

it("audits label-only exports and reads PowerShell UTF-16 JSON", async () => {
  await withTempDir(async (dir) => {
    const fields = JSON.stringify({ fields: [{ fieldKey: "total", fieldType: "string" }] });
    await writeFile(join(dir, "fields.json"), Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(fields, "utf16le"),
    ]));
    for (let i = 1; i <= 5; i += 1) {
      const labels = JSON.stringify({ labels: [label("total")] });
      await writeFile(join(dir, `doc${i}.pdf.labels.json`), Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(labels, "utf16le"),
      ]));
    }
    const report = await auditTrainingSet({ dir });
    expect(report.dataset).toMatchObject({
      documents: 5,
      sourceDocuments: 0,
      labelsWithoutSourceDocuments: 5,
      labeledDocuments: 5,
    });
    expect(report.fields[0]).toMatchObject({ field: "total", labeledDocuments: 5 });
    expect(report.findings.map((f) => f.code)).toContain("SOURCE_DOCUMENT_MISSING");
    expect(JSON.stringify(report)).not.toContain(SECRET);
  });
});

function resolveExecutable(command: string): string | undefined {
  try {
    return execFileSync(isWindows ? "where.exe" : "which", [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split(/\r?\n/)[0] || undefined;
  } catch {
    return undefined;
  }
}

function envWithPath(path: string): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toLowerCase() !== "path"));
  return { ...env, PATH: path };
}

const launchers = [
  { name: "Bash", executable: isWindows ? undefined : resolveExecutable("bash"), file: "audit-di-training-set.sh", args: (file: string, ...rest: string[]) => [file, ...rest] },
  { name: "PowerShell", executable: resolveExecutable(isWindows ? "powershell" : "pwsh"), file: "audit-di-training-set.ps1", args: (file: string, ...rest: string[]) => ["-NoProfile", "-File", file, ...rest] },
];

for (const launcher of launchers) {
  it.skipIf(!launcher.executable)(`${launcher.name} launcher enforces Node.js 22+ and runs --help`, async () => {
    await withTempDir(async (dir) => {
      const file = join(dirname(script), launcher.file);
      const noNodeEnv = isWindows ? [dir, join(process.env.SystemRoot ?? "C:\\Windows", "System32")].join(delimiter) : dir;
      const missing = spawnSync(launcher.executable as string, launcher.args(file, "--help"), { encoding: "utf8", env: envWithPath(noNodeEnv) });
      expect(missing.status).toBe(3);
      expect(JSON.parse(missing.stderr).error).toBe("NODE_REQUIRED");
      if (isWindows) {
        await writeFile(join(dir, "node.cmd"), "@echo v20.11.0\r\n");
      } else {
        await writeFile(join(dir, "node"), "#!/bin/sh\necho v20.11.0\n");
        await chmod(join(dir, "node"), 0o755);
      }
      const oldNode = spawnSync(launcher.executable as string, launcher.args(file, "--help"), { encoding: "utf8", env: envWithPath(noNodeEnv) });
      expect(oldNode.status).toBe(3);
      expect(JSON.parse(oldNode.stderr).error).toBe("NODE_VERSION_UNSUPPORTED");
      const ok = spawnSync(launcher.executable as string, launcher.args(file, "--help"), {
        encoding: "utf8",
        env: envWithPath([dirname(process.execPath), process.env.PATH ?? ""].join(delimiter)),
      });
      expect(ok.status).toBe(0);
      expect(ok.stdout).toContain("audit-di-training-set.mjs");
    });
  });
}
