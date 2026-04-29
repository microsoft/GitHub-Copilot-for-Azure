/** Redact token-like values from report text to prevent secret leakage */
const SECRET_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /Bearer\s+[A-Za-z0-9_\-.~+/]{20,}/gi, // Bearer tokens
  /gh[pousr]_[A-Za-z0-9_]{36,}/g, // GitHub tokens
  /sig\s{0,2}=\s{0,2}[a-zA-Z0-9%+/=_\-.]{20,}/g // Azure SAS
];

// Key=value style secrets (including JSON-style properties). Capture the key + separator as group 1
// so we can preserve the structure and only redact the value.
const KEY_VALUE_SECRET_PATTERN =
  /((?:password|passwd|secret|token|api[_-]?key|connection[_-]?string)[\\]*["']?\s*[:=]\s*[\\]*["']?)[^\s"',]{8,}/gi;

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, "[REDACTED]");
  }
  // Preserve the key + separator and only redact the secret value to avoid corrupting JSON.
  result = result.replace(KEY_VALUE_SECRET_PATTERN, "$1[REDACTED]");
  return result;
}