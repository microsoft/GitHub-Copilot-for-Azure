#!/usr/bin/env node
// Local allowlist validator for classic Azure AI Search index definitions and search query payloads.
// Exit codes: 0 = report written to stdout or --help, 1 = file/read/size/JSON error, 2 = usage/argument error.
import { realpathSync } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_JSON_BYTES = 16 * 1024 * 1024;

async function readBoundedUtf8(filePath, maxBytes) {
  let handle;
  try {
    handle = await open(filePath, "r");
  } catch (err) {
    if (err?.code === "EISDIR") throw new Error("NOT_A_FILE");
    throw err;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error("NOT_A_FILE");
    if (info.size > maxBytes) throw new Error("INPUT_TOO_LARGE");
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}
const VECTOR_TYPES = new Set([
  "Collection(Edm.Single)",
  "Collection(Edm.Half)",
  "Collection(Edm.Int16)",
  "Collection(Edm.SByte)",
  "Collection(Edm.Byte)",
]);
const SAFE_FIELD = /^[A-Za-z_][A-Za-z0-9_/-]{0,127}$/;
const SAFE_TYPE = /^(?:Collection\()?Edm\.[A-Za-z]{1,32}\)?$/;
const COMPLEX_TYPES = new Set(["Edm.ComplexType", "Collection(Edm.ComplexType)"]);

function usage() {
  return [
    "Usage: node validate-search-schema.mjs --index <index.json> [--query <query.json>]",
    "",
    "Validates classic Azure AI Search index schemas and vector/hybrid/semantic query payloads offline without emitting query text or vector values.",
    "Exit codes: 0 = report written or --help, 1 = file/read/size/JSON error, 2 = usage/argument error.",
  ].join("\n");
}

function safeName(name, fallback = "(unnamed)") {
  return typeof name === "string" && SAFE_FIELD.test(name) ? name : fallback;
}

function safeType(type) {
  return typeof type === "string" && SAFE_TYPE.test(type) ? type : "(unrecognized type)";
}

function collectFields(fields, prefix = "", depth = 0, map = new Map(), inComplexCollection = false) {
  if (!Array.isArray(fields) || depth > 8) return map;
  for (const field of fields) {
    if (!field || typeof field !== "object" || typeof field.name !== "string") continue;
    const fullName = prefix ? `${prefix}/${field.name}` : field.name;
    map.set(fullName, {
      ...field,
      fullName,
      isNested: depth > 0,
      inComplexCollection,
    });
    if (Array.isArray(field.fields)) {
      collectFields(field.fields, fullName, depth + 1, map,
        inComplexCollection || field.type === "Collection(Edm.ComplexType)");
    }
  }
  return map;
}

// Effective attribute value for an index definition written against the REST API. REST applies
// data-type defaults when an attribute is omitted; Azure SDK field classes have no defaults, but
// serialized SDK definitions and GET Index responses carry explicit values, so REST defaults apply.
// Returns { value: true | false | null, explicit }; null = not applicable (complex fields).
function effectiveAttribute(field, attr) {
  if (typeof field[attr] === "boolean") return { value: field[attr], explicit: true };
  const type = typeof field.type === "string" ? field.type : "";
  if (COMPLEX_TYPES.has(type)) return { value: null, explicit: false };
  const isVector = VECTOR_TYPES.has(type);
  const multiValued = type.startsWith("Collection(") || field.inComplexCollection === true;
  switch (attr) {
    case "searchable":
      return { value: isVector || type === "Edm.String" || type === "Collection(Edm.String)", explicit: false };
    case "filterable":
      return { value: !isVector, explicit: false };
    case "sortable":
      return { value: !isVector && !multiValued, explicit: false };
    case "facetable":
      return { value: !isVector && !type.includes("Edm.GeographyPoint"), explicit: false };
    case "retrievable":
      // Vector fields added through REST default to retrievable: false.
      return { value: !isVector, explicit: false };
    default:
      return { value: null, explicit: false };
  }
}

function attributeDetail(attr, effective) {
  return effective.explicit
    ? `sets ${attr}: false`
    : `omits ${attr}, and the REST default for its type is false`;
}

// Split a comma-separated list, ignoring commas inside parentheses or quoted literals
// (for example geo.distance(location, geography'POINT(...)') in orderby).
function splitTopLevel(value) {
  if (typeof value !== "string") return [];
  const parts = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === "'") {
      if (quoted && value[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      quoted = !quoted;
    } else if (!quoted && ch === "(") {
      depth += 1;
    } else if (!quoted && ch === ")") {
      depth = Math.max(0, depth - 1);
    } else if (!quoted && depth === 0 && ch === ",") {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((s) => s.trim()).filter(Boolean);
}

function splitCsvFields(value) {
  return splitTopLevel(value);
}

const ODATA_KEYWORDS = new Set([
  "and", "or", "not", "eq", "ne", "gt", "lt", "ge", "le",
  "true", "false", "null", "add", "sub", "mul", "div", "mod",
]);

function extractFilterIdentifiers(filterExpr, knownFields) {
  if (typeof filterExpr !== "string" || filterExpr.trim() === "") return [];
  let stripped = filterExpr.replace(/(?:geography|geometry)?'(?:''|[^'])*'/g, "''");
  // Resolve lambda range variables in `collection/any(v: v/sub ...)` so `v` is not mistaken
  // for an unrelated top-level field of the same name and `v/sub` maps to `collection/sub`.
  const lambdas = [];
  stripped = stripped.replace(
    /([A-Za-z_][A-Za-z0-9_/]*)\/(?:any|all)\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g,
    (_, collection, variable) => {
      lambdas.push({ collection, variable });
      return `${collection} (`;
    },
  );
  for (const { collection, variable } of lambdas) {
    const varEsc = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    stripped = stripped.replace(new RegExp(`(?<![A-Za-z0-9_/.])${varEsc}\\/`, "g"), `${collection}/`);
    stripped = stripped.replace(new RegExp(`(?<![A-Za-z0-9_/.])${varEsc}(?![A-Za-z0-9_/.(])`, "g"), " ");
  }
  const matched = new Set();
  for (const fieldName of knownFields.keys()) {
    if (ODATA_KEYWORDS.has(fieldName.toLowerCase())) continue;
    const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?<![A-Za-z0-9_/.])${escaped}(?![A-Za-z0-9_/.(])`);
    if (regex.test(stripped)) matched.add(fieldName);
  }
  return [...matched];
}

export async function validateSearchSchema({ indexFile, queryFile } = {}) {
  if (!indexFile) throw new Error("MISSING_INPUT");
  const rawIndex = JSON.parse(await readBoundedUtf8(indexFile, MAX_JSON_BYTES));
  if (!rawIndex || typeof rawIndex !== "object" || Array.isArray(rawIndex)) {
    throw new Error("INVALID_INDEX_JSON");
  }

  const findings = [];
  const topFields = Array.isArray(rawIndex.fields) ? rawIndex.fields : undefined;
  if (!topFields || topFields.length === 0) {
    findings.push({
      code: "MISSING_INDEX_FIELDS",
      severity: "error",
      detail: "Index JSON must contain a non-empty top-level 'fields' array.",
    });
    return { status: "failed_preflight", findings };
  }

  const fieldMap = collectFields(topFields);
  const keyFields = topFields.filter((f) => f && f.key === true);
  if (keyFields.length === 0) {
    findings.push({
      code: "MISSING_KEY_FIELD",
      severity: "error",
      detail: "Index schema has no top-level field with key: true.",
    });
  } else if (keyFields.length > 1) {
    findings.push({
      code: "MULTIPLE_KEY_FIELDS",
      severity: "error",
      detail: `Index schema defines ${keyFields.length} key fields; exactly one key field is allowed.`,
    });
  } else if (keyFields[0].type !== "Edm.String") {
    findings.push({
      code: "NON_STRING_KEY_FIELD",
      severity: "error",
      detail: `Key field '${safeName(keyFields[0].name)}' has type '${safeType(keyFields[0].type)}'; Edm.String is required.`,
    });
  }

  const vectorSearch = rawIndex.vectorSearch && typeof rawIndex.vectorSearch === "object" ? rawIndex.vectorSearch : {};
  const algorithms = new Map(
    (Array.isArray(vectorSearch.algorithms) ? vectorSearch.algorithms : [])
      .filter((a) => a && typeof a.name === "string")
      .map((a) => [a.name, a]),
  );
  const vectorizers = new Map(
    (Array.isArray(vectorSearch.vectorizers) ? vectorSearch.vectorizers : [])
      .filter((v) => v && typeof v.name === "string")
      .map((v) => [v.name, v]),
  );
  const compressions = new Map(
    (Array.isArray(vectorSearch.compressions) ? vectorSearch.compressions : [])
      .filter((c) => c && typeof c.name === "string")
      .map((c) => [c.name, c]),
  );
  const profiles = new Map();
  for (const profile of Array.isArray(vectorSearch.profiles) ? vectorSearch.profiles : []) {
    if (!profile || typeof profile.name !== "string") continue;
    profiles.set(profile.name, profile);
    const algoRef = profile.algorithm ?? profile.algorithmConfigurationName;
    if (!algoRef || !algorithms.has(algoRef)) {
      findings.push({
        code: "DANGLING_VECTOR_ALGORITHM_REFERENCE",
        severity: "error",
        detail: `Vector profile '${safeName(profile.name)}' references missing algorithm '${safeName(algoRef, "(missing)")}'.`,
      });
    }
    if (profile.vectorizer && !vectorizers.has(profile.vectorizer)) {
      findings.push({
        code: "DANGLING_VECTORIZER_REFERENCE",
        severity: "error",
        detail: `Vector profile '${safeName(profile.name)}' references missing vectorizer '${safeName(profile.vectorizer)}'.`,
      });
    }
    const compRef = profile.compression ?? profile.compressionConfigurationName;
    if (compRef && !compressions.has(compRef)) {
      findings.push({
        code: "DANGLING_COMPRESSION_REFERENCE",
        severity: "error",
        detail: `Vector profile '${safeName(profile.name)}' references missing compression '${safeName(compRef)}'.`,
      });
    }
  }

  let vectorFieldCount = 0;
  for (const field of fieldMap.values()) {
    const dimensions = field.dimensions ?? field.vectorSearchDimensions;
    const profileName = field.vectorSearchProfile ?? field.vectorSearchProfileName;
    const isVector = VECTOR_TYPES.has(field.type) || dimensions !== undefined || profileName !== undefined;
    if (!isVector) continue;
    vectorFieldCount += 1;

    if (!VECTOR_TYPES.has(field.type)) {
      findings.push({
        code: "INVALID_VECTOR_FIELD_TYPE",
        severity: "error",
        detail: `Field '${safeName(field.fullName)}' has vector settings with unsupported type '${safeType(field.type)}'.`,
      });
    } else if (field.type === "Collection(Edm.Byte)" && field.vectorEncoding !== "packedBit") {
      findings.push({
        code: "BYTE_VECTOR_REQUIRES_PACKED_BIT",
        severity: "error",
        detail: `Field '${safeName(field.fullName)}' uses Collection(Edm.Byte), which is only allowed for packed binary vectors (vectorEncoding: "packedBit").`,
      });
    }
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      findings.push({
        code: "VECTOR_FIELD_MISSING_DIMENSIONS",
        severity: "error",
        detail: `Vector field '${safeName(field.fullName)}' requires a positive integer 'dimensions'.`,
      });
    }
    if (!profileName || !profiles.has(profileName)) {
      findings.push({
        code: "VECTOR_FIELD_MISSING_OR_UNKNOWN_PROFILE",
        severity: "error",
        detail: `Vector field '${safeName(field.fullName)}' references missing vectorSearchProfile '${safeName(profileName, "(missing)")}'.`,
      });
    }
    if (field.searchable === false) {
      findings.push({
        code: "VECTOR_FIELD_NOT_SEARCHABLE",
        severity: "error",
        detail: `Vector field '${safeName(field.fullName)}' sets searchable: false; vector queries require searchable: true.`,
      });
    }
  }

  const semanticObj = rawIndex.semantic ?? rawIndex.semanticSearch;
  const semanticConfigs = new Map();
  if (semanticObj && typeof semanticObj === "object") {
    for (const cfg of Array.isArray(semanticObj.configurations) ? semanticObj.configurations : []) {
      if (!cfg || typeof cfg.name !== "string") continue;
      semanticConfigs.set(cfg.name, cfg);
      const prio = cfg.prioritizedFields ?? {};
      const titleName = prio.titleField?.fieldName;
      if (titleName && !fieldMap.has(titleName)) {
        findings.push({
          code: "SEMANTIC_MISSING_TITLE_FIELD",
          severity: "error",
          detail: `Semantic configuration '${safeName(cfg.name)}' references missing titleField '${safeName(titleName)}'.`,
        });
      }
      const contentFields = prio.prioritizedContentFields ?? prio.contentFields ?? [];
      for (const cf of Array.isArray(contentFields) ? contentFields : []) {
        if (!cf?.fieldName) continue;
        const target = fieldMap.get(cf.fieldName);
        if (!target) {
          findings.push({
            code: "SEMANTIC_MISSING_CONTENT_FIELD",
            severity: "error",
            detail: `Semantic configuration '${safeName(cfg.name)}' references missing content field '${safeName(cf.fieldName)}'.`,
          });
        } else if (effectiveAttribute(target, "searchable").value !== true) {
          findings.push({
            code: "SEMANTIC_CONTENT_FIELD_NOT_SEARCHABLE",
            severity: "error",
            detail: `Semantic content field '${safeName(cf.fieldName)}' must be searchable.`,
          });
        }
      }
      const keywordFields = prio.prioritizedKeywordsFields ?? prio.keywordsFields ?? [];
      for (const kf of Array.isArray(keywordFields) ? keywordFields : []) {
        if (!kf?.fieldName) continue;
        const target = fieldMap.get(kf.fieldName);
        if (!target) {
          findings.push({
            code: "SEMANTIC_MISSING_KEYWORDS_FIELD",
            severity: "error",
            detail: `Semantic configuration '${safeName(cfg.name)}' references missing keywords field '${safeName(kf.fieldName)}'.`,
          });
        } else if (effectiveAttribute(target, "searchable").value !== true) {
          findings.push({
            code: "SEMANTIC_KEYWORDS_FIELD_NOT_SEARCHABLE",
            severity: "error",
            detail: `Semantic keywords field '${safeName(kf.fieldName)}' must be searchable.`,
          });
        }
      }
    }
  }

  let queryReport;
  if (queryFile) {
    const rawQuery = JSON.parse(await readBoundedUtf8(queryFile, MAX_JSON_BYTES));
    if (!rawQuery || typeof rawQuery !== "object" || Array.isArray(rawQuery)) {
      throw new Error("INVALID_QUERY_JSON");
    }

    const vectorQueries = Array.isArray(rawQuery.vectorQueries)
      ? rawQuery.vectorQueries
      : Array.isArray(rawQuery.vectors)
        ? rawQuery.vectors
        : [];
    const hasSearchText = typeof rawQuery.search === "string" && rawQuery.search.trim() !== "" && rawQuery.search.trim() !== "*";
    const queryType = typeof rawQuery.queryType === "string" ? rawQuery.queryType : "simple";

    if (queryType === "semantic") {
      const requestedSemantic = rawQuery.semanticConfiguration;
      const defaultSemantic = semanticObj?.defaultConfiguration;
      if (semanticConfigs.size === 0) {
        findings.push({
          code: "SEMANTIC_QUERY_WITHOUT_INDEX_CONFIG",
          severity: "error",
          detail: "Query sets queryType: 'semantic', but the index defines no semantic configurations.",
        });
      } else if (!requestedSemantic && !defaultSemantic) {
        findings.push({
          code: "MISSING_QUERY_SEMANTIC_CONFIGURATION",
          severity: "error",
          detail: "Query sets queryType: 'semantic' without semanticConfiguration, and index has no defaultConfiguration.",
        });
      } else if (requestedSemantic && !semanticConfigs.has(requestedSemantic)) {
        findings.push({
          code: "UNKNOWN_QUERY_SEMANTIC_CONFIGURATION",
          severity: "error",
          detail: `Query references unknown semanticConfiguration '${safeName(requestedSemantic)}'.`,
        });
      }
    }

    for (let i = 0; i < vectorQueries.length; i += 1) {
      const vq = vectorQueries[i];
      if (!vq || typeof vq !== "object") continue;
      const targetFields = splitCsvFields(vq.fields);
      if (targetFields.length === 0) {
        findings.push({
          code: "VECTOR_QUERY_MISSING_FIELDS",
          severity: "error",
          detail: `vectorQueries[${i}] omits 'fields'.`,
        });
      }
      for (const fname of targetFields) {
        const field = fieldMap.get(fname);
        if (!field) {
          findings.push({
            code: "VECTOR_QUERY_UNKNOWN_FIELD",
            severity: "error",
            detail: `vectorQueries[${i}] targets missing field '${safeName(fname)}'.`,
          });
          continue;
        }
        const expectedDims = field.dimensions ?? field.vectorSearchDimensions;
        const profileName = field.vectorSearchProfile ?? field.vectorSearchProfileName;
        if (!VECTOR_TYPES.has(field.type)) {
          findings.push({
            code: "VECTOR_QUERY_NON_VECTOR_FIELD",
            severity: "error",
            detail: `vectorQueries[${i}] targets non-vector field '${safeName(fname)}' (${safeType(field.type)}).`,
          });
          continue;
        }
        // Packed binary fields (Collection(Edm.Byte) + vectorEncoding: packedBit) declare dimensions
        // in bits; the query vector carries ceiling(dimensions / 8) bytes.
        const packedBit = field.type === "Collection(Edm.Byte)" && field.vectorEncoding === "packedBit";
        const expectedLength = Number.isInteger(expectedDims)
          ? (packedBit ? Math.ceil(expectedDims / 8) : expectedDims)
          : undefined;
        if (Array.isArray(vq.vector) && Number.isInteger(expectedLength) && vq.vector.length !== expectedLength) {
          findings.push({
            code: "VECTOR_QUERY_DIMENSION_MISMATCH",
            severity: "error",
            detail: `vectorQueries[${i}] supplies ${vq.vector.length} values for field '${safeName(fname)}' (expected ${expectedLength}${packedBit ? ` bytes for ${expectedDims} packed bits` : ""}).`,
          });
        }
        if (vq.kind === "text") {
          const prof = profileName ? profiles.get(profileName) : undefined;
          if (!prof?.vectorizer) {
            findings.push({
              code: "TEXT_VECTOR_QUERY_MISSING_VECTORIZER",
              severity: "error",
              detail: `vectorQueries[${i}] uses kind: 'text' on field '${safeName(fname)}', whose profile '${safeName(profileName)}' has no integrated vectorizer.`,
            });
          }
        }
      }
    }

    for (const sf of splitCsvFields(rawQuery.searchFields)) {
      const target = fieldMap.get(sf);
      if (!target) {
        findings.push({ code: "UNKNOWN_SEARCH_FIELD", severity: "error", detail: `searchFields references missing field '${safeName(sf)}'.` });
      } else {
        const eff = effectiveAttribute(target, "searchable");
        if (eff.value === false) {
          findings.push({ code: "FIELD_NOT_SEARCHABLE", severity: "error", detail: `searchFields references field '${safeName(sf)}', which ${attributeDetail("searchable", eff)}.` });
        }
      }
    }

    for (const sel of splitCsvFields(rawQuery.select)) {
      if (sel === "*") continue;
      const target = fieldMap.get(sel);
      if (!target) {
        findings.push({ code: "UNKNOWN_SELECT_FIELD", severity: "error", detail: `select references missing field '${safeName(sel)}'.` });
      } else if (target.hidden === true) {
        findings.push({ code: "FIELD_NOT_RETRIEVABLE", severity: "error", detail: `select references field '${safeName(sel)}', which sets hidden: true.` });
      } else {
        const eff = effectiveAttribute(target, "retrievable");
        if (eff.value === false) {
          findings.push({ code: "FIELD_NOT_RETRIEVABLE", severity: "error", detail: `select references field '${safeName(sel)}', which ${attributeDetail("retrievable", eff)}.` });
        }
      }
    }

    for (const clause of splitCsvFields(rawQuery.orderby)) {
      const geoMatch = clause.match(/^geo\.distance\(\s*([A-Za-z_][A-Za-z0-9_/]*)\s*,/);
      if (geoMatch) {
        const geoField = geoMatch[1];
        const target = fieldMap.get(geoField);
        if (!target) {
          findings.push({ code: "UNKNOWN_ORDERBY_FIELD", severity: "error", detail: `orderby geo.distance references missing field '${safeName(geoField)}'.` });
        } else {
          const eff = effectiveAttribute(target, "sortable");
          if (eff.value === false) {
            findings.push({ code: "FIELD_NOT_SORTABLE", severity: "error", detail: `orderby geo.distance references field '${safeName(geoField)}', which ${attributeDetail("sortable", eff)}.` });
          }
        }
        continue;
      }
      const fname = clause.split(/\s+/)[0];
      if (!fname || fname.startsWith("search.score") || fname.startsWith("geo.distance")) continue;
      const target = fieldMap.get(fname);
      if (!target) {
        findings.push({ code: "UNKNOWN_ORDERBY_FIELD", severity: "error", detail: `orderby references missing field '${safeName(fname)}'.` });
      } else {
        const eff = effectiveAttribute(target, "sortable");
        if (eff.value === false) {
          findings.push({ code: "FIELD_NOT_SORTABLE", severity: "error", detail: `orderby references field '${safeName(fname)}', which ${attributeDetail("sortable", eff)}.` });
        }
      }
    }

    if (Array.isArray(rawQuery.facets)) {
      for (const facetExpr of rawQuery.facets) {
        if (typeof facetExpr !== "string") continue;
        const fname = facetExpr.split(",")[0].trim();
        const target = fieldMap.get(fname);
        if (!target) {
          findings.push({ code: "UNKNOWN_FACET_FIELD", severity: "error", detail: `facets references missing field '${safeName(fname)}'.` });
        } else {
          const eff = effectiveAttribute(target, "facetable");
          if (eff.value === false) {
            findings.push({ code: "FIELD_NOT_FACETABLE", severity: "error", detail: `facets references field '${safeName(fname)}', which ${attributeDetail("facetable", eff)}.` });
          }
        }
      }
    }

    for (const filterField of extractFilterIdentifiers(rawQuery.filter, fieldMap)) {
      const target = fieldMap.get(filterField);
      if (!target) continue;
      const eff = effectiveAttribute(target, "filterable");
      if (eff.value === false) {
        findings.push({
          code: "FIELD_NOT_FILTERABLE",
          severity: "error",
          detail: `filter expression references field '${safeName(filterField)}', which ${attributeDetail("filterable", eff)}.`,
        });
      }
    }

    queryReport = {
      queryType: safeName(queryType, "custom"),
      isHybrid: hasSearchText && vectorQueries.length > 0,
      vectorQueryCount: vectorQueries.length,
      hasFilter: typeof rawQuery.filter === "string" && rawQuery.filter.trim() !== "",
    };
  }

  const status = findings.some((f) => f.severity === "error") ? "failed_preflight" : findings.some((f) => f.severity === "warning") ? "passed_with_warnings" : "passed_local_checks";

  return {
    status,
    index: {
      totalFieldCount: fieldMap.size,
      vectorFieldCount,
      vectorProfileCount: profiles.size,
      vectorizerCount: vectorizers.size,
      semanticConfigurationCount: semanticConfigs.size,
    },
    ...(queryReport ? { query: queryReport } : {}),
    findings,
  };
}

function parseCli(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--index") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.indexFile = resolve(argv[++i]);
    } else if (arg === "--query") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.queryFile = resolve(argv[++i]);
    } else {
      throw new Error("USAGE");
    }
  }
  if (!opts.indexFile) throw new Error("USAGE");
  return opts;
}

async function main() {
  let opts;
  try {
    opts = parseCli(process.argv.slice(2));
  } catch {
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }
  if (opts.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  try {
    const report = await validateSearchSchema(opts);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (err) {
    const code = err instanceof SyntaxError
      ? "INVALID_JSON"
      : (err?.code || (typeof err?.message === "string" && /^[A-Z0-9_]+$/.test(err.message) ? err.message : "READ_ERROR"));
    process.stderr.write(`${JSON.stringify({ error: String(code) })}\n`);
    process.exit(1);
  }
}

try {
  if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    await main();
  }
} catch {
  // Imported as module
}
