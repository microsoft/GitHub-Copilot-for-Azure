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

type LocalLink = {
  /**
   * Line number at which the link exist in the given file.
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

      // Only include links that exist and are files (not directories)
      if (existsSync(resolved)) {
        try {
          if (!statSync(resolved).isDirectory()) {
            links.push({
              line: i + 1,
              link: target,
              absPath: resolved,
              isDirectory: false,
              exists: true
            });
          } else {
            links.push({
              line: i + 1,
              link: target,
              absPath: resolved,
              isDirectory: true,
              exists: true
            });
          }
        } catch {
          // Treat the item as non-existent if stat fails.
          links.push({
            line: i + 1,
            link: target,
            absPath: resolved,
            exists: false
          });
        }
      } else {
        links.push({
          line: i + 1,
          link: target,
          absPath: resolved,
          exists: false
        });
      }
    }
  }

  return links;
}