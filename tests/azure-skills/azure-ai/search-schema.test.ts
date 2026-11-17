import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, it } from "vitest";

type Report = {
  status: string;
  index?: {
    totalFieldCount: number;
    vectorFieldCount: number;
    vectorProfileCount: number;
    semanticConfigurationCount: number;
  };
  query?: { queryType: string; isHybrid: boolean; vectorQueryCount: number };
  findings: Array<{ code: string; severity: string; detail: string }>;
};

const script = process.env.SEARCH_VALIDATOR_PATH ?? fileURLToPath(new URL(
  "../../../output/azure-skills/skills/azure-ai/scripts/validate-search-schema.mjs", import.meta.url,
));
const { validateSearchSchema } = (await import(pathToFileURL(script).href)) as {
  validateSearchSchema: (opts: Record<string, unknown>) => Promise<Report>;
};
const SECRET = "SYNTHETIC_PRIVATE_QUERY_DO_NOT_EMIT";
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
  const dir = await mkdtemp(join(tmpdir(), "search-schema-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

it("validates a consistent vector + hybrid + semantic index and query without emitting search literals", async () => {
  await withTempDir(async (dir) => {
    const idx = join(dir, "index.json");
    const qry = join(dir, "query.json");
    await writeFile(idx, JSON.stringify({
      name: "docs-idx",
      fields: [
        { name: "id", type: "Edm.String", key: true, filterable: true, retrievable: true },
        { name: "title", type: "Edm.String", searchable: true, retrievable: true, sortable: true },
        { name: "category", type: "Edm.String", filterable: true, facetable: true, retrievable: true },
        {
          name: "embedding",
          type: "Collection(Edm.Single)",
          searchable: true,
          retrievable: false,
          dimensions: 3,
          vectorSearchProfile: "vprof",
        },
      ],
      vectorSearch: {
        algorithms: [{ name: "hnsw-1", kind: "hnsw" }],
        vectorizers: [{ name: "vec-1", kind: "azureOpenAI" }],
        profiles: [{ name: "vprof", algorithm: "hnsw-1", vectorizer: "vec-1" }],
      },
      semantic: {
        configurations: [{
          name: "sem-default",
          prioritizedFields: {
            titleField: { fieldName: "title" },
            prioritizedContentFields: [{ fieldName: "title" }],
          },
        }],
      },
    }));
    await writeFile(qry, JSON.stringify({
      search: SECRET,
      queryType: "semantic",
      semanticConfiguration: "sem-default",
      filter: `category eq '${SECRET}'`,
      orderby: "title asc",
      facets: ["category,count:5"],
      select: "id,title",
      vectorQueries: [{ kind: "vector", vector: [0.1, 0.2, 0.3], fields: "embedding", k: 5 }],
    }));

    const report = await validateSearchSchema({ indexFile: idx, queryFile: qry });
    expect(report.status).toBe("passed_local_checks");
    expect(report.query?.isHybrid).toBe(true);
    expect(JSON.stringify(report)).not.toContain(SECRET);
  });
});

it("detects broken vector profiles, dimension mismatch, missing vectorizer, and non-filterable/sortable/retrievable fields", async () => {
  await withTempDir(async (dir) => {
    const idx = join(dir, "broken-index.json");
    const qry = join(dir, "broken-query.json");
    await writeFile(idx, JSON.stringify({
      name: "broken-idx",
      fields: [
        { name: "id", type: "Edm.Int32", key: true },
        { name: "body", type: "Edm.String", searchable: true, filterable: false, sortable: false, retrievable: false },
        {
          name: "vec",
          type: "Collection(Edm.Single)",
          searchable: false,
          dimensions: 4,
          vectorSearchProfile: "prof-no-vec",
        },
      ],
      vectorSearch: {
        algorithms: [],
        profiles: [{ name: "prof-no-vec", algorithm: "missing-algo" }],
      },
    }));
    await writeFile(qry, JSON.stringify({
      search: SECRET,
      queryType: "semantic",
      filter: `body eq '${SECRET}'`,
      orderby: "body desc",
      select: "body",
      vectorQueries: [
        { kind: "vector", vector: [0.1, 0.2], fields: "vec" },
        { kind: "text", text: SECRET, fields: "vec" },
      ],
    }));

    const report = await validateSearchSchema({ indexFile: idx, queryFile: qry });
    expect(report.status).toBe("failed_preflight");
    const codes = report.findings.map((f) => f.code);
    expect(codes).toContain("NON_STRING_KEY_FIELD");
    expect(codes).toContain("DANGLING_VECTOR_ALGORITHM_REFERENCE");
    expect(codes).toContain("VECTOR_FIELD_NOT_SEARCHABLE");
    expect(codes).toContain("SEMANTIC_QUERY_WITHOUT_INDEX_CONFIG");
    expect(codes).toContain("VECTOR_QUERY_DIMENSION_MISMATCH");
    expect(codes).toContain("TEXT_VECTOR_QUERY_MISSING_VECTORIZER");
    expect(codes).toContain("FIELD_NOT_FILTERABLE");
    expect(codes).toContain("FIELD_NOT_SORTABLE");
    expect(codes).toContain("FIELD_NOT_RETRIEVABLE");
    expect(JSON.stringify(report)).not.toContain(SECRET);
  });
});

it("applies REST data-type defaults when field attributes are omitted", async () => {
  await withTempDir(async (dir) => {
    const idx = join(dir, "rest-defaults-index.json");
    const qry = join(dir, "rest-defaults-query.json");
    // REST/IaC style: attributes omitted, so data-type defaults apply.
    await writeFile(idx, JSON.stringify({
      name: "rest-idx",
      fields: [
        { name: "id", type: "Edm.String", key: true },
        { name: "title", type: "Edm.String" },
        { name: "category", type: "Edm.String" },
        { name: "rating", type: "Edm.Double" },
        { name: "tags", type: "Collection(Edm.String)" },
        { name: "embedding", type: "Collection(Edm.Single)", dimensions: 3, vectorSearchProfile: "p" },
      ],
      vectorSearch: { algorithms: [{ name: "a", kind: "hnsw" }], profiles: [{ name: "p", algorithm: "a" }] },
    }));
    await writeFile(qry, JSON.stringify({
      search: SECRET,
      searchFields: "title",
      filter: `category eq '${SECRET}' and rating gt 3 and tags/any(t: t eq '${SECRET}')`,
      orderby: "rating desc, title asc",
      facets: ["category,count:5", "tags"],
      select: "id,title,rating",
    }));
    const ok = await validateSearchSchema({ indexFile: idx, queryFile: qry });
    expect(ok.findings).toEqual([]);
    expect(ok.status).toBe("passed_local_checks");

    // Defaults that are false: collections are not sortable, REST vector fields are not retrievable,
    // non-string fields are not searchable.
    await writeFile(qry, JSON.stringify({ orderby: "tags asc", select: "embedding", searchFields: "rating" }));
    const bad = await validateSearchSchema({ indexFile: idx, queryFile: qry });
    const codes = bad.findings.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["FIELD_NOT_SORTABLE", "FIELD_NOT_RETRIEVABLE", "FIELD_NOT_SEARCHABLE"]));
    expect(bad.findings.every((f) => f.detail.includes("REST default"))).toBe(true);
    expect(JSON.stringify(ok) + JSON.stringify(bad)).not.toContain(SECRET);
  });
});

it("accepts Int16 and packed-bit vectors and geo.distance ordering", async () => {
  await withTempDir(async (dir) => {
    const idx = join(dir, "vector-types-index.json");
    const qry = join(dir, "vector-types-query.json");
    await writeFile(idx, JSON.stringify({
      name: "vt-idx",
      fields: [
        { name: "id", type: "Edm.String", key: true },
        { name: "location", type: "Edm.GeographyPoint" },
        { name: "v16", type: "Collection(Edm.Int16)", searchable: true, dimensions: 4, vectorSearchProfile: "p" },
        { name: "bits", type: "Collection(Edm.Byte)", vectorEncoding: "packedBit", searchable: true, dimensions: 1024, vectorSearchProfile: "p" },
        { name: "bad", type: "Collection(Edm.Int8)", dimensions: 4, vectorSearchProfile: "p" },
      ],
      vectorSearch: { algorithms: [{ name: "a", kind: "hnsw" }], profiles: [{ name: "p", algorithm: "a" }] },
    }));
    await writeFile(qry, JSON.stringify({
      orderby: "geo.distance(location, geography'POINT(-122.13 47.64)') asc, id desc",
      vectorQueries: [
        { kind: "vector", vector: [1, 2, 3, 4], fields: "v16" },
        { kind: "vector", vector: new Array(128).fill(1), fields: "bits" },
      ],
    }));
    const report = await validateSearchSchema({ indexFile: idx, queryFile: qry });
    const codes = report.findings.map((f) => f.code);
    expect(codes).toEqual(["INVALID_VECTOR_FIELD_TYPE"]);

    await writeFile(qry, JSON.stringify({ vectorQueries: [{ kind: "vector", vector: new Array(1024).fill(1), fields: "bits" }] }));
    const mismatch = await validateSearchSchema({ indexFile: idx, queryFile: qry });
    expect(mismatch.findings.map((f) => f.code)).toContain("VECTOR_QUERY_DIMENSION_MISMATCH");

    // Collection(Edm.Byte) is only allowed for packed binary vectors.
    const byteIdx = join(dir, "byte-index.json");
    await writeFile(byteIdx, JSON.stringify({
      name: "byte-idx",
      fields: [
        { name: "id", type: "Edm.String", key: true },
        { name: "raw", type: "Collection(Edm.Byte)", searchable: true, dimensions: 8, vectorSearchProfile: "p" },
      ],
      vectorSearch: { algorithms: [{ name: "a", kind: "hnsw" }], profiles: [{ name: "p", algorithm: "a" }] },
    }));
    const byteRes = await validateSearchSchema({ indexFile: byteIdx });
    expect(byteRes.status).toBe("failed_preflight");
    expect(byteRes.findings.map((f) => f.code)).toEqual(["BYTE_VECTOR_REQUIRES_PACKED_BIT"]);

    // OData function tokens (search.in, geo.distance) and lambda variables must not match same-named non-filterable fields.
    const fnIdx = join(dir, "fn-filter-index.json");
    const fnQry = join(dir, "fn-filter-query.json");
    await writeFile(fnIdx, JSON.stringify({
      name: "fn-idx",
      fields: [
        { name: "id", type: "Edm.String", key: true },
        { name: "search", type: "Edm.String", filterable: false },
        { name: "in", type: "Edm.String", filterable: false },
        { name: "geo", type: "Edm.String", filterable: false },
        { name: "distance", type: "Edm.String", filterable: false },
        { name: "t", type: "Edm.String", filterable: false },
        { name: "category", type: "Edm.String", filterable: true },
        { name: "location", type: "Edm.GeographyPoint", filterable: true },
        { name: "tags", type: "Collection(Edm.String)", filterable: true },
      ],
    }));
    await writeFile(fnQry, JSON.stringify({
      filter: `search.in(category, '${SECRET}') and geo.distance(location, geography'POINT(-122.13 47.64)') le 10 and tags/any(t: t eq '${SECRET}')`,
    }));
    const fnRes = await validateSearchSchema({ indexFile: fnIdx, queryFile: fnQry });
    expect(fnRes.status).toBe("passed_local_checks");
    expect(fnRes.findings).toEqual([]);
    expect(JSON.stringify(fnRes)).not.toContain(SECRET);

    // Semantic content fields with omitted searchable on non-string types (REST default false) must fail.
    const semIdx = join(dir, "sem-nonstring-index.json");
    await writeFile(semIdx, JSON.stringify({
      name: "sem-idx",
      fields: [
        { name: "id", type: "Edm.String", key: true },
        { name: "scoreNum", type: "Edm.Double" },
      ],
      semantic: {
        configurations: [{
          name: "sem-cfg",
          prioritizedFields: { prioritizedContentFields: [{ fieldName: "scoreNum" }] },
        }],
      },
    }));
    const semRes = await validateSearchSchema({ indexFile: semIdx });
    expect(semRes.status).toBe("failed_preflight");
    expect(semRes.findings.map((f) => f.code)).toContain("SEMANTIC_CONTENT_FIELD_NOT_SEARCHABLE");
  });
});

it("CLI exits 1 on malformed JSON without echoing content and 2 on usage errors", async () => {
  await withTempDir(async (dir) => {
    const idx = join(dir, "malformed.json");
    await writeFile(idx, `{"name": "${SECRET}", `);
    const bad = spawnSync(process.execPath, [script, "--index", idx], { encoding: "utf8" });
    expect(bad.status).toBe(1);
    expect(JSON.parse(bad.stderr).error).toBe("INVALID_JSON");
    expect(bad.stdout + bad.stderr).not.toContain(SECRET);

    const usage = spawnSync(process.execPath, [script, "--query", idx], { encoding: "utf8" });
    expect(usage.status).toBe(2);
  });
});

const launchers = [
  {
    name: "Bash",
    executable: isWindows ? undefined : resolveExecutable("bash"),
    file: "validate-search-schema.sh",
    args: (file: string, ...rest: string[]) => [file, ...rest],
  },
  {
    name: "PowerShell",
    executable: resolveExecutable(isWindows ? "powershell" : "pwsh"),
    file: "validate-search-schema.ps1",
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
