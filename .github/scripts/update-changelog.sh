#!/usr/bin/env bash
# update-changelog.sh <changelog-file> <new-version>
# Inserts a new version entry at the top of the changelog (before the first "## [" section).
# If no existing version sections are found, the entry is appended at the end.
set -euo pipefail

CHANGELOG_FILE="${1:?Usage: update-changelog.sh <changelog-file> <new-version>}"
NEW_VERSION="${2:?Usage: update-changelog.sh <changelog-file> <new-version>}"
TODAY=$(date +%Y-%m-%d)

if [ ! -f "$CHANGELOG_FILE" ]; then
  echo "Warning: CHANGELOG file not found at '$CHANGELOG_FILE'. Version $NEW_VERSION will not be documented. Skipping changelog update."
  exit 0
fi

awk -v ver="$NEW_VERSION" -v date="$TODAY" '
  /^## \[/ && !inserted {
    print "## [" ver "] - " date
    print ""
    print "### Changed"
    print ""
    print "- Synced plugin files from GitHub-Copilot-for-Azure."
    print ""
    inserted=1
  }
  { print }
  END {
    if (!inserted) {
      print ""
      print "## [" ver "] - " date
      print ""
      print "### Changed"
      print ""
      print "- Synced plugin files from GitHub-Copilot-for-Azure."
    }
  }
' "$CHANGELOG_FILE" > "$CHANGELOG_FILE.tmp"

if [ ! -s "$CHANGELOG_FILE.tmp" ]; then
  rm -f "$CHANGELOG_FILE.tmp"
  echo "Error: awk processing resulted in empty output for $CHANGELOG_FILE. This may indicate a parsing failure. Original file preserved. Please review the changelog format." >&2
  exit 1
fi

mv "$CHANGELOG_FILE.tmp" "$CHANGELOG_FILE"
echo "Updated CHANGELOG.md with version $NEW_VERSION"
