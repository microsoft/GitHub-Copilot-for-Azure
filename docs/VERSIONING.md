# Automatic Versioning with semantic-release

This repository uses [semantic-release](https://github.com/semantic-release/semantic-release) to automatically manage version numbers for plugin files based on commit message conventions.

## How It Works

- **Version Source**: Versions are calculated based on commit message conventions (conventional commits)
- **Simple Updates**: Plugin versions update when PRs contain any changes to the `plugin/` folder  
- **Semantic Versioning**: Automatically determines patch, minor, or major version bumps
- **CI-Driven**: All version updates happen automatically via GitHub Actions
- **Consistent Versioning**: All plugin files maintain the same version number across the repository
- **Automatic Changelog**: Release notes are automatically generated and maintained in `plugin/CHANGELOG.md`

## Files Managed

The following files have their versions automatically updated:
- `plugin/.claude-plugin/plugin.json`
- `plugin/.plugin/plugin.json`
- `plugin/CHANGELOG.md` (automatically generated release notes)

## Version Calculation Rules

Versions are calculated based on **commit message conventions**:
- **fix:** commits → PATCH release (1.0.1)
- **feat:** commits → MINOR release (1.1.0)  
- **BREAKING CHANGE:** commits → MAJOR release (2.0.0)
- **chore:**, **docs:**, etc. → No release

### Commit Examples:
- `fix: resolve skill loading issue` → 1.0.1
- `feat: add new Azure AI skill` → 1.1.0
- `feat!: change skill interface` → 2.0.0

## Configuration Files

- `.releaserc.json` - Semantic-release configuration with changelog generation
- `package.json` - npm dependencies and scripts
- `scripts/src/update-plugin-version.ts` - TypeScript version update script

## Changelog Generation

Release notes are automatically generated based on conventional commit messages and written to `plugin/CHANGELOG.md`. The changelog includes:
- **Features** - commits with `feat:` prefix
- **Bug Fixes** - commits with `fix:` prefix  
- **Breaking Changes** - commits with `BREAKING CHANGE:` or `!` suffix
- **Performance Improvements** - commits with `perf:` prefix

The changelog is updated with each release and committed along with the version files.

## CI/CD Integration

The GitHub Actions workflow `.github/workflows/update-plugin-versions.yml` automatically updates plugin versions whenever a PR is merged into the main branch **that contains any changes to the plugin folder**. This ensures that:
- Any changes to files under `plugin/` folder result in version increments
- Changes outside the plugin folder don't trigger version updates
- Version numbers stay synchronized across all environments  
- No manual version management is required

### Files That Trigger Version Updates:
- ✅ Any file under `plugin/` folder
- ❌ Any file outside `plugin/` folder

### Example Scenarios:
- **PR updates skill files** → Version bumps ✅
- **PR updates README.md only** → No version change ❌

## Troubleshooting

### Dependencies missing
```bash
npm ci
```

### Version not updating after PR merge
1. Check the GitHub Actions workflow logs
2. Ensure the PR contained changes to files under `plugin/` 
3. Verify commit messages follow conventional format
4. Run `npm run release -- --dry-run` to test locally