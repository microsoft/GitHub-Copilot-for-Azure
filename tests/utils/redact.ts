/** Redact token-like values from report text to prevent secret leakage */
const SECRET_PATTERNS = [
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
    /Bearer\s+[A-Za-z0-9_\-.~+/]{20,}/gi, // Bearer tokens
    /gh[pousr]_[A-Za-z0-9_]{36,}/g, // GitHub tokens
    /(?:password|passwd|secret|token|api[_-]?key|connection[_-]?string)\s*[:=]\s*["']?[^\s"',]{8,}/gi, // key=value secrets
];

export function redactSecrets(text: string): string {
    let result = text;
    for (const pattern of SECRET_PATTERNS) {
        pattern.lastIndex = 0;
        result = result.replace(pattern, "[REDACTED]");
    }
    return result;
}