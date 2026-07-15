# Test 1
# CHANGED_FILES="plugins/cat/skills/cats/SKILL.md plugins/azure-skills/skills/azure-ai/SKILL.md"
# SKILL_FILES=""
# for file in $CHANGED_FILES; do
# if echo "$file" | grep -Eq '^plugins/[^/]+/skills/'; then
#     mapped=$(echo "$file" | sed -E 's|^plugins/([^/]+)/skills/|output/\1/skills/|')
#     SKILL_FILES="$SKILL_FILES ../$mapped"
# else
#     SKILL_FILES="$SKILL_FILES ../$file"
# fi
# done

# echo $SKILL_FILES

# Test 2 
# PLUGIN_PATHS=()
# for plugin_dir in ./plugins/*; do
# if [ -d "$plugin_dir" ]; then
#     PLUGIN_PATHS+=("$plugin_dir")
# fi
# done

# if [ "${#PLUGIN_PATHS[@]}" -eq 0 ]; then
# echo "No plugin directories found under ./plugins"
# exit 1
# fi

# echo "${PLUGIN_PATHS[@]}"

# Test 3
# SOURCE_ROOT="./output"
# TARGET_ROOT="./.github/plugins"

# # Scan immediate child directories under source-repo/output and sync each child
# # to target-repo/.github/plugins/<child-dirname>/.
# find "$SOURCE_ROOT" -mindepth 1 -maxdepth 1 -type d | while IFS= read -r child_dir; do
# child_name=$(basename "$child_dir")
# target_dir="$TARGET_ROOT/$child_name/"

# mkdir -p "$target_dir"

# # Use rsync to mirror each child directory into its corresponding target directory:
# #   --archive   preserve permissions, timestamps, etc.
# #   --delete    remove files in target that are no longer in source child dir
# #   --verbose   list changes
# rsync --archive --delete --verbose "$child_dir/" "$target_dir"
# done

# Test 4
# TARGET_DIRS=("./plugins")
# for target in "${TARGET_DIRS[@]}"; do
# if [ -e "$target" ]; then
#     if matches=$(grep -rli --include='*.md' --include='*.json' --exclude='CHANGELOG.md' --exclude='changelog-*.md' 'https://github.com/microsoft/github-copilot-for-azure' "$target"); then
#     echo "matches" $matches
#     echo "$matches" | while IFS= read -r file; do
#         sed -i 's|https://github.com/microsoft/GitHub-Copilot-for-Azure|https://github.com/microsoft/azure-skills|g' "$file"
#         sed -i 's|https://github.com/microsoft/github-copilot-for-azure|https://github.com/microsoft/azure-skills|g' "$file"
#     done
#     fi
# fi
# done