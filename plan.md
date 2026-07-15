# Multi-plugin Restructuring Plan

## Build

- Update build script to support specifying plugin to build, build all by default.
- Update build script to read from new location of plugin files.
- Update pr.yml workflow to read plugin files from the new locations.
- Update publish-to-marketplace.yml workflow to read from the new location of the azure plugin. However, keep the logic as is. The downstream marketplace is not ready for hosting multi-plugin yet.

## Tests

- Update util code in tests/ to know which plugin to test. The plugin to test will be passed as an additional input and only one plugin will be tested at each time.
- Update util code in tests/ to locate skill files at the new locations.
- Update the vally commands in eval.yml to lint every plugin in its step.

## Scripts

- Update scripts in scripts/ to support specifying which plugin to deal with 
- Update scripts in scripts/ to work on new location of plugin files


## Documentation

- Update vally-eval skill to reference the new file structure
- 

## Nuances

azure plugin is named "azure" but the directory is named "azure-skills". Awesome Copilot repo encodes that information so we cannot simply change that. We need to patch the script to tell them to look for the files at azure-skills when the user refers to "azure" plugin. https://github.com/github/awesome-copilot/blob/30472ecf0fe34cc561df958c08501ecc5ca80ea4/.github/plugin/marketplace.json#L121-L143