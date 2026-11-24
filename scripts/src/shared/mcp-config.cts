import { isDeepStrictEqual } from "node:util";

/** Compares MCP configurations while accepting equivalent client-specific plugin roots. */
export function equivalentMcpValues(portable: unknown, legacy: unknown): boolean {
  if (isDeepStrictEqual(portable, legacy)) {
    return true;
  }
  if (typeof portable === "string" && typeof legacy === "string") {
    return portable === legacy.replaceAll("${CLAUDE_PLUGIN_ROOT}", "${PLUGIN_ROOT}");
  }
  if (Array.isArray(portable) && Array.isArray(legacy)) {
    return portable.length === legacy.length &&
      portable.every((value, index) => equivalentMcpValues(value, legacy[index]));
  }
  if (
    typeof portable === "object" && portable !== null && !Array.isArray(portable) &&
    typeof legacy === "object" && legacy !== null && !Array.isArray(legacy)
  ) {
    const portableObject = portable as Record<string, unknown>;
    const legacyObject = legacy as Record<string, unknown>;
    const keys = Object.keys(portableObject);
    return keys.length === Object.keys(legacyObject).length &&
      keys.every(key => Object.hasOwn(legacyObject, key) &&
        equivalentMcpValues(portableObject[key], legacyObject[key]));
  }
  return false;
}
