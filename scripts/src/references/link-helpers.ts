import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Regex that captures local markdown link targets.
 *
 * Matches:
 *   [text](target)             – inline links
 *   [text](target#anchor)      – inline links with fragment
 *   [text](target "title")     – inline links with title
 *
 * Skips:
 *   https:// and http:// URLs
 *   mailto: links
 *   mdc: protocol links (Nuxt Content / internal protocol)
 *   Pure fragment links (#anchor-only)
 */
export const MARKDOWN_LINK_RE = /\[(?:[^\]]*)\]\(([^)]+)\)/g;

/**
 * Regex that captures the http/https protocol prefix of remote link targets.
 */
export const REMOTE_URL_RE = /https?:\/\//gi;

const TRAILING_PUNCTUATION = new Set([".", ",", ";", "!", "?", "`"]);

function extractRemoteUrlCandidate(line: string, startIndex: number): string {
  let endIndex = startIndex + line.slice(startIndex).match(/^https?:\/\//i)![0].length;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  while (endIndex < line.length) {
    const char = line[endIndex];
    const nextChar = line[endIndex + 1];

    if (char === "]" && nextChar === "(" && bracketDepth === 0) {
      break;
    }

    if (char === "<" || char === ">" || char === '"' || char === "'") {
      break;
    }

    if (/\s/.test(char) && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      break;
    }

    if (char === ";" && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      break;
    }

    if (char === "(") {
      parenDepth++;
    } else if (char === ")") {
      if (parenDepth === 0) {
        break;
      }
      parenDepth--;
    } else if (char === "[") {
      bracketDepth++;
    } else if (char === "]") {
      if (bracketDepth === 0) {
        break;
      }
      bracketDepth--;
    } else if (char === "{") {
      braceDepth++;
    } else if (char === "}") {
      if (braceDepth === 0) {
        break;
      }
      braceDepth--;
    }

    endIndex++;
  }

  return line.slice(startIndex, endIndex);
}

function trimTrailingUrlChars(url: string): string {
  let output = url;

  while (output.length > 0) {
    const last = output.at(-1);
    if (!last) {
      break;
    }

    if (TRAILING_PUNCTUATION.has(last)) {
      output = output.slice(0, -1);
      continue;
    }

    if (last === ")") {
      const opens = (output.match(/\(/g) ?? []).length;
      const closes = (output.match(/\)/g) ?? []).length;
      if (closes > opens) {
        output = output.slice(0, -1);
        continue;
      }
    }

    if (last === "]") {
      const opens = (output.match(/\[/g) ?? []).length;
      const closes = (output.match(/\]/g) ?? []).length;
      if (closes > opens) {
        output = output.slice(0, -1);
        continue;
      }
    }

    if (last === "}") {
      const opens = (output.match(/\{/g) ?? []).length;
      const closes = (output.match(/\}/g) ?? []).length;
      if (closes > opens) {
        output = output.slice(0, -1);
        continue;
      }
    }

    break;
  }

  return output;
}

function parseRemoteLink(rawUrl: string): {
  protocol: "http" | "https";
  host: string;
  path: string;
} {
  const lower = rawUrl.toLowerCase();
  const protocol: "http" | "https" = lower.startsWith("https://") ? "https" : "http";

  try {
    const parsed = new URL(rawUrl);
    return {
      protocol,
      host: parsed.host,
      path: parsed.pathname || "/"
    };
  } catch {
    const withoutScheme = rawUrl.replace(/^https?:\/\//i, "");
    const firstPathChar = withoutScheme.search(/[/?#]/);
    const authority = firstPathChar === -1
      ? withoutScheme
      : withoutScheme.slice(0, firstPathChar);
    const remainder = firstPathChar === -1
      ? ""
      : withoutScheme.slice(firstPathChar);

    const withoutCredentials = authority.includes("@")
      ? authority.slice(authority.lastIndexOf("@") + 1)
      : authority;

    let host = withoutCredentials;
    if (host.startsWith("[")) {
      const end = host.indexOf("]");
      host = end > 0 ? host.slice(0, end + 1) : host;
    } else {
      host = host.replace(/:\d+$/, "");
    }

    const pathMatch = remainder.match(/^([^?#]*)/);
    const path = pathMatch && pathMatch[1] !== "" ? pathMatch[1] : "/";

    return {
      protocol,
      host,
      path: path.startsWith("/") ? path : `/${path}`,
    };
  }
}

function isIgnoredLink(rawTarget: string): boolean {
  const trimmed = rawTarget.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return true;
  if (trimmed.startsWith("mailto:")) return true;
  if (trimmed.startsWith("mdc:")) return true;
  if (trimmed.startsWith("vscode://")) return true;
  if (trimmed.startsWith("#")) return true; // pure fragment
  return false;
}

/**
 * Strip fragment identifiers (`#…`) and optional titles (`"…"`) from a link
 * target so we are left with just the file/dir path.
 */
function cleanTarget(rawTarget: string): string {
  let target = rawTarget.trim();
  // Remove optional title ("title" or 'title') at the end
  target = target.replace(/\s+["'][^"']*["']\s*$/, "");
  // Remove fragment
  target = target.replace(/#.*$/, "");
  return target.trim();
}

export type LocalLink = {
  /**
   * Line number at which the link exists in the given file.
   * The first line's line number is 1.
   */
  line: number;

  /**
   * The exact value of the local link.
   */
  link: string;

  /**
   * Absolute path of the local link resolved from the file it's in.
   */
  absPath: string;

  /**
   * Whether the item of the local link exists.
   */
  exists: boolean;

  /**
   * Whether the item of the local link is a directory.
   * If the item doesn't exist, {@link LocalLink.isDirectory} is undefined.
   */
  isDirectory?: boolean;
}

export type RemoteLink = {
  /**
   * Line number at which the URL exists in the given file.
   * The first line's line number is 1.
   */
  line: number;

  /**
   * The exact URL value extracted from markdown.
   */
  link: string;

  /**
   * The URL protocol.
   */
  protocol: "http" | "https";

  /**
   * URL host (hostname with optional port when parseable).
   */
  host: string;

  /**
   * URL path without query/fragment. Defaults to '/'.
   */
  path: string;
}

/**
 * Extract all local markdown links from a file that need to be followed for
 * orphan detection. Returns resolved absolute paths.
 */
export function extractLocalLinks(mdFile: string, _skillDir: string): LocalLink[] {
  const links: LocalLink[] = [];
  const content = readFileSync(mdFile, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    MARKDOWN_LINK_RE.lastIndex = 0;

    while ((match = MARKDOWN_LINK_RE.exec(line)) !== null) {
      const rawTarget = match[1];
      if (isIgnoredLink(rawTarget)) continue;

      const target = cleanTarget(rawTarget);
      if (target === "") continue;

      const fileDir = dirname(mdFile);
      const resolved = resolve(fileDir, target);

      if (existsSync(resolved)) {
        try {
          if (!statSync(resolved).isDirectory()) {
            links.push({
              line: i + 1,
              link: rawTarget,
              absPath: resolved,
              isDirectory: false,
              exists: true
            });
          } else {
            links.push({
              line: i + 1,
              link: rawTarget,
              absPath: resolved,
              isDirectory: true,
              exists: true
            });
          }
        } catch {
          // Treat the item as non-existent if stat fails.
          links.push({
            line: i + 1,
            link: rawTarget,
            absPath: resolved,
            exists: false
          });
        }
      } else {
        links.push({
          line: i + 1,
          link: rawTarget,
          absPath: resolved,
          exists: false
        });
      }
    }
  }

  return links;
}

/**
 * Extract all remote links from markdown content, including URLs that appear
 * either in markdown link targets or as plain text.
 */
export function extractRemoteLinks(mdFile: string, _skillDir: string): RemoteLink[] {
  const links: RemoteLink[] = [];
  const content = readFileSync(mdFile, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    REMOTE_URL_RE.lastIndex = 0;

    while ((match = REMOTE_URL_RE.exec(line)) !== null) {
      const rawCandidate = extractRemoteUrlCandidate(line, match.index);
      REMOTE_URL_RE.lastIndex = match.index + Math.max(rawCandidate.length, match[0].length);

      const candidate = trimTrailingUrlChars(rawCandidate);
      if (candidate === "") {
        continue;
      }

      const parsed = parseRemoteLink(candidate);
      links.push({
        line: i + 1,
        link: candidate,
        protocol: parsed.protocol,
        host: parsed.host,
        path: parsed.path,
      });
    }
  }

  return links;
}
