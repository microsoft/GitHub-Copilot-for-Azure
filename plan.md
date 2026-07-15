# Multi-plugin Restructuring Plan

## Build

- Update pr.yml workflow to read plugin files from the new locations.
- Update publish-to-marketplace.yml workflow to read from the new location of the azure plugin. However, keep the logic as is. The downstream marketplace is not ready for hosting multi-plugin yet.

## Tests

- Update util code in tests/ to locate skill files at the new locations.
- Update the vally commands in eval.yml to lint every plugin in its step.

## Scripts

- Update scripts in scripts/ to support specifying which plugin to deal with 
  - references: remove --skills-dir option, add --plugins-dir option
- Update scripts in scripts/ to work on new location of plugin files
  - references: check references for each plugin in --plugins-dir option

## Documentation

- Update vally-eval skill to reference the new file structure

## Nuances
