# Automatic Versioning with Nerdbank.GitVersioning

This repository uses [Nerdbank.GitVersioning (NBGV)](https://github.com/dotnet/Nerdbank.GitVersioning) to automatically manage version numbers for plugin and skill files based on git commit history.

## How It Works

- **Version Source**: Versions are calculated from the git commit height since `version.json` was introduced, filtered by path
- **Path-Filtered Heights**: Each component (plugin, individual skills) has its own `version.json` with `pathFilters: ["."]` so only commits touching that directory increment its version
- **Build-Time Stamping**: The Gulp build (`npm run build`) stamps versions into output files at build time
- **Consistent Versioning**: All plugin manifest files (`.plugin/plugin.json`, `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`) share the same version

## Files Managed

The following files have their versions automatically stamped at build time:
- `plugin/.claude-plugin/plugin.json`
- `plugin/.cursor-plugin/plugin.json`
- `plugin/.plugin/plugin.json`
- `plugin/skills/*/SKILL.md` (each skill gets its own version)

## Changelog Generation

The `CHANGELOG.md` is automatically generated at build time by the Gulp pipeline. It includes merged PRs that:
- Touch the `plugin/` directory
- Have titles starting with `fix:`, `feat:`, or `feature:`

Each entry is associated with the NBGV height-based version (`{major}.{minor}.{height}`) of the commit that introduced it.

## Version Calculation

Versions follow the format `{major}.{minor}.{height}` where:
- `major.minor` comes from the component's `version.json`
- `height` is the number of first-parent commits touching that component's directory since `version.json` was introduced

## CI/CD Integration

The GitHub Actions workflow `publish-to-marketplace.yml` automatically:
1. Runs `npm run build` to produce versioned output in `output/`
2. Syncs the output to `microsoft/skills` and `microsoft/azure-skills` marketplace repos

### Files That Trigger Version Updates:
- ✅ Any file under `plugin/` folder (for plugin version)
- ✅ Any file under a skill's directory (for that skill's version)
- ❌ Files outside tracked paths don't affect versions