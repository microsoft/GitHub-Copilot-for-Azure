#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";

const UNRELEASED_HEADING = "## Unreleased";
const OTHER_CHANGES_HEADING = "### Other Changes";
const VERSION_HEADING_PREFIX = "\n## ";

function buildEntry(sourceRepo: string, sourceSha: string, sourceServerUrl: string): string {
  return `- Synced \`allowed-skill-names.json\` and \`allowed-plugin-file-references.json\` from [GitHub-Copilot-for-Azure](${sourceServerUrl}/${sourceRepo}) at commit \`${sourceSha}\`.`;
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function updateChangelog(
  changelogPath: string,
  sourceRepo: string,
  sourceSha: string,
  sourceServerUrl: string
): void {
  const entry = buildEntry(sourceRepo, sourceSha, sourceServerUrl);
  let text = fs.readFileSync(changelogPath, "utf8");

  if (text.includes(entry)) {
    console.log("Changelog already contains the sync entry; skipping update.");
    return;
  }

  if (!text.includes(UNRELEASED_HEADING)) {
    const firstVersionIdx = text.indexOf(VERSION_HEADING_PREFIX);
    const newSection = `\n${UNRELEASED_HEADING}\n\n${OTHER_CHANGES_HEADING}\n\n${entry}\n`;
    if (firstVersionIdx === -1) {
      text = ensureTrailingNewline(text.trimEnd()) + newSection;
    } else {
      text = text.slice(0, firstVersionIdx) + newSection + text.slice(firstVersionIdx);
    }
  } else {
    const unreleasedStart = text.indexOf(UNRELEASED_HEADING);
    const unreleasedEnd = text.indexOf(
      VERSION_HEADING_PREFIX,
      unreleasedStart + UNRELEASED_HEADING.length
    );
    const sectionEnd = unreleasedEnd === -1 ? text.length : unreleasedEnd;
    let unreleasedSection = text.slice(unreleasedStart, sectionEnd);

    if (unreleasedSection.includes(OTHER_CHANGES_HEADING)) {
      const marker = `${OTHER_CHANGES_HEADING}\n\n`;
      if (unreleasedSection.includes(marker)) {
        unreleasedSection = unreleasedSection.replace(marker, `${marker}${entry}\n`);
      } else {
        const headingIdx =
          unreleasedSection.indexOf(OTHER_CHANGES_HEADING) + OTHER_CHANGES_HEADING.length;
        unreleasedSection =
          unreleasedSection.slice(0, headingIdx) +
          `\n\n${entry}` +
          unreleasedSection.slice(headingIdx);
      }
    } else {
      unreleasedSection = `${unreleasedSection.trimEnd()}\n\n${OTHER_CHANGES_HEADING}\n\n${entry}\n`;
    }

    text = text.slice(0, unreleasedStart) + unreleasedSection + text.slice(sectionEnd);
  }

  fs.writeFileSync(changelogPath, text, "utf8");
  console.log(`Updated changelog: ${changelogPath}`);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length !== 4) {
    console.error(
      "Usage: node update-azure-mcp-changelog.ts <changelog_path> <source_repo> <source_sha> <source_server_url>"
    );
    process.exit(1);
  }

  const changelogPath = path.resolve(args[0]);
  const sourceRepo = args[1];
  const sourceSha = args[2];
  const sourceServerUrl = args[3];

  if (!fs.existsSync(changelogPath) || !fs.statSync(changelogPath).isFile()) {
    console.error(`ERROR: changelog file not found: ${changelogPath}`);
    process.exit(1);
  }

  if (!sourceRepo || !sourceSha || !sourceServerUrl) {
    console.error(
      "ERROR: source_repo, source_sha, and source_server_url must be non-empty values."
    );
    process.exit(1);
  }

  updateChangelog(changelogPath, sourceRepo, sourceSha, sourceServerUrl);
}

main();
