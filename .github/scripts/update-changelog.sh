#!/usr/bin/env bash
# update-changelog.sh <changelog-file> <new-version>
# Inserts a new version entry at the top of the changelog (before the first "## [" section).
# Change lines are derived from the currently staged git index.
# If no existing version sections are found, the entry is appended at the end.
set -euo pipefail

CHANGELOG_FILE="${1:?Usage: update-changelog.sh <changelog-file> <new-version>}"
NEW_VERSION="${2:?Usage: update-changelog.sh <changelog-file> <new-version>}"
TODAY=$(date +%Y-%m-%d)

if [ ! -f "$CHANGELOG_FILE" ]; then
  echo "Warning: CHANGELOG file not found at '$CHANGELOG_FILE'. Version $NEW_VERSION will not be documented. Skipping changelog update."
  exit 0
fi

# Build change lines from staged git index.
# Strip the directory prefix of the CHANGELOG so paths are relative to the plugin root.
CHANGELOG_DIR="$(dirname "$CHANGELOG_FILE")/"
CHANGE_LINES=()
while IFS=$'\t' read -r status filepath; do
  relpath="${filepath#"$CHANGELOG_DIR"}"
  case "${status:0:1}" in
    A) CHANGE_LINES+=("- Added: \`${relpath}\`") ;;
    D) CHANGE_LINES+=("- Removed: \`${relpath}\`") ;;
    *) CHANGE_LINES+=("- Updated: \`${relpath}\`") ;;
  esac
done < <(git diff --cached --name-status 2>/dev/null \
  | grep -vE '(plugin\.json|CHANGELOG\.md)$' \
  || true)

# Fall back to a generic message when no specific changes were found.
if [ ${#CHANGE_LINES[@]} -eq 0 ]; then
  CHANGE_LINES=("- Synced plugin files from GitHub-Copilot-for-Azure.")
fi

# Write the new entry to a temp file so awk can read it.
ENTRY_FILE=$(mktemp)
trap 'rm -f "$ENTRY_FILE"' EXIT
{
  printf "## [%s] - %s\n" "$NEW_VERSION" "$TODAY"
  printf "\n"
  printf "### Changed\n"
  printf "\n"
  for line in "${CHANGE_LINES[@]}"; do
    printf "%s\n" "$line"
  done
  printf "\n"
} > "$ENTRY_FILE"

# Insert the new entry before the first "## [" line, or append at end.
awk -v entry_file="$ENTRY_FILE" '
  /^## \[/ && !inserted {
    while ((getline line < entry_file) > 0) print line
    close(entry_file)
    inserted=1
  }
  { print }
  END {
    if (!inserted) {
      print ""
      while ((getline line < entry_file) > 0) print line
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
