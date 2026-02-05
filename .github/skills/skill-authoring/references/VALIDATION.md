# Skill Validation Procedures

Run these validations when reviewing or authoring skills.

## 1. Broken Link Verification

Check all markdown links in SKILL.md and referenced files.

**Procedure:**
1. Parse all `[text](path)` links in SKILL.md
2. For each link to a local file, verify the file exists
3. Recursively check links in referenced files
4. Flag any links where the target file is missing

**When broken link found, ask user:**
- a) **Fix reference** - Update the link path to correct location
- b) **Delete link** - Remove the link from the document
- c) **Something else** - User provides alternative action

## 2. Orphaned Reference Detection

Identify files in `references/` that are never linked from SKILL.md or other references.

**Procedure:**
1. List all files in `references/` directory (recursively)
2. Collect all link targets from SKILL.md and linked references
3. Compare: any file not in the link targets is orphaned

**When orphaned reference found, ask user:**
- a) **Delete reference** - Remove the orphaned file
- b) **Add link to reference** - Add appropriate link in SKILL.md or another reference
- c) **Something else** - User provides alternative action

## 3. Reference Token Splitting

References exceeding 1000 tokens should be split into smaller files.

**Procedure:**
1. Calculate tokens for each reference file
2. For files >1000 tokens, split into logical sections

**Splitting Pattern:**
```
# Before
references/
└── large-guide.md          # 1500 tokens

# After
references/
└── large-guide/
    ├── README.md           # Overview + links to sections
    ├── section-1.md        # First logical section
    ├── section-2.md        # Second logical section
    └── section-3.md        # Third logical section
```

**README.md structure:**
```markdown
# [Topic] Guide

Overview of the topic.

## Sections

- [Section 1](section-1.md) - Brief description
- [Section 2](section-2.md) - Brief description
- [Section 3](section-3.md) - Brief description
```

**Update original links:**
- Change `[guide](references/large-guide.md)` to `[guide](references/large-guide/README.md)`

## 4. Duplicate Content Consolidation

Find repeated content that can be extracted into a shared reference.

**Indicators of duplication:**
- Same code blocks appearing in multiple files
- Identical troubleshooting steps across references
- Repeated tables or command lists

**Consolidation Procedure:**
1. Identify duplicate content (3+ lines repeated in 2+ files)
2. Extract to a new reference file (e.g., `references/common-commands.md`)
3. Replace duplicates with links to the consolidated reference
4. Ensure consolidated file is self-contained

**Example consolidation:**
```markdown
# Before (in multiple files)
## Authentication
Run `az login` to authenticate...
[same 10 lines repeated]

# After
## Authentication
See [Authentication Setup](common/authentication.md) for details.
```

## Validation Checklist

| Check | Action if Failed |
|-------|------------------|
| Broken links | Fix, delete, or user decision |
| Orphaned references | Delete, add link, or user decision |
| References >1000 tokens | Split into folder with README.md |
| Duplicate content | Consolidate into shared reference |
