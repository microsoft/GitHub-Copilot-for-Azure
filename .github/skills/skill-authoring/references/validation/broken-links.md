# Broken Link Verification

Check all markdown links in SKILL.md and referenced files.

## Procedure

1. Parse all `[text](path)` links in SKILL.md
2. For each link to a local file, verify the file exists
3. Recursively check links in referenced files
4. Flag any links where the target file is missing

## When broken link found, ask user:

- a) **Fix reference** - Update the link path to correct location
- b) **Delete link** - Remove the link from the document
- c) **Something else** - User provides alternative action
