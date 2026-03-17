# Plugin Version and CHANGELOG PR Check

This directory contains automation to prevent manual plugin version updates and CHANGELOG modifications in pull requests.

## Overview

Plugin versions and CHANGELOG entries should be managed automatically through CI/CD processes, not manually updated in feature PRs. This PR check ensures version consistency, prevents merge conflicts, and maintains automated changelog management.

## Components

### 1. GitHub Actions Workflow
- **File**: `.github/workflows/pr-plugin-version-check.yml`
- **Trigger**: PRs that modify plugin.json files or CHANGELOG.md
- **Action**: Runs version comparison check and CHANGELOG modification check

### 2. Version Check Script
- **File**: `scripts/src/check-plugin-version-pr.ts`
- **Purpose**: Compares plugin versions between base and PR head
- **Behavior**: Fails if any version changes are detected

### 3. CHANGELOG Check
- **Implementation**: Built into GitHub Actions workflow
- **Purpose**: Prevents manual CHANGELOG.md modifications
- **Behavior**: Fails if CHANGELOG.md is modified in the PR

### 4. Test Suite
- **File**: `scripts/src/__tests__/check-plugin-version-pr.test.ts`
- **Coverage**: Environment validation, version comparison logic, error handling

## Files Monitored

### Plugin Configuration Files
- `plugin/.plugin/plugin.json` (Open Plugins Specification)
- `plugin/.claude-plugin/plugin.json` (Claude Code manifest)

### Documentation Files  
- `plugin/CHANGELOG.md` (Plugin changelog - automatically maintained)

## Usage

### Automatic (Recommended)
The check runs automatically on PRs that modify plugin.json files.

### Manual Testing
```bash
# From the scripts directory
cd scripts
export BASE_SHA="main"
export HEAD_SHA="HEAD"
npm run checkPluginVersionPr
```

### Running Tests
```bash
cd scripts
npm test -- -t "checkPluginVersionChanges"
```

## Expected Behavior

### ✅ PR Check Passes When:
- No version changes detected
- No CHANGELOG.md modifications
- New plugin files added (with any version)
- Plugin files deleted
- Only non-version fields modified

### ❌ PR Check Fails When:
- Plugin version field is modified
- Any version number changes between base and head
- CHANGELOG.md is modified

## Error Messages

### Version Change Errors
When version changes are detected, the check provides detailed output:
```
❌ Plugin version changes detected in this PR!

The following plugin versions were modified:
  📄 plugin/.plugin/plugin.json
     1.0.0 → 1.1.0
  📄 plugin/.claude-plugin/plugin.json  
     1.0.0 → 1.1.0

🚫 Plugin versions should not be updated manually in PRs.
   Plugin versions are managed automatically through CI/CD.
   Please revert the version changes and submit your PR again.
```

### CHANGELOG Modification Errors
When CHANGELOG.md is modified:
```
❌ ERROR: CHANGELOG.md should not be modified in pull requests
The CHANGELOG.md is automatically maintained. Please remove changes to plugin/CHANGELOG.md from your PR.
```

## Implementation Details

### Version Check Script
The script uses git commands to:
1. Fetch file contents at base commit (`git show BASE_SHA:path`)
2. Fetch file contents at head commit (`git show HEAD_SHA:path`)  
3. Parse JSON and compare version fields
4. Report any differences found

### CHANGELOG Check
The GitHub Actions workflow uses:
1. `git diff --name-only` to compare file changes between base and head
2. `grep` to check if CHANGELOG.md appears in the changed files list
3. Exit with error code 1 if CHANGELOG.md modifications are detected

## Troubleshooting

### Common Issues
- **Missing Environment Variables**: Ensure `BASE_SHA` and `HEAD_SHA` are set
- **Git Errors**: Check that git repository is properly initialized
- **JSON Parse Errors**: Handled gracefully - invalid JSON is ignored

### Override Process
If version updates are legitimately needed:
1. **Automated CI**: Use dedicated version update workflows
2. **Emergency Override**: Temporarily disable the check in the workflow file