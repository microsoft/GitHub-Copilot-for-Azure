---
name: onboard-plugin
description: "Scaffold a new plugin and make it for distribution. WHEN: create a new plugin, scaffold a new plugin"
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Workflow

This skill provides the end-to-end steps for onboarding a new plugin to this repo. Follow the steps to scaffold a new plugin and make it ready for distribution.

## Scaffold the new plugin folder

Ask the skill author to provide a name for the new plugin. Then in `<repo-root>/scripts/`, run this command to scaffold the common files for a new plugin.

```bash
# At <repo-root>/scripts/
cd scripts
npm run plugin:new -- --plugin {plugin-name}
```

This command creates a `plugins/{plugin-name}` directory and files in it. Refer to the `Plugin Structure` section of [Onboarding.md](../../../docs/Onboarding.md) to understand what each file is for.

This command adds an entry for the new plugin in `tests/skills.json`. Nightly scheduled integration tests use this file to discover the plugins and skills to test.

This command adds a new set of path patterns in the pluginPathAllowPattern scripts. The shared telemetry hook script uses these patterns to prevent the script from attempting to send telemetry for skills outside this repo.

## Scaffold the skills

Ask the skill author for the names of the skills they plan to add and then scaffold them by running this script for each skill. Try running this command in `<repo-root>/scripts` with `{plugin-name}` from the previous step. If the plugin doesn't exist, it may have been renamed. Ask the skill author what plugin name to use.

```bash
# At <repo-root>/scripts/
cd scripts
npm run plugin:new-skill -- --plugin {plugin-name} --skill {skill-name}
```

This command creates a `plugins/{plugin-name}/skills/{skill-name}/SKILL.md` file and an `evals/{plugin-name}/eval.yaml` file. Refer to the `Skill Structure` section of [Onboarding.md](../../../docs/Onboarding.md) to understand what each file is for and what files can be added. It adds two placeholder codeowners and Rick Winter as the codeowner of the corresponding directories. Every new plugin must have at least two distinct codeowner and Rick Winter as a fallback owner.

This command also adds the skill to `tests/skills.json` nightly integration test schedule.

**IMPORTANT**: Leave the scaffolded skill as is and don't implement them. Skill authors must implement and test the skills themselves.

## Run local integration test

The scaffolded skill includes one example routing test that prompts the agent to load the skill and describe what it does. Do a test run.

First build the plugin from the repo root;

```bash
# IMPORTANT: Run this command at the <repo-root>
npm run build
```

Then use this command in `<repo-root>/tests/`.

```bash
# At <repo-root>/tests/
cd tests
npm run test:vally -- --plugin {plugin-name} --skill {skill-name}
```

The test should pass. Ask the skill author to report a bug to microsoft/github-copilot-for-azure.

## Prepare for release

The scaffolded plugin and skill files are ready for release by default. Refer to the `Releasing` section of [Onboarding.md](../../../docs/Onboarding.md) for how releases work.

## Finish the implementation

Notify the skill author about these next steps to finish onboarding the new plugin.

- Implement the skills. Add scripts and reference files as appropriate. Follow [skill-authoring](../skill-authoring/SKILL.md) to implement the skill.
- Implement the integration tests. Replace the example test with meaningful tests that checks if the skill can be invoked for target user prompts and if it can successfully accomplish their goals in the target scenarios. Follow [vally-eval](../vally-eval/SKILL.md) skill on how to author integration tests.
- Write the human facing content the new plugin. This includes
  - description of the plugin in `plugin.json` files.
  - keywords of the plugin in `plugin.json` files
  - the plugin `README.md`
- Replace the placeholder codeowners in CODEOWNERS file. Codeowners will be responsible for keeping the plugin up-to-date to make sure it brings value to the users.
- IMPORTANT: Keep scaffolded files as is except for the ones mentioned above. When unsure, read [Onboarding](../../../docs/Onboarding.md) to learn more about the plugin structure.
- Once all the above are completed, submit a PR with the changes to microsoft/github-copilot-for-azure repo.
